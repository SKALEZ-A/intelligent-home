import { logger } from '../utils/logger';

interface ServiceInstance {
  id: string;
  url: string;
  healthy: boolean;
  lastCheck: Date;
  activeConnections: number;
  responseTime: number;
}

interface ServiceConfig {
  name: string;
  instances: string[];
  healthCheckInterval: number;
  healthCheckPath: string;
  maxRetries: number;
}

export class LoadBalancerService {
  private services: Map<string, ServiceInstance[]> = new Map();
  private roundRobinIndex: Map<string, number> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeServices();
  }

  private initializeServices() {
    const services: ServiceConfig[] = [
      {
        name: 'auth-service',
        instances: (process.env.AUTH_SERVICE_URLS || 'http://auth-service:3001').split(','),
        healthCheckInterval: 30000,
        healthCheckPath: '/health',
        maxRetries: 3
      },
      {
        name: 'device-service',
        instances: (process.env.DEVICE_SERVICE_URLS || 'http://device-service:3002').split(','),
        healthCheckInterval: 30000,
        healthCheckPath: '/health',
        maxRetries: 3
      },
      {
        name: 'automation-service',
        instances: (process.env.AUTOMATION_SERVICE_URLS || 'http://automation-service:3003').split(','),
        healthCheckInterval: 30000,
        healthCheckPath: '/health',
        maxRetries: 3
      }
    ];

    services.forEach(config => {
      const instances: ServiceInstance[] = config.instances.map((url, index) => ({
        id: `${config.name}-${index}`,
        url: url.trim(),
        healthy: true,
        lastCheck: new Date(),
        activeConnections: 0,
        responseTime: 0
      }));

      this.services.set(config.name, instances);
      this.roundRobinIndex.set(config.name, 0);
      this.startHealthChecks(config);
    });
  }

  private startHealthChecks(config: ServiceConfig) {
    const interval = setInterval(async () => {
      const instances = this.services.get(config.name);
      if (!instances) return;

      for (const instance of instances) {
        await this.checkHealth(instance, config.healthCheckPath);
      }
    }, config.healthCheckInterval);

    this.healthCheckIntervals.set(config.name, interval);
  }

  private async checkHealth(instance: ServiceInstance, path: string): Promise<void> {
    const startTime = Date.now();
    try {
      const response = await fetch(`${instance.url}${path}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      instance.healthy = response.ok;
      instance.responseTime = Date.now() - startTime;
      instance.lastCheck = new Date();

      logger.debug('Health check completed', {
        instanceId: instance.id,
        healthy: instance.healthy,
        responseTime: instance.responseTime
      });
    } catch (error) {
      instance.healthy = false;
      instance.lastCheck = new Date();
      logger.error('Health check failed', { instanceId: instance.id, error });
    }
  }

  public getServiceInstance(serviceName: string, strategy: 'round-robin' | 'least-connections' | 'fastest' = 'round-robin'): ServiceInstance | null {
    const instances = this.services.get(serviceName);
    if (!instances || instances.length === 0) {
      logger.error('No instances found for service', { serviceName });
      return null;
    }

    const healthyInstances = instances.filter(i => i.healthy);
    if (healthyInstances.length === 0) {
      logger.warn('No healthy instances available', { serviceName });
      return instances[0];
    }

    switch (strategy) {
      case 'least-connections':
        return this.getLeastConnectionsInstance(healthyInstances);
      case 'fastest':
        return this.getFastestInstance(healthyInstances);
      case 'round-robin':
      default:
        return this.getRoundRobinInstance(serviceName, healthyInstances);
    }
  }

  private getRoundRobinInstance(serviceName: string, instances: ServiceInstance[]): ServiceInstance {
    const currentIndex = this.roundRobinIndex.get(serviceName) || 0;
    const instance = instances[currentIndex % instances.length];
    this.roundRobinIndex.set(serviceName, currentIndex + 1);
    return instance;
  }

  private getLeastConnectionsInstance(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((prev, curr) => 
      curr.activeConnections < prev.activeConnections ? curr : prev
    );
  }

  private getFastestInstance(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((prev, curr) => 
      curr.responseTime < prev.responseTime ? curr : prev
    );
  }

  public incrementConnections(instanceId: string): void {
    for (const instances of this.services.values()) {
      const instance = instances.find(i => i.id === instanceId);
      if (instance) {
        instance.activeConnections++;
        break;
      }
    }
  }

  public decrementConnections(instanceId: string): void {
    for (const instances of this.services.values()) {
      const instance = instances.find(i => i.id === instanceId);
      if (instance) {
        instance.activeConnections = Math.max(0, instance.activeConnections - 1);
        break;
      }
    }
  }

  public getServiceHealth(serviceName: string): any {
    const instances = this.services.get(serviceName);
    if (!instances) return null;

    return {
      serviceName,
      totalInstances: instances.length,
      healthyInstances: instances.filter(i => i.healthy).length,
      instances: instances.map(i => ({
        id: i.id,
        url: i.url,
        healthy: i.healthy,
        activeConnections: i.activeConnections,
        responseTime: i.responseTime,
        lastCheck: i.lastCheck
      }))
    };
  }

  public shutdown(): void {
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
  }
}

export const loadBalancer = new LoadBalancerService();
