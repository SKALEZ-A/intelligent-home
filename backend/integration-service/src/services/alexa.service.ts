import { logger } from '../../../../shared/utils/logger';
import { EventBusService } from '../../../../shared/services/event-bus.service';

interface AlexaDevice {
  endpointId: string;
  friendlyName: string;
  description: string;
  manufacturerName: string;
  displayCategories: string[];
  capabilities: AlexaCapability[];
}

interface AlexaCapability {
  type: string;
  interface: string;
  version: string;
  properties?: {
    supported: Array<{ name: string }>;
    proactivelyReported: boolean;
    retrievable: boolean;
  };
}

export class AlexaService {
  constructor(private eventBus: EventBusService) {}

  public async handleDiscovery(): Promise<AlexaDevice[]> {
    logger.info('Alexa discovery request received');

    // Fetch all devices from device service
    const devices = await this.fetchDevices();

    return devices.map(device => this.mapDeviceToAlexa(device));
  }

  public async handlePowerControl(endpointId: string, powerState: 'ON' | 'OFF'): Promise<void> {
    logger.info('Alexa power control', { endpointId, powerState });

    await this.eventBus.publish('device.control', {
      deviceId: endpointId,
      action: powerState === 'ON' ? 'turn_on' : 'turn_off'
    });
  }

  public async handleBrightnessControl(endpointId: string, brightness: number): Promise<void> {
    logger.info('Alexa brightness control', { endpointId, brightness });

    await this.eventBus.publish('device.control', {
      deviceId: endpointId,
      action: 'set_brightness',
      parameters: { brightness }
    });
  }

  public async handleColorControl(endpointId: string, hue: number, saturation: number, brightness: number): Promise<void> {
    logger.info('Alexa color control', { endpointId, hue, saturation, brightness });

    await this.eventBus.publish('device.control', {
      deviceId: endpointId,
      action: 'set_color',
      parameters: { hue, saturation, brightness }
    });
  }

  public async handleThermostatControl(endpointId: string, targetTemperature: number, mode?: string): Promise<void> {
    logger.info('Alexa thermostat control', { endpointId, targetTemperature, mode });

    await this.eventBus.publish('device.control', {
      deviceId: endpointId,
      action: 'set_temperature',
      parameters: { temperature: targetTemperature, mode }
    });
  }

  public async handleLockControl(endpointId: string, lockState: 'LOCKED' | 'UNLOCKED'): Promise<void> {
    logger.info('Alexa lock control', { endpointId, lockState });

    await this.eventBus.publish('device.control', {
      deviceId: endpointId,
      action: lockState === 'LOCKED' ? 'lock' : 'unlock'
    });
  }

  public async handleSceneActivation(sceneId: string): Promise<void> {
    logger.info('Alexa scene activation', { sceneId });

    await this.eventBus.publish('scene.execute', { sceneId });
  }

  private mapDeviceToAlexa(device: any): AlexaDevice {
    const capabilities: AlexaCapability[] = [
      {
        type: 'AlexaInterface',
        interface: 'Alexa',
        version: '3'
      }
    ];

    // Add capabilities based on device type
    switch (device.type) {
      case 'light':
        capabilities.push({
          type: 'AlexaInterface',
          interface: 'Alexa.PowerController',
          version: '3',
          properties: {
            supported: [{ name: 'powerState' }],
            proactivelyReported: true,
            retrievable: true
          }
        });

        if (device.capabilities?.includes('brightness')) {
          capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.BrightnessController',
            version: '3',
            properties: {
              supported: [{ name: 'brightness' }],
              proactivelyReported: true,
              retrievable: true
            }
          });
        }

        if (device.capabilities?.includes('color')) {
          capabilities.push({
            type: 'AlexaInterface',
            interface: 'Alexa.ColorController',
            version: '3',
            properties: {
              supported: [{ name: 'color' }],
              proactivelyReported: true,
              retrievable: true
            }
          });
        }
        break;

      case 'thermostat':
        capabilities.push({
          type: 'AlexaInterface',
          interface: 'Alexa.ThermostatController',
          version: '3',
          properties: {
            supported: [
              { name: 'targetSetpoint' },
              { name: 'thermostatMode' }
            ],
            proactivelyReported: true,
            retrievable: true
          }
        });
        break;

      case 'lock':
        capabilities.push({
          type: 'AlexaInterface',
          interface: 'Alexa.LockController',
          version: '3',
          properties: {
            supported: [{ name: 'lockState' }],
            proactivelyReported: true,
            retrievable: true
          }
        });
        break;
    }

    return {
      endpointId: device.id,
      friendlyName: device.name,
      description: device.description || `Smart ${device.type}`,
      manufacturerName: device.manufacturer || 'Smart Home',
      displayCategories: [this.getDisplayCategory(device.type)],
      capabilities
    };
  }

  private getDisplayCategory(deviceType: string): string {
    const categoryMap: Record<string, string> = {
      light: 'LIGHT',
      switch: 'SWITCH',
      thermostat: 'THERMOSTAT',
      lock: 'SMARTLOCK',
      camera: 'CAMERA',
      sensor: 'SENSOR',
      plug: 'SMARTPLUG'
    };

    return categoryMap[deviceType] || 'OTHER';
  }

  private async fetchDevices(): Promise<any[]> {
    // In production, fetch from device service
    return [];
  }
}
