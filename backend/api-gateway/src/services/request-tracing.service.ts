import { v4 as uuidv4 } from 'uuid';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: number;
  service: string;
  operation: string;
  duration?: number;
  tags: Record<string, any>;
  logs: Array<{ timestamp: number; message: string; level: string }>;
}

export class RequestTracingService {
  private traces: Map<string, TraceContext> = new Map();
  private maxTraces: number = 10000;

  createTrace(service: string, operation: string, parentSpanId?: string): TraceContext {
    const trace: TraceContext = {
      traceId: uuidv4(),
      spanId: uuidv4(),
      parentSpanId,
      timestamp: Date.now(),
      service,
      operation,
      tags: {},
      logs: []
    };

    this.traces.set(trace.traceId, trace);
    this.cleanupOldTraces();

    return trace;
  }

  addTag(traceId: string, key: string, value: any): void {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.tags[key] = value;
    }
  }

  addLog(traceId: string, message: string, level: string = 'info'): void {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.logs.push({
        timestamp: Date.now(),
        message,
        level
      });
    }
  }

  finishTrace(traceId: string): void {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.duration = Date.now() - trace.timestamp;
    }
  }

  getTrace(traceId: string): TraceContext | undefined {
    return this.traces.get(traceId);
  }

  getTracesByService(service: string): TraceContext[] {
    return Array.from(this.traces.values()).filter(t => t.service === service);
  }

  private cleanupOldTraces(): void {
    if (this.traces.size > this.maxTraces) {
      const sortedTraces = Array.from(this.traces.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = sortedTraces.slice(0, this.traces.size - this.maxTraces);
      toDelete.forEach(([traceId]) => this.traces.delete(traceId));
    }
  }

  exportTraces(): TraceContext[] {
    return Array.from(this.traces.values());
  }

  clear(): void {
    this.traces.clear();
  }
}

export const tracingService = new RequestTracingService();
