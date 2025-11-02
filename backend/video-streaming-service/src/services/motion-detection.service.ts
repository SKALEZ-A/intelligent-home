export interface MotionEvent {
  id: string;
  cameraId: string;
  timestamp: Date;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  snapshotUrl?: string;
  videoClipUrl?: string;
}

export interface MotionZone {
  id: string;
  cameraId: string;
  name: string;
  coordinates: Array<{ x: number; y: number }>;
  sensitivity: number;
  enabled: boolean;
}

export class MotionDetectionService {
  private motionEvents: Map<string, MotionEvent[]> = new Map();
  private motionZones: Map<string, MotionZone[]> = new Map();
  private detectionThreshold: number = 0.7;

  async detectMotion(cameraId: string, frameData: Buffer): Promise<MotionEvent | null> {
    const zones = this.motionZones.get(cameraId) || [];
    const enabledZones = zones.filter(z => z.enabled);

    if (enabledZones.length === 0) {
      return this.performGlobalMotionDetection(cameraId, frameData);
    }

    for (const zone of enabledZones) {
      const motion = await this.detectMotionInZone(cameraId, frameData, zone);
      if (motion) return motion;
    }

    return null;
  }

  private async performGlobalMotionDetection(cameraId: string, frameData: Buffer): Promise<MotionEvent | null> {
    const hasMotion = Math.random() > 0.7;
    
    if (!hasMotion) return null;

    const event: MotionEvent = {
      id: this.generateEventId(),
      cameraId,
      timestamp: new Date(),
      confidence: 0.85,
      boundingBox: {
        x: Math.floor(Math.random() * 800),
        y: Math.floor(Math.random() * 600),
        width: 100,
        height: 150
      }
    };

    this.storeMotionEvent(cameraId, event);
    return event;
  }

  private async detectMotionInZone(cameraId: string, frameData: Buffer, zone: MotionZone): Promise<MotionEvent | null> {
    const hasMotion = Math.random() > (1 - zone.sensitivity);
    
    if (!hasMotion) return null;

    const event: MotionEvent = {
      id: this.generateEventId(),
      cameraId,
      timestamp: new Date(),
      confidence: zone.sensitivity,
      boundingBox: this.calculateBoundingBox(zone.coordinates)
    };

    this.storeMotionEvent(cameraId, event);
    return event;
  }

  private calculateBoundingBox(coordinates: Array<{ x: number; y: number }>): any {
    const xs = coordinates.map(c => c.x);
    const ys = coordinates.map(c => c.y);
    
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  }

  private storeMotionEvent(cameraId: string, event: MotionEvent): void {
    const events = this.motionEvents.get(cameraId) || [];
    events.push(event);
    
    if (events.length > 1000) {
      events.shift();
    }
    
    this.motionEvents.set(cameraId, events);
  }

  private generateEventId(): string {
    return `motion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async addMotionZone(zone: Omit<MotionZone, 'id'>): Promise<MotionZone> {
    const newZone: MotionZone = {
      ...zone,
      id: this.generateZoneId()
    };

    const zones = this.motionZones.get(zone.cameraId) || [];
    zones.push(newZone);
    this.motionZones.set(zone.cameraId, zones);

    return newZone;
  }

  async removeMotionZone(cameraId: string, zoneId: string): Promise<boolean> {
    const zones = this.motionZones.get(cameraId);
    if (!zones) return false;

    const filtered = zones.filter(z => z.id !== zoneId);
    if (filtered.length === zones.length) return false;

    this.motionZones.set(cameraId, filtered);
    return true;
  }

  async getMotionZones(cameraId: string): Promise<MotionZone[]> {
    return this.motionZones.get(cameraId) || [];
  }

  async getMotionEvents(cameraId: string, startTime?: Date, endTime?: Date): Promise<MotionEvent[]> {
    const events = this.motionEvents.get(cameraId) || [];
    
    if (!startTime && !endTime) return events;

    return events.filter(event => {
      if (startTime && event.timestamp < startTime) return false;
      if (endTime && event.timestamp > endTime) return false;
      return true;
    });
  }

  async getMotionStatistics(cameraId: string, timeRange: { start: Date; end: Date }): Promise<any> {
    const events = await this.getMotionEvents(cameraId, timeRange.start, timeRange.end);
    
    return {
      totalEvents: events.length,
      averageConfidence: events.reduce((sum, e) => sum + e.confidence, 0) / events.length || 0,
      eventsPerHour: this.calculateEventsPerHour(events, timeRange),
      peakHours: this.calculatePeakHours(events)
    };
  }

  private calculateEventsPerHour(events: MotionEvent[], timeRange: { start: Date; end: Date }): number {
    const hours = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60);
    return events.length / hours;
  }

  private calculatePeakHours(events: MotionEvent[]): number[] {
    const hourCounts = new Array(24).fill(0);
    
    events.forEach(event => {
      const hour = event.timestamp.getHours();
      hourCounts[hour]++;
    });

    const maxCount = Math.max(...hourCounts);
    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(h => h.count === maxCount)
      .map(h => h.hour);
  }

  private generateZoneId(): string {
    return `zone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
