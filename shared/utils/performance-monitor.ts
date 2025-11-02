import { EventEmitter } from 'events';

interface PerformanceEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: any;
}

interface PerformanceMetrics {
  name: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p50: number;
  p95: number;
  p99: number;
}

export class PerformanceMonitor extends EventEmitter {
  private entries: Map<string, PerformanceEntry[]> = new Map();
  private activeTimers: Map<string, number> = new Map();
  private readonly maxEntriesPerName = 1000;

  public startTimer(name: string, metadata?: any): string {
    const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const entry: PerformanceEntry = {
      name,
      startTime: Date.now(),
      metadata
    };

    const entries = this.entries.get(name) || [];
    entries.push(entry);

    if (entries.length > this.maxEntriesPerName) {
      entries.shift();
    }

    this.entries.set(name, entries);
    this.activeTimers.set(timerId, entries.length - 1);

    return timerId;
  }

  public endTimer(timerId: string): number | null {
    const parts = timerId.split('_');
    const name = parts[0];
    const index = this.activeTimers.get(timerId);

    if (index === undefined) {
      return null;
    }

    const entries = this.entries.get(name);
    if (!entries || !entries[index]) {
      return null;
    }

    const entry = entries[index];
    entry.endTime = Date.now();
    entry.duration = entry.endTime - entry.startTime;

    this.activeTimers.delete(timerId);
    this.emit('timerEnded', { name, duration: entry.duration });

    return entry.duration;
  }

  public measure(name: string, fn: () => any): any {
    const timerId = this.startTimer(name);
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result.finally(() => this.endTimer(timerId));
      }
      
      this.endTimer(timerId);
      return result;
    } catch (error) {
      this.endTimer(timerId);
      throw error;
    }
  }

  public async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const timerId = this.startTimer(name);
    
    try {
      const result = await fn();
      this.endTimer(timerId);
      return result;
    } catch (error) {
      this.endTimer(timerId);
      throw error;
    }
  }

  public getMetrics(name: string): PerformanceMetrics | null {
    const entries = this.entries.get(name);
    
    if (!entries || entries.length === 0) {
      return null;
    }

    const completedEntries = entries.filter(e => e.duration !== undefined);
    
    if (completedEntries.length === 0) {
      return null;
    }

    const durations = completedEntries.map(e => e.duration!).sort((a, b) => a - b);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    return {
      name,
      count: completedEntries.length,
      totalDuration,
      averageDuration: totalDuration / completedEntries.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p50: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99)
    };
  }

  private percentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  public getAllMetrics(): PerformanceMetrics[] {
    const allMetrics: PerformanceMetrics[] = [];

    for (const name of this.entries.keys()) {
      const metrics = this.getMetrics(name);
      if (metrics) {
        allMetrics.push(metrics);
      }
    }

    return allMetrics.sort((a, b) => b.totalDuration - a.totalDuration);
  }

  public clear(name?: string): void {
    if (name) {
      this.entries.delete(name);
    } else {
      this.entries.clear();
      this.activeTimers.clear();
    }
  }

  public getSlowestOperations(limit: number = 10): Array<{
    name: string;
    duration: number;
    timestamp: number;
  }> {
    const allEntries: Array<{ name: string; entry: PerformanceEntry }> = [];

    for (const [name, entries] of this.entries.entries()) {
      entries.forEach(entry => {
        if (entry.duration !== undefined) {
          allEntries.push({ name, entry });
        }
      });
    }

    return allEntries
      .sort((a, b) => (b.entry.duration || 0) - (a.entry.duration || 0))
      .slice(0, limit)
      .map(({ name, entry }) => ({
        name,
        duration: entry.duration!,
        timestamp: entry.startTime
      }));
  }
}

export const performanceMonitor = new PerformanceMonitor();
