import { logger } from '../../../../shared/utils/logger';
import { EventBusService } from '../../../../shared/services/event-bus.service';

interface Location {
  latitude: number;
  longitude: number;
}

interface Geofence {
  id: string;
  name: string;
  center: Location;
  radius: number; // in meters
  userId: string;
  enterActions: string[];
  exitActions: string[];
  enabled: boolean;
}

interface UserLocation {
  userId: string;
  location: Location;
  timestamp: Date;
  insideGeofences: string[];
}

export class GeofencingService {
  private geofences: Map<string, Geofence> = new Map();
  private userLocations: Map<string, UserLocation> = new Map();
  private readonly EARTH_RADIUS = 6371000; // meters

  constructor(private eventBus: EventBusService) {}

  public createGeofence(geofence: Geofence): void {
    this.geofences.set(geofence.id, geofence);
    logger.info('Geofence created', { 
      geofenceId: geofence.id, 
      name: geofence.name,
      radius: geofence.radius
    });
  }

  public updateGeofence(geofenceId: string, updates: Partial<Geofence>): void {
    const geofence = this.geofences.get(geofenceId);
    if (!geofence) {
      throw new Error(`Geofence not found: ${geofenceId}`);
    }

    Object.assign(geofence, updates);
    logger.info('Geofence updated', { geofenceId });
  }

  public deleteGeofence(geofenceId: string): void {
    this.geofences.delete(geofenceId);
    logger.info('Geofence deleted', { geofenceId });
  }

  public async updateUserLocation(userId: string, location: Location): Promise<void> {
    const previousLocation = this.userLocations.get(userId);
    const currentLocation: UserLocation = {
      userId,
      location,
      timestamp: new Date(),
      insideGeofences: []
    };

    // Check all geofences for this user
    const userGeofences = Array.from(this.geofences.values())
      .filter(g => g.userId === userId && g.enabled);

    for (const geofence of userGeofences) {
      const distance = this.calculateDistance(location, geofence.center);
      const isInside = distance <= geofence.radius;

      if (isInside) {
        currentLocation.insideGeofences.push(geofence.id);
      }

      // Check for enter/exit events
      const wasInside = previousLocation?.insideGeofences.includes(geofence.id) || false;

      if (isInside && !wasInside) {
        await this.handleGeofenceEnter(userId, geofence);
      } else if (!isInside && wasInside) {
        await this.handleGeofenceExit(userId, geofence);
      }
    }

    this.userLocations.set(userId, currentLocation);
  }

  private async handleGeofenceEnter(userId: string, geofence: Geofence): Promise<void> {
    logger.info('User entered geofence', { 
      userId, 
      geofenceId: geofence.id,
      geofenceName: geofence.name
    });

    await this.eventBus.publish('geofence.enter', {
      userId,
      geofenceId: geofence.id,
      geofenceName: geofence.name,
      timestamp: new Date()
    });

    // Execute enter actions
    for (const action of geofence.enterActions) {
      await this.executeAction(action, userId);
    }
  }

  private async handleGeofenceExit(userId: string, geofence: Geofence): Promise<void> {
    logger.info('User exited geofence', { 
      userId, 
      geofenceId: geofence.id,
      geofenceName: geofence.name
    });

    await this.eventBus.publish('geofence.exit', {
      userId,
      geofenceId: geofence.id,
      geofenceName: geofence.name,
      timestamp: new Date()
    });

    // Execute exit actions
    for (const action of geofence.exitActions) {
      await this.executeAction(action, userId);
    }
  }

  private async executeAction(actionId: string, userId: string): Promise<void> {
    // In production, execute actual automation actions
    logger.debug('Executing geofence action', { actionId, userId });
  }

  private calculateDistance(point1: Location, point2: Location): number {
    const lat1 = this.toRadians(point1.latitude);
    const lat2 = this.toRadians(point2.latitude);
    const deltaLat = this.toRadians(point2.latitude - point1.latitude);
    const deltaLon = this.toRadians(point2.longitude - point1.longitude);

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return this.EARTH_RADIUS * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  public getUserLocation(userId: string): UserLocation | undefined {
    return this.userLocations.get(userId);
  }

  public getGeofence(geofenceId: string): Geofence | undefined {
    return this.geofences.get(geofenceId);
  }

  public listGeofences(userId?: string): Geofence[] {
    let geofences = Array.from(this.geofences.values());

    if (userId) {
      geofences = geofences.filter(g => g.userId === userId);
    }

    return geofences;
  }

  public isUserInsideGeofence(userId: string, geofenceId: string): boolean {
    const userLocation = this.userLocations.get(userId);
    return userLocation?.insideGeofences.includes(geofenceId) || false;
  }

  public getActiveGeofences(userId: string): Geofence[] {
    const userLocation = this.userLocations.get(userId);
    if (!userLocation) return [];

    return userLocation.insideGeofences
      .map(id => this.geofences.get(id))
      .filter((g): g is Geofence => g !== undefined);
  }
}

export const geofencingService = new GeofencingService(new EventBusService());
