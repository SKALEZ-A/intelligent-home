interface VideoFrame {
  timestamp: Date;
  frameNumber: number;
  objects: DetectedObject[];
  motionLevel: number;
  brightness: number;
}

interface DetectedObject {
  type: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  trackingId?: string;
}

interface AnalyticsEvent {
  type: 'motion' | 'person' | 'vehicle' | 'animal' | 'package';
  timestamp: Date;
  confidence: number;
  duration?: number;
  metadata: any;
}

export class VideoAnalyticsService {
  private eventHistory: AnalyticsEvent[];
  private objectTracking: Map<string, DetectedObject[]>;

  constructor() {
    this.eventHistory = [];
    this.objectTracking = new Map();
  }

  public async analyzeFrame(frame: VideoFrame): Promise<AnalyticsEvent[]> {
    const events: AnalyticsEvent[] = [];

    if (frame.motionLevel > 0.5) {
      events.push({
        type: 'motion',
        timestamp: frame.timestamp,
        confidence: frame.motionLevel,
        metadata: { frameNumber: frame.frameNumber },
      });
    }

    frame.objects.forEach(obj => {
      if (obj.type === 'person' && obj.confidence > 0.7) {
        events.push({
          type: 'person',
          timestamp: frame.timestamp,
          confidence: obj.confidence,
          metadata: { boundingBox: obj.boundingBox },
        });
      }

      if (obj.type === 'vehicle' && obj.confidence > 0.7) {
        events.push({
          type: 'vehicle',
          timestamp: frame.timestamp,
          confidence: obj.confidence,
          metadata: { boundingBox: obj.boundingBox },
        });
      }

      if (obj.trackingId) {
        this.updateObjectTracking(obj.trackingId, obj);
      }
    });

    events.forEach(event => this.eventHistory.push(event));

    if (this.eventHistory.length > 10000) {
      this.eventHistory = this.eventHistory.slice(-5000);
    }

    return events;
  }

  private updateObjectTracking(trackingId: string, obj: DetectedObject): void {
    if (!this.objectTracking.has(trackingId)) {
      this.objectTracking.set(trackingId, []);
    }

    const history = this.objectTracking.get(trackingId)!;
    history.push(obj);

    if (history.length > 100) {
      history.shift();
    }
  }

  public getEventHistory(type?: string, limit: number = 100): AnalyticsEvent[] {
    let events = this.eventHistory;

    if (type) {
      events = events.filter(e => e.type === type);
    }

    return events.slice(-limit);
  }

  public getActivitySummary(startTime: Date, endTime: Date): any {
    const events = this.eventHistory.filter(
      e => e.timestamp >= startTime && e.timestamp <= endTime
    );

    const summary = {
      totalEvents: events.length,
      motionEvents: events.filter(e => e.type === 'motion').length,
      personDetections: events.filter(e => e.type === 'person').length,
      vehicleDetections: events.filter(e => e.type === 'vehicle').length,
      animalDetections: events.filter(e => e.type === 'animal').length,
      packageDetections: events.filter(e => e.type === 'package').length,
      averageConfidence: events.reduce((sum, e) => sum + e.confidence, 0) / events.length,
    };

    return summary;
  }

  public getObjectTrajectory(trackingId: string): DetectedObject[] {
    return this.objectTracking.get(trackingId) || [];
  }

  public async detectLoitering(durationThreshold: number = 300000): Promise<any[]> {
    const loiteringEvents: any[] = [];
    const personEvents = this.eventHistory.filter(e => e.type === 'person');

    const timeWindows = new Map<number, AnalyticsEvent[]>();
    
    personEvents.forEach(event => {
      const windowKey = Math.floor(event.timestamp.getTime() / 60000);
      if (!timeWindows.has(windowKey)) {
        timeWindows.set(windowKey, []);
      }
      timeWindows.get(windowKey)!.push(event);
    });

    timeWindows.forEach((events, windowKey) => {
      if (events.length > 5) {
        const startTime = new Date(windowKey * 60000);
        const endTime = new Date((windowKey + 1) * 60000);
        
        loiteringEvents.push({
          startTime,
          endTime,
          detectionCount: events.length,
          averageConfidence: events.reduce((sum, e) => sum + e.confidence, 0) / events.length,
        });
      }
    });

    return loiteringEvents;
  }

  public async getHeatmap(width: number, height: number, gridSize: number = 10): Promise<number[][]> {
    const heatmap: number[][] = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));

    this.eventHistory.forEach(event => {
      if (event.metadata.boundingBox) {
        const box = event.metadata.boundingBox;
        const centerX = Math.floor((box.x + box.width / 2) / width * gridSize);
        const centerY = Math.floor((box.y + box.height / 2) / height * gridSize);

        if (centerX >= 0 && centerX < gridSize && centerY >= 0 && centerY < gridSize) {
          heatmap[centerY][centerX]++;
        }
      }
    });

    return heatmap;
  }

  public clearHistory(): void {
    this.eventHistory = [];
    this.objectTracking.clear();
  }
}
