import { EventEmitter } from 'events';
import axios from 'axios';
import { logger } from '../../../shared/utils/logger';

interface ServiceEndpoint {
  name: string;
  url: string;
  healthPath: string;
  timeout: number;
  critical: boolean;
}

interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  consecutiveFailures: number;
  uptime: number;
  details?: any;
}

export class ApiHealthMonitorService extends EventEmitter {
  private services: Map<string, ServiceEndpoint> = new Map();
  private healthStatuses: Map<string, HealthStatus> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly defaultTimeout = 5000;
  private readonly maxConsecutiveFailures = 3;

  constructor() {
    super();
    this.initializeServices();
  }

  private initializeServices(): void {
    const services: ServiceEndpoint[] = [
      {
        name: 'auth-service',
        url: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
        healthPath: '/health',
        timeout: 3000,
        critical: true
      },
      {
        name: 'device-service',
        url: process.env.DEVICE_SERVICE_URL || 'http://device-service:3002',
        healthPath: '/health',
        timeout: 3000,
        critical: true
      },
      {
        name: 'automation-service',
        url: process.env.AUTOMATION_SERVICE_URL || 'http://automation-service:3003',
        healthPath: '/health',
        timeout: 3000,
        critical: false
      },
      {
        name: 'energy-service',
        url: process.env.ENERGY_SERVICE_URL || 'http://energy-service:3004',
        healthPath: '/health',
        timeout: 3000,
        critical: false
      },
      {
        name: 'notification-service',
        url: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3005',
        healthPath: '/health',
        timeout: 3000,
        critical: false
      },
      {
        name: 'weather-service',
        url: process.env.WEATHER_SERVICE_URL || 'http://weather-service:3006',
        healthPath: '/health',
        timeout: 3000,
        critical: false
      }
    ];

    services.forEach(service => this.services.set(service.name, service));
  }

  async checkServiceHealth(serviceName: string): Promise<HealthStatus> {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const startTime = Date.now();
    const previousStatus = this.healthStatuses.get(serviceName);

    try {
      const response = await axios.get(`${service.url}${service.healthPath}`, {
        timeout: service.timeout,
        validateStatus: (status) => status < 500
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = response.status === 200;

      const status: HealthStatus = {
        service: serviceName,
        status: isHealthy ? 'healthy' : 'degraded',
        responseTime,
        lastCheck: new Date(),
        consecutiveFailures: isHealthy ? 0 : (previousStatus?.consecutiveFailures || 0) + 1,
        uptime: this.calculateUptime(previousStatus, isHealthy),
        details: response.data
      };

      this.healthStatuses.set(serviceName, status);
      this.emitHealthEvent(status, previousStatus);

      return status;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const status: HealthStatus = {
        service: serviceName,
        status: 'unhealthy',
        responseTime,
        lastCheck: new Date(),
        consecutiveFailures: (previousStatus?.consecutiveFailures || 0) + 1,
        uptime: this.calculateUptime(previousStatus, false),
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };

      this.healthStatuses.set(serviceName, status);
      this.emitHealthEvent(status, previousStatus);

      return status;
    }
  }

  private calculateUptime(previousStatus: HealthStatus | undefined, isHealthy: boolean): number {
    if (!previousStatus) return isHealthy ? 100 : 0;
    
    const totalChecks = previousStatus.consecutiveFailures + 1;
    const successfulChecks = isHealthy ? totalChecks - previousStatus.consecutiveFailures : totalChecks - previousStatus.consecutiveFailures - 1;
    
    return (successfulChecks / totalChecks) * 100;
  }

  private emitHealthEvent(current: HealthStatus, previous: HealthStatus | undefined): void {
    if (!previous || previous.status !== current.status) {
      this.emit('statusChange', current);
      
      if (current.status === 'unhealthy') {
        this.emit('serviceDown', current);
        logger.error(`Service ${current.service} is unhealthy`, current.details);
      } else if (previous?.status === 'unhealthy' && current.status !== 'unhealthy') {
        this.emit('serviceRecovered', current);
        logger.info(`Service ${current.service} has recovered`);
      }
    }

    if (current.consecutiveFailures >= this.maxConsecutiveFailures) {
      const service = this.services.get(current.service);
      if (service?.critical) {
        this.emit('criticalServiceFailure', current);
        logger.error(`Critical service ${current.service} has failed ${current.consecutiveFailures} times`);
      }
    }
  }

  startMonitoring(intervalMs: number = 30000): void {
    for (const serviceName of this.services.keys()) {
      const interval = setInterval(async () => {
        await this.checkServiceHealth(serviceName);
      }, intervalMs);

      this.checkIntervals.set(serviceName, interval);
      
      // Initial check
      this.checkServiceHealth(serviceName);
    }

    logger.info('Health monitoring started for all services');
  }

  stopMonitoring(): void {
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();
    logger.info('Health monitoring stopped');
  }

  getServiceStatus(serviceName: string): HealthStatus | undefined {
    return this.healthStatuses.get(serviceName);
  }

  getAllStatuses(): HealthStatus[] {
    return Array.from(this.healthStatuses.values());
  }

  getOverallHealth(): { status: string; services: HealthStatus[] } {
    const statuses = this.getAllStatuses();
    const unhealthyServices = statuses.filter(s => s.status === 'unhealthy');
    const degradedServices = statuses.filter(s => s.status === 'degraded');

    let overallStatus = 'healthy';
    if (unhealthyServices.length > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      services: statuses
    };
  }
}

export const apiHealthMonitor = new ApiHealthMonitorService();
