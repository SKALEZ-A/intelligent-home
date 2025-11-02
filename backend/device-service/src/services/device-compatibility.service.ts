import { logger } from '../../../../shared/utils/logger';

interface DeviceProtocol {
  name: string;
  version: string;
  features: string[];
}

interface CompatibilityRule {
  protocol: string;
  minVersion: string;
  maxVersion?: string;
  requiredFeatures?: string[];
  incompatibleWith?: string[];
}

interface DeviceCapability {
  name: string;
  supported: boolean;
  version?: string;
}

export class DeviceCompatibilityService {
  private compatibilityRules: Map<string, CompatibilityRule[]> = new Map();
  private protocolVersions: Map<string, string[]> = new Map();

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    // Zigbee compatibility rules
    this.compatibilityRules.set('zigbee', [
      {
        protocol: 'zigbee',
        minVersion: '3.0',
        requiredFeatures: ['binding', 'reporting']
      }
    ]);

    // Z-Wave compatibility rules
    this.compatibilityRules.set('zwave', [
      {
        protocol: 'zwave',
        minVersion: '5.0',
        requiredFeatures: ['security', 'association']
      }
    ]);

    // Matter compatibility rules
    this.compatibilityRules.set('matter', [
      {
        protocol: 'matter',
        minVersion: '1.0',
        requiredFeatures: ['commissioning', 'operational_credentials']
      }
    ]);

    // Thread compatibility rules
    this.compatibilityRules.set('thread', [
      {
        protocol: 'thread',
        minVersion: '1.1',
        requiredFeatures: ['border_router', 'mesh_networking']
      }
    ]);

    logger.info('Device compatibility rules initialized');
  }

  public async checkCompatibility(
    deviceProtocol: DeviceProtocol,
    hubProtocols: DeviceProtocol[]
  ): Promise<{ compatible: boolean; issues: string[]; recommendations: string[] }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if hub supports the device protocol
    const supportedProtocol = hubProtocols.find(p => p.name === deviceProtocol.name);
    
    if (!supportedProtocol) {
      issues.push(`Hub does not support ${deviceProtocol.name} protocol`);
      return { compatible: false, issues, recommendations };
    }

    // Check version compatibility
    const versionCompatible = this.compareVersions(
      supportedProtocol.version,
      deviceProtocol.version
    );

    if (!versionCompatible) {
      issues.push(
        `Protocol version mismatch: Hub ${supportedProtocol.version}, Device ${deviceProtocol.version}`
      );
      recommendations.push('Consider updating hub firmware');
    }

    // Check required features
    const rules = this.compatibilityRules.get(deviceProtocol.name) || [];
    
    for (const rule of rules) {
      if (rule.requiredFeatures) {
        const missingFeatures = rule.requiredFeatures.filter(
          feature => !deviceProtocol.features.includes(feature)
        );

        if (missingFeatures.length > 0) {
          issues.push(`Missing required features: ${missingFeatures.join(', ')}`);
        }
      }

      // Check incompatibilities
      if (rule.incompatibleWith) {
        const conflicts = hubProtocols.filter(p =>
          rule.incompatibleWith!.includes(p.name)
        );

        if (conflicts.length > 0) {
          issues.push(
            `Protocol conflicts detected with: ${conflicts.map(c => c.name).join(', ')}`
          );
        }
      }
    }

    // Generate recommendations
    if (issues.length === 0) {
      recommendations.push('Device is fully compatible');
    } else if (issues.length <= 2) {
      recommendations.push('Device may work with limited functionality');
    }

    return {
      compatible: issues.length === 0,
      issues,
      recommendations
    };
  }

  public async getDeviceCapabilities(
    deviceType: string,
    protocol: string
  ): Promise<DeviceCapability[]> {
    const capabilities: DeviceCapability[] = [];

    // Define capabilities based on device type and protocol
    const capabilityMap: Record<string, string[]> = {
      light: ['on_off', 'brightness', 'color_temperature', 'color_rgb'],
      switch: ['on_off', 'power_monitoring'],
      sensor: ['temperature', 'humidity', 'motion', 'battery'],
      thermostat: ['heating', 'cooling', 'fan', 'temperature_setpoint'],
      lock: ['lock_unlock', 'auto_lock', 'pin_codes'],
      camera: ['video_stream', 'motion_detection', 'night_vision', 'two_way_audio']
    };

    const baseCapabilities = capabilityMap[deviceType] || [];

    baseCapabilities.forEach(cap => {
      capabilities.push({
        name: cap,
        supported: true,
        version: '1.0'
      });
    });

    return capabilities;
  }

  public async validateFirmwareUpdate(
    currentVersion: string,
    targetVersion: string,
    deviceType: string
  ): Promise<{ valid: boolean; warnings: string[] }> {
    const warnings: string[] = [];

    // Check if downgrade
    if (this.compareVersions(currentVersion, targetVersion) > 0) {
      warnings.push('Firmware downgrade detected - may cause issues');
    }

    // Check version jump
    const versionDiff = this.getVersionDifference(currentVersion, targetVersion);
    if (versionDiff > 2) {
      warnings.push('Large version jump - consider intermediate updates');
    }

    // Device-specific checks
    if (deviceType === 'lock' && warnings.length > 0) {
      warnings.push('Security device update - ensure backup access method');
    }

    return {
      valid: warnings.length === 0,
      warnings
    };
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1 = v1Parts[i] || 0;
      const v2 = v2Parts[i] || 0;

      if (v1 > v2) return 1;
      if (v1 < v2) return -1;
    }

    return 0;
  }

  private getVersionDifference(version1: string, version2: string): number {
    const v1Major = parseInt(version1.split('.')[0]);
    const v2Major = parseInt(version2.split('.')[0]);
    return Math.abs(v2Major - v1Major);
  }

  public getSupportedProtocols(): string[] {
    return Array.from(this.compatibilityRules.keys());
  }

  public getProtocolFeatures(protocol: string): string[] {
    const rules = this.compatibilityRules.get(protocol);
    if (!rules || rules.length === 0) return [];

    const features = new Set<string>();
    rules.forEach(rule => {
      rule.requiredFeatures?.forEach(f => features.add(f));
    });

    return Array.from(features);
  }
}

export const deviceCompatibilityService = new DeviceCompatibilityService();
