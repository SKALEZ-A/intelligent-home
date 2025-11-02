export interface GeoLocation {
  ip: string;
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface GeoBlockingRule {
  id: string;
  type: 'allow' | 'block';
  countries: string[];
  regions?: string[];
  enabled: boolean;
  createdAt: Date;
}

export class GeoBlockingService {
  private rules: Map<string, GeoBlockingRule> = new Map();
  private locationCache: Map<string, GeoLocation> = new Map();

  async addRule(rule: Omit<GeoBlockingRule, 'id' | 'createdAt'>): Promise<GeoBlockingRule> {
    const newRule: GeoBlockingRule = {
      ...rule,
      id: this.generateRuleId(),
      createdAt: new Date()
    };

    this.rules.set(newRule.id, newRule);
    return newRule;
  }

  async removeRule(ruleId: string): Promise<boolean> {
    return this.rules.delete(ruleId);
  }

  async isAccessAllowed(ip: string): Promise<{ allowed: boolean; reason?: string }> {
    const location = await this.getLocation(ip);
    if (!location) {
      return { allowed: true, reason: 'Location unknown' };
    }

    const activeRules = Array.from(this.rules.values()).filter(r => r.enabled);
    
    for (const rule of activeRules) {
      const matchesCountry = rule.countries.includes(location.country);
      const matchesRegion = !rule.regions || rule.regions.includes(location.region);

      if (matchesCountry && matchesRegion) {
        if (rule.type === 'block') {
          return {
            allowed: false,
            reason: `Access blocked from ${location.country}`
          };
        }
      }
    }

    const hasAllowRules = activeRules.some(r => r.type === 'allow');
    if (hasAllowRules) {
      const isExplicitlyAllowed = activeRules.some(r => {
        return r.type === 'allow' && 
               r.countries.includes(location.country) &&
               (!r.regions || r.regions.includes(location.region));
      });

      if (!isExplicitlyAllowed) {
        return {
          allowed: false,
          reason: `Access not explicitly allowed from ${location.country}`
        };
      }
    }

    return { allowed: true };
  }

  async getLocation(ip: string): Promise<GeoLocation | null> {
    if (this.locationCache.has(ip)) {
      return this.locationCache.get(ip)!;
    }

    try {
      const location = await this.fetchLocationData(ip);
      this.locationCache.set(ip, location);
      return location;
    } catch (error) {
      console.error('Failed to fetch location:', error);
      return null;
    }
  }

  private async fetchLocationData(ip: string): Promise<GeoLocation> {
    return {
      ip,
      country: 'US',
      region: 'California',
      city: 'San Francisco',
      latitude: 37.7749,
      longitude: -122.4194,
      timezone: 'America/Los_Angeles'
    };
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getRules(): Promise<GeoBlockingRule[]> {
    return Array.from(this.rules.values());
  }

  async updateRule(ruleId: string, updates: Partial<GeoBlockingRule>): Promise<GeoBlockingRule | null> {
    const rule = this.rules.get(ruleId);
    if (!rule) return null;

    const updated = { ...rule, ...updates };
    this.rules.set(ruleId, updated);
    return updated;
  }

  async getBlockedCountries(): Promise<string[]> {
    const blockRules = Array.from(this.rules.values()).filter(
      r => r.type === 'block' && r.enabled
    );
    
    const countries = new Set<string>();
    blockRules.forEach(rule => {
      rule.countries.forEach(country => countries.add(country));
    });

    return Array.from(countries);
  }

  async getAllowedCountries(): Promise<string[]> {
    const allowRules = Array.from(this.rules.values()).filter(
      r => r.type === 'allow' && r.enabled
    );
    
    const countries = new Set<string>();
    allowRules.forEach(rule => {
      rule.countries.forEach(country => countries.add(country));
    });

    return Array.from(countries);
  }
}
