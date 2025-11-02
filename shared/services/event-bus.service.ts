import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface DomainEvent {
  id: string;
  type: string;
  timestamp: Date;
  payload: any;
  metadata?: Record<string, any>;
}

export class EventBusService extends EventEmitter {
  private static instance: EventBusService;
  private eventHistory: DomainEvent[] = [];
  private maxHistorySize = 1000;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): EventBusService {
    if (!EventBusService.instance) {
      EventBusService.instance = new EventBusService();
    }
    return EventBusService.instance;
  }

  publish(event: Omit<DomainEvent, 'id' | 'timestamp'>): void {
    const domainEvent: DomainEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
    };

    this.eventHistory.push(domainEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    this.emit(event.type, domainEvent);
    this.emit('*', domainEvent);

    logger.debug('Event published', { type: event.type, id: domainEvent.id });
  }

  subscribe(eventType: string, handler: (event: DomainEvent) => void): void {
    this.on(eventType, handler);
    logger.debug('Subscribed to event', { eventType });
  }

  subscribeAll(handler: (event: DomainEvent) => void): void {
    this.on('*', handler);
    logger.debug('Subscribed to all events');
  }

  unsubscribe(eventType: string, handler: (event: DomainEvent) => void): void {
    this.off(eventType, handler);
    logger.debug('Unsubscribed from event', { eventType });
  }

  getEventHistory(eventType?: string, limit: number = 100): DomainEvent[] {
    let events = this.eventHistory;
    
    if (eventType) {
      events = events.filter(e => e.type === eventType);
    }

    return events.slice(-limit);
  }

  clearHistory(): void {
    this.eventHistory = [];
    logger.info('Event history cleared');
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const eventBus = EventBusService.getInstance();
