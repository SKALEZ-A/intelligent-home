interface UserBehaviorPattern {
  userId: string;
  action: string;
  context: Record<string, any>;
  timestamp: Date;
  frequency: number;
}

interface PredictedAction {
  action: string;
  confidence: number;
  suggestedTime: Date;
  reasoning: string[];
}

export class PredictiveAutomationService {
  private patterns: Map<string, UserBehaviorPattern[]> = new Map();
  private predictions: Map<string, PredictedAction[]> = new Map();

  async recordBehavior(
    userId: string,
    action: string,
    context: Record<string, any>
  ): Promise<void> {
    const userPatterns = this.patterns.get(userId) || [];
    
    const existingPattern = userPatterns.find(
      p => p.action === action && this.contextsMatch(p.context, context)
    );

    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.timestamp = new Date();
    } else {
      userPatterns.push({
        userId,
        action,
        context,
        timestamp: new Date(),
        frequency: 1
      });
    }

    this.patterns.set(userId, userPatterns);
  }

  async predictNextActions(userId: string, currentContext: Record<string, any>): Promise<PredictedAction[]> {
    const userPatterns = this.patterns.get(userId) || [];
    const predictions: PredictedAction[] = [];

    for (const pattern of userPatterns) {
      if (pattern.frequency < 3) continue;

      const contextSimilarity = this.calculateContextSimilarity(pattern.context, currentContext);
      
      if (contextSimilarity > 0.7) {
        const confidence = contextSimilarity * (pattern.frequency / 10);
        
        predictions.push({
          action: pattern.action,
          confidence: Math.min(confidence, 1.0),
          suggestedTime: this.predictTime(pattern),
          reasoning: this.generateReasoning(pattern, contextSimilarity)
        });
      }
    }

    predictions.sort((a, b) => b.confidence - a.confidence);
    this.predictions.set(userId, predictions);

    return predictions.slice(0, 5);
  }

  private contextsMatch(context1: Record<string, any>, context2: Record<string, any>): boolean {
    const keys1 = Object.keys(context1);
    const keys2 = Object.keys(context2);

    if (keys1.length !== keys2.length) return false;

    return keys1.every(key => context1[key] === context2[key]);
  }

  private calculateContextSimilarity(context1: Record<string, any>, context2: Record<string, any>): number {
    const allKeys = new Set([...Object.keys(context1), ...Object.keys(context2)]);
    let matches = 0;

    allKeys.forEach(key => {
      if (context1[key] === context2[key]) {
        matches++;
      }
    });

    return matches / allKeys.size;
  }

  private predictTime(pattern: UserBehaviorPattern): Date {
    const now = new Date();
    const patternHour = pattern.timestamp.getHours();
    const predictedTime = new Date(now);
    predictedTime.setHours(patternHour);
    predictedTime.setMinutes(pattern.timestamp.getMinutes());

    return predictedTime;
  }

  private generateReasoning(pattern: UserBehaviorPattern, similarity: number): string[] {
    return [
      `Action performed ${pattern.frequency} times previously`,
      `Context similarity: ${(similarity * 100).toFixed(0)}%`,
      `Typical time: ${pattern.timestamp.toLocaleTimeString()}`
    ];
  }

  async getUserPredictions(userId: string): Promise<PredictedAction[]> {
    return this.predictions.get(userId) || [];
  }
}

export const predictiveAutomationService = new PredictiveAutomationService();
