export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  responseTime?: number;
}

export class HealthCheckService {
  private startTime: Date = new Date();
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();

  registerCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.checks.set(name, checkFn);
  }

  async checkHealth(): Promise<HealthStatus> {
    const results: HealthCheck[] = [];
    
    for (const [name, checkFn] of this.checks) {
      try {
        const result = await checkFn();
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: 'fail',
          message: error.message
        });
      }
    }

    const status = this.determineOverallStatus(results);
    
    return {
      status,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      checks: results
    };
  }

  private determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'unhealthy' {
    const failedChecks = checks.filter(c => c.status === 'fail').length;
    const warnChecks = checks.filter(c => c.status === 'warn').length;

    if (failedChecks > 0) return 'unhealthy';
    if (warnChecks > 0) return 'degraded';
    return 'healthy';
  }

  async isReady(): Promise<boolean> {
    const health = await this.checkHealth();
    return health.status !== 'unhealthy';
  }

  async getDetailedHealth(): Promise<any> {
    const health = await this.checkHealth();
    return {
      ...health,
      service: process.env.SERVICE_NAME || 'unknown',
      version: process.env.SERVICE_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
  }
}
