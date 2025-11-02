interface UserBehavior {
  userId: string;
  timestamp: Date;
  action: string;
  deviceIds: string[];
  context: {
    timeOfDay: string;
    dayOfWeek: string;
    weather?: string;
    occupancy?: number;
  };
}

interface SceneRecommendation {
  sceneId: string;
  name: string;
  description: string;
  confidence: number;
  reason: string;
  devices: string[];
  actions: any[];
}

export class SceneRecommendationService {
  private behaviorHistory: Map<string, UserBehavior[]>;
  private scenePatterns: Map<string, any>;

  constructor() {
    this.behaviorHistory = new Map();
    this.scenePatterns = new Map();
  }

  public async recordBehavior(behavior: UserBehavior): Promise<void> {
    if (!this.behaviorHistory.has(behavior.userId)) {
      this.behaviorHistory.set(behavior.userId, []);
    }

    const history = this.behaviorHistory.get(behavior.userId)!;
    history.push(behavior);

    if (history.length > 1000) {
      history.shift();
    }

    await this.analyzePatterns(behavior.userId);
  }

  private async analyzePatterns(userId: string): Promise<void> {
    const history = this.behaviorHistory.get(userId) || [];
    if (history.length < 10) return;

    const patterns = this.extractPatterns(history);
    this.scenePatterns.set(userId, patterns);
  }

  private extractPatterns(history: UserBehavior[]): any {
    const patterns: any = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
      weekday: [],
      weekend: [],
    };

    history.forEach(behavior => {
      const hour = new Date(behavior.timestamp).getHours();
      let timeOfDay: string;

      if (hour >= 6 && hour < 12) timeOfDay = 'morning';
      else if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';
      else if (hour >= 18 && hour < 22) timeOfDay = 'evening';
      else timeOfDay = 'night';

      patterns[timeOfDay].push(behavior);

      const dayOfWeek = new Date(behavior.timestamp).getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        patterns.weekday.push(behavior);
      } else {
        patterns.weekend.push(behavior);
      }
    });

    return patterns;
  }

  public async getRecommendations(userId: string, context: any): Promise<SceneRecommendation[]> {
    const patterns = this.scenePatterns.get(userId);
    if (!patterns) return [];

    const recommendations: SceneRecommendation[] = [];
    const hour = new Date().getHours();
    let timeOfDay: string;

    if (hour >= 6 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 18) timeOfDay = 'afternoon';
    else if (hour >= 18 && hour < 22) timeOfDay = 'evening';
    else timeOfDay = 'night';

    const relevantBehaviors = patterns[timeOfDay] || [];
    const deviceFrequency = this.calculateDeviceFrequency(relevantBehaviors);

    if (timeOfDay === 'morning' && deviceFrequency.size > 0) {
      recommendations.push({
        sceneId: 'morning_routine',
        name: 'Morning Routine',
        description: 'Start your day with your usual morning setup',
        confidence: 0.85,
        reason: 'Based on your morning patterns',
        devices: Array.from(deviceFrequency.keys()).slice(0, 5),
        actions: this.generateActions(deviceFrequency),
      });
    }

    if (timeOfDay === 'evening' && deviceFrequency.size > 0) {
      recommendations.push({
        sceneId: 'evening_routine',
        name: 'Evening Wind Down',
        description: 'Relax with your typical evening setup',
        confidence: 0.80,
        reason: 'Based on your evening patterns',
        devices: Array.from(deviceFrequency.keys()).slice(0, 5),
        actions: this.generateActions(deviceFrequency),
      });
    }

    return recommendations;
  }

  private calculateDeviceFrequency(behaviors: UserBehavior[]): Map<string, number> {
    const frequency = new Map<string, number>();

    behaviors.forEach(behavior => {
      behavior.deviceIds.forEach(deviceId => {
        frequency.set(deviceId, (frequency.get(deviceId) || 0) + 1);
      });
    });

    return new Map([...frequency.entries()].sort((a, b) => b[1] - a[1]));
  }

  private generateActions(deviceFrequency: Map<string, number>): any[] {
    const actions: any[] = [];

    deviceFrequency.forEach((frequency, deviceId) => {
      actions.push({
        deviceId,
        action: 'turnOn',
        priority: frequency,
      });
    });

    return actions;
  }

  public async getSimilarScenes(sceneId: string): Promise<any[]> {
    return [];
  }

  public async getPopularScenes(limit: number = 10): Promise<any[]> {
    return [];
  }
}
