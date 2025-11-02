import { logger } from '../../../../shared/utils/logger';
import { EventBusService } from '../../../../shared/services/event-bus.service';

interface GoogleHomeDevice {
  id: string;
  type: string;
  traits: string[];
  name: {
    defaultNames: string[];
    name: string;
    nicknames: string[];
  };
  willReportState: boolean;
  attributes?: Record<string, any>;
  deviceInfo?: {
    manufacturer: string;
    model: string;
    hwVersion: string;
    swVersion: string;
  };
}

export class GoogleHomeService {
  constructor(private eventBus: EventBusService) {}

  public async handleSync(): Promise<GoogleHomeDevice[]> {
    logger.info('Google Home SYNC request received');

    const devices = await this.fetchDevices();
    return devices.map(device => this.mapDeviceToGoogleHome(device));
  }

  public async handleQuery(deviceIds: string[]): Promise<Record<string, any>> {
    logger.info('Google Home QUERY request', { deviceIds });

    const states: Record<string, any> = {};

    for (const deviceId of deviceIds) {
      const state = await this.getDeviceState(deviceId);
      states[deviceId] = state;
    }

    return states;
  }

  public async handleExecute(commands: any[]): Promise<any[]> {
    logger.info('Google Home EXECUTE request', { commandCount: commands.length });

    const results = [];

    for (const command of commands) {
      for (const device of command.devices) {
        for (const execution of command.execution) {
          try {
            await this.executeCommand(device.id, execution.command, execution.params);
            results.push({
              ids: [device.id],
              status: 'SUCCESS',
              states: await this.getDeviceState(device.id)
            });
          } catch (error) {
            results.push({
              ids: [device.id],
              status: 'ERROR',
              errorCode: 'deviceOffline'
            });
          }
        }
      }
    }

    return results;
  }

  private async executeCommand(deviceId: string, command: string, params: any): Promise<void> {
    logger.info('Executing Google Home command', { deviceId, command, params });

    switch (command) {
      case 'action.devices.commands.OnOff':
        await this.eventBus.publish('device.control', {
          deviceId,
          action: params.on ? 'turn_on' : 'turn_off'
        });
        break;

      case 'action.devices.commands.BrightnessAbsolute':
        await this.eventBus.publish('device.control', {
          deviceId,
          action: 'set_brightness',
          parameters: { brightness: params.brightness }
        });
        break;

      case 'action.devices.commands.ColorAbsolute':
        if (params.color.spectrumHSV) {
          await this.eventBus.publish('device.control', {
            deviceId,
            action: 'set_color',
            parameters: {
              hue: params.color.spectrumHSV.hue,
              saturation: params.color.spectrumHSV.saturation,
              value: params.color.spectrumHSV.value
            }
          });
        }
        break;

      case 'action.devices.commands.ThermostatTemperatureSetpoint':
        await this.eventBus.publish('device.control', {
          deviceId,
          action: 'set_temperature',
          parameters: { temperature: params.thermostatTemperatureSetpoint }
        });
        break;

      case 'action.devices.commands.LockUnlock':
        await this.eventBus.publish('device.control', {
          deviceId,
          action: params.lock ? 'lock' : 'unlock'
        });
        break;

      default:
        logger.warn('Unknown Google Home command', { command });
    }
  }

  private mapDeviceToGoogleHome(device: any): GoogleHomeDevice {
    const traits: string[] = [];
    const attributes: Record<string, any> = {};

    // Map device capabilities to Google Home traits
    switch (device.type) {
      case 'light':
        traits.push('action.devices.traits.OnOff');
        
        if (device.capabilities?.includes('brightness')) {
          traits.push('action.devices.traits.Brightness');
        }
        
        if (device.capabilities?.includes('color')) {
          traits.push('action.devices.traits.ColorSetting');
          attributes.colorModel = 'hsv';
        }
        break;

      case 'thermostat':
        traits.push('action.devices.traits.TemperatureSetting');
        attributes.availableThermostatModes = ['off', 'heat', 'cool', 'auto'];
        attributes.thermostatTemperatureUnit = 'C';
        break;

      case 'lock':
        traits.push('action.devices.traits.LockUnlock');
        break;

      case 'switch':
        traits.push('action.devices.traits.OnOff');
        break;

      case 'sensor':
        traits.push('action.devices.traits.SensorState');
        break;
    }

    return {
      id: device.id,
      type: this.getGoogleHomeType(device.type),
      traits,
      name: {
        defaultNames: [device.name],
        name: device.name,
        nicknames: device.nicknames || [device.name]
      },
      willReportState: true,
      attributes,
      deviceInfo: {
        manufacturer: device.manufacturer || 'Smart Home',
        model: device.model || device.type,
        hwVersion: device.hwVersion || '1.0',
        swVersion: device.swVersion || '1.0'
      }
    };
  }

  private getGoogleHomeType(deviceType: string): string {
    const typeMap: Record<string, string> = {
      light: 'action.devices.types.LIGHT',
      switch: 'action.devices.types.SWITCH',
      thermostat: 'action.devices.types.THERMOSTAT',
      lock: 'action.devices.types.LOCK',
      camera: 'action.devices.types.CAMERA',
      sensor: 'action.devices.types.SENSOR',
      plug: 'action.devices.types.OUTLET'
    };

    return typeMap[deviceType] || 'action.devices.types.SWITCH';
  }

  private async getDeviceState(deviceId: string): Promise<any> {
    // In production, fetch actual device state
    return {
      online: true,
      on: true
    };
  }

  private async fetchDevices(): Promise<any[]> {
    // In production, fetch from device service
    return [];
  }
}
