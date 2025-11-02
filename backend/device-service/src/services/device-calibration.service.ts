import { logger } from '../../../../shared/utils/logger';

interface CalibrationProfile {
  deviceId: string;
  sensorType: string;
  offset: number;
  scale: number;
  lastCalibrated: Date;
  calibrationPoints: CalibrationPoint[];
}

interface CalibrationPoint {
  reference: number;
  measured: number;
  timestamp: Date;
}

export class DeviceCalibrationService {
  private calibrationProfiles: Map<string, CalibrationProfile> = new Map();

  public async calibrateDevice(
    deviceId: string,
    sensorType: string,
    calibrationPoints: Omit<CalibrationPoint, 'timestamp'>[]
  ): Promise<CalibrationProfile> {
    const points: CalibrationPoint[] = calibrationPoints.map(p => ({
      ...p,
      timestamp: new Date()
    }));

    const { offset, scale } = this.calculateCalibration(points);

    const profile: CalibrationProfile = {
      deviceId,
      sensorType,
      offset,
      scale,
      lastCalibrated: new Date(),
      calibrationPoints: points
    };

    this.calibrationProfiles.set(`${deviceId}:${sensorType}`, profile);
    logger.info('Device calibrated', { deviceId, sensorType, offset, scale });

    return profile;
  }

  public applyCalibratio(deviceId: string, sensorType: string, rawValue: number): number {
    const key = `${deviceId}:${sensorType}`;
    const profile = this.calibrationProfiles.get(key);

    if (!profile) {
      return rawValue;
    }

    return (rawValue * profile.scale) + profile.offset;
  }

  public getCalibrationProfile(deviceId: string, sensorType: string): CalibrationProfile | undefined {
    return this.calibrationProfiles.get(`${deviceId}:${sensorType}`);
  }

  private calculateCalibration(points: CalibrationPoint[]): { offset: number; scale: number } {
    if (points.length < 2) {
      return { offset: 0, scale: 1 };
    }

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = points.length;

    for (const point of points) {
      sumX += point.measured;
      sumY += point.reference;
      sumXY += point.measured * point.reference;
      sumX2 += point.measured * point.measured;
    }

    const scale = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const offset = (sumY - scale * sumX) / n;

    return { offset, scale };
  }
}
