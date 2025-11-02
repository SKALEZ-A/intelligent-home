interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: any) => void;
}

export class RetryService {
  private defaultOptions: RetryOptions = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  };

  public async execute<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: any;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === opts.maxAttempts) {
          throw error;
        }

        if (opts.retryableErrors && !this.isRetryableError(error, opts.retryableErrors)) {
          throw error;
        }

        const delay = this.calculateDelay(attempt, opts);
        
        if (opts.onRetry) {
          opts.onRetry(attempt, error);
        }

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  public async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitBreakerKey: string,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    return this.execute(operation, options);
  }

  private calculateDelay(attempt: number, options: RetryOptions): number {
    const delay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 0.1 * delay;
    return Math.min(delay + jitter, options.maxDelay);
  }

  private isRetryableError(error: any, retryableErrors: string[]): boolean {
    const errorMessage = error.message || error.toString();
    return retryableErrors.some(pattern => errorMessage.includes(pattern));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async executeWithFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    try {
      return await this.execute(primary, options);
    } catch (error) {
      console.warn('Primary operation failed, using fallback:', error);
      return await fallback();
    }
  }

  public async executeBatch<T>(
    operations: Array<() => Promise<T>>,
    options: Partial<RetryOptions> = {}
  ): Promise<T[]> {
    return Promise.all(operations.map(op => this.execute(op, options)));
  }

  public async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    return this.execute(async () => {
      return Promise.race([
        operation(),
        this.createTimeoutPromise(timeoutMs),
      ]);
    }, options);
  }

  private createTimeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
    });
  }
}

export const retryService = new RetryService();
