import { logger } from '../utils/logger';

interface QueueItem<T> {
  id: string;
  data: T;
  priority: number;
  timestamp: Date;
  retries: number;
  maxRetries: number;
}

interface QueueConfig {
  maxSize: number;
  maxRetries: number;
  retryDelay: number;
  processingConcurrency: number;
}

export class QueueService<T> {
  private queue: QueueItem<T>[] = [];
  private processing = false;
  private activeProcessing = 0;
  private config: QueueConfig;

  constructor(
    private name: string,
    private processor: (data: T) => Promise<void>,
    config: Partial<QueueConfig> = {}
  ) {
    this.config = {
      maxSize: config.maxSize || 1000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      processingConcurrency: config.processingConcurrency || 5,
    };
  }

  async enqueue(data: T, priority: number = 0): Promise<string> {
    if (this.queue.length >= this.config.maxSize) {
      throw new Error(`Queue ${this.name} is full`);
    }

    const item: QueueItem<T> = {
      id: this.generateId(),
      data,
      priority,
      timestamp: new Date(),
      retries: 0,
      maxRetries: this.config.maxRetries,
    };

    this.queue.push(item);
    this.queue.sort((a, b) => b.priority - a.priority);

    logger.debug('Item enqueued', { queue: this.name, id: item.id });

    if (!this.processing) {
      this.startProcessing();
    }

    return item.id;
  }

  private async startProcessing(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0 || this.activeProcessing > 0) {
      while (
        this.queue.length > 0 &&
        this.activeProcessing < this.config.processingConcurrency
      ) {
        const item = this.queue.shift();
        if (item) {
          this.processItem(item);
        }
      }

      await this.sleep(100);
    }

    this.processing = false;
  }

  private async processItem(item: QueueItem<T>): Promise<void> {
    this.activeProcessing++;

    try {
      await this.processor(item.data);
      logger.debug('Item processed successfully', {
        queue: this.name,
        id: item.id,
      });
    } catch (error: any) {
      logger.error('Item processing failed', {
        queue: this.name,
        id: item.id,
        error: error.message,
      });

      if (item.retries < item.maxRetries) {
        item.retries++;
        await this.sleep(this.config.retryDelay * item.retries);
        this.queue.push(item);
        logger.info('Item requeued for retry', {
          queue: this.name,
          id: item.id,
          retry: item.retries,
        });
      } else {
        logger.error('Item exceeded max retries', {
          queue: this.name,
          id: item.id,
        });
      }
    } finally {
      this.activeProcessing--;
    }
  }

  getSize(): number {
    return this.queue.length;
  }

  getActiveProcessing(): number {
    return this.activeProcessing;
  }

  clear(): void {
    this.queue = [];
    logger.info('Queue cleared', { queue: this.name });
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
