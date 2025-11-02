export interface DeviceShadow {
  deviceId: string;
  reported: any;
  desired: any;
  metadata: {
    reported: Record<string, { timestamp: number }>;
    desired: Record<string, { timestamp: number }>;
  };
  version: number;
  timestamp: Date;
}

export class DeviceShadowService {
  private shadows: Map<string, DeviceShadow> = new Map();

  async getShadow(deviceId: string): Promise<DeviceShadow | null> {
    return this.shadows.get(deviceId) || null;
  }

  async updateReportedState(deviceId: string, state: any): Promise<DeviceShadow> {
    const shadow = this.shadows.get(deviceId) || this.createShadow(deviceId);
    
    shadow.reported = { ...shadow.reported, ...state };
    shadow.metadata.reported = this.updateMetadata(shadow.metadata.reported, state);
    shadow.version++;
    shadow.timestamp = new Date();

    this.shadows.set(deviceId, shadow);
    await this.reconcileState(deviceId);
    
    return shadow;
  }

  async updateDesiredState(deviceId: string, state: any): Promise<DeviceShadow> {
    const shadow = this.shadows.get(deviceId) || this.createShadow(deviceId);
    
    shadow.desired = { ...shadow.desired, ...state };
    shadow.metadata.desired = this.updateMetadata(shadow.metadata.desired, state);
    shadow.version++;
    shadow.timestamp = new Date();

    this.shadows.set(deviceId, shadow);
    
    return shadow;
  }

  private createShadow(deviceId: string): DeviceShadow {
    return {
      deviceId,
      reported: {},
      desired: {},
      metadata: {
        reported: {},
        desired: {}
      },
      version: 1,
      timestamp: new Date()
    };
  }

  private updateMetadata(metadata: Record<string, { timestamp: number }>, state: any): Record<string, { timestamp: number }> {
    const updated = { ...metadata };
    Object.keys(state).forEach(key => {
      updated[key] = { timestamp: Date.now() };
    });
    return updated;
  }

  private async reconcileState(deviceId: string): Promise<void> {
    const shadow = this.shadows.get(deviceId);
    if (!shadow) return;

    const delta = this.calculateDelta(shadow.desired, shadow.reported);
    if (Object.keys(delta).length > 0) {
      console.log(`Shadow delta for ${deviceId}:`, delta);
    }
  }

  private calculateDelta(desired: any, reported: any): any {
    const delta = {};
    Object.keys(desired).forEach(key => {
      if (JSON.stringify(desired[key]) !== JSON.stringify(reported[key])) {
        delta[key] = desired[key];
      }
    });
    return delta;
  }

  async deleteShadow(deviceId: string): Promise<void> {
    this.shadows.delete(deviceId);
  }

  async getShadowDelta(deviceId: string): Promise<any> {
    const shadow = this.shadows.get(deviceId);
    if (!shadow) return null;
    return this.calculateDelta(shadow.desired, shadow.reported);
  }
}
