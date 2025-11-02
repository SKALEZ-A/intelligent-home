import { logger } from '../utils/logger';

interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  rolloutPercentage?: number;
  userWhitelist?: string[];
  userBlacklist?: string[];
  startDate?: Date;
  endDate?: Date;
}

export class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();

  constructor() {
    this.initializeFlags();
  }

  private initializeFlags(): void {
    const defaultFlags: FeatureFlag[] = [
      {
        name: 'voice_assistant',
        enabled: true,
        description: 'Enable voice assistant integration'
      },
      {
        name: 'ml_predictions',
        enabled: true,
        description: 'Enable ML-based predictions',
        rolloutPercentage: 100
      },
      {
        name: 'advanced_automation',
        enabled: true,
        description: 'Enable advanced automation features'
      },
      {
        name: 'energy_optimization',
        enabled: true,
        description: 'Enable energy optimization features'
      },
      {
        name: 'video_recording',
        enabled: true,
        description: 'Enable video recording for cameras'
      },
      {
        name: 'beta_features',
        enabled: false,
        description: 'Enable beta features',
        rolloutPercentage: 10
      }
    ];

    defaultFlags.forEach(flag => {
      this.flags.set(flag.name, flag);
    });

    logger.info('Feature flags initialized', { count: this.flags.size });
  }

  public isEnabled(flagName: string, userId?: string): boolean {
    const flag = this.flags.get(flagName);
    
    if (!flag) {
      logger.warn('Unknown feature flag', { flagName });
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    // Check date range
    const now = new Date();
    if (flag.startDate && now < flag.startDate) {
      return false;
    }
    if (flag.endDate && now > flag.endDate) {
      return false;
    }

    // Check user whitelist/blacklist
    if (userId) {
      if (flag.userBlacklist?.includes(userId)) {
        return false;
      }
      if (flag.userWhitelist?.includes(userId)) {
        return true;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && userId) {
      const hash = this.hashUserId(userId);
      const userPercentage = hash % 100;
      return userPercentage < flag.rolloutPercentage;
    }

    return true;
  }

  public setFlag(flagName: string, enabled: boolean): void {
    const flag = this.flags.get(flagName);
    if (flag) {
      flag.enabled = enabled;
      logger.info('Feature flag updated', { flagName, enabled });
    }
  }

  public createFlag(flag: FeatureFlag): void {
    this.flags.set(flag.name, flag);
    logger.info('Feature flag created', { flagName: flag.name });
  }

  public updateFlag(flagName: string, updates: Partial<FeatureFlag>): void {
    const flag = this.flags.get(flagName);
    if (flag) {
      Object.assign(flag, updates);
      logger.info('Feature flag updated', { flagName, updates });
    }
  }

  public deleteFlag(flagName: string): void {
    this.flags.delete(flagName);
    logger.info('Feature flag deleted', { flagName });
  }

  public listFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  public getFlag(flagName: string): FeatureFlag | undefined {
    return this.flags.get(flagName);
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  public setRolloutPercentage(flagName: string, percentage: number): void {
    const flag = this.flags.get(flagName);
    if (flag) {
      flag.rolloutPercentage = Math.max(0, Math.min(100, percentage));
      logger.info('Feature flag rollout updated', { flagName, percentage });
    }
  }

  public addToWhitelist(flagName: string, userId: string): void {
    const flag = this.flags.get(flagName);
    if (flag) {
      if (!flag.userWhitelist) {
        flag.userWhitelist = [];
      }
      if (!flag.userWhitelist.includes(userId)) {
        flag.userWhitelist.push(userId);
        logger.info('User added to feature flag whitelist', { flagName, userId });
      }
    }
  }

  public removeFromWhitelist(flagName: string, userId: string): void {
    const flag = this.flags.get(flagName);
    if (flag && flag.userWhitelist) {
      flag.userWhitelist = flag.userWhitelist.filter(id => id !== userId);
      logger.info('User removed from feature flag whitelist', { flagName, userId });
    }
  }
}

export const featureFlagService = new FeatureFlagService();
