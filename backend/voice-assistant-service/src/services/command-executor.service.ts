import axios from 'axios';
import { logger } from '../utils/logger';

interface ExecutionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

interface DeviceCommand {
  deviceId: string;
  command: string;
  parameters?: Record<string, any>;
}

export class CommandExecutorService {
  private deviceServiceUrl: string;
  private automationServiceUrl: string;
  private sceneServiceUrl: string;

  constructor() {
    this.deviceServiceUrl = process.env.DEVICE_SERVICE_URL || 'http://localhost:3002';
    this.automationServiceUrl = process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3003';
    this.sceneServiceUrl = process.env.SCENE_SERVICE_URL || 'http://localhost:3003';
  }

  async executeCommand(intent: string, entities: Record<string, any>, userId: string): Promise<ExecutionResult> {
    try {
      switch (intent) {
        case 'turn_on_device':
          return await this.turnOnDevice(entities, userId);
        
        case 'turn_off_device':
          return await this.turnOffDevice(entities, userId);
        
        case 'set_temperature':
          return await this.setTemperature(entities, userId);
        
        case 'set_brightness':
          return await this.setBrightness(entities, userId);
        
        case 'set_color':
          return await this.setColor(entities, userId);
        
        case 'activate_scene':
          return await this.activateScene(entities, userId);
        
        case 'query_status':
          return await this.queryDeviceStatus(entities, userId);
        
        case 'query_temperature':
          return await this.queryTemperature(entities, userId);
        
        case 'lock_door':
          return await this.lockDoor(entities, userId);
        
        case 'unlock_door':
          return await this.unlockDoor(entities, userId);
        
        default:
          return {
            success: false,
            message: `Unknown intent: ${intent}`,
            error: 'UNKNOWN_INTENT'
          };
      }
    } catch (error: any) {
      logger.error('Error executing command:', error);
      return {
        success: false,
        message: 'Failed to execute command',
        error: error.message
      };
    }
  }

  private async turnOnDevice(entities: Record<string, any>, userId: string): Promise<ExecutionResult> {
    const deviceName = entities.device;
    const location = entities.location;

    // Find device by name and location
    const device = await this.findDevice(deviceName, location, userId);
    
    if (!device) {
      return {
        success: false,
        message: `Could not find device: ${deviceName}${location ? ` in ${location}` : ''}`,
        error: 'DEVICE_NOT_FOUND'
      };
    }

    // Send command to device service
    const response = await axios.post(
      `${this.deviceServiceUrl}/api/devices/${device.id}/command`,
      {
        command: 'turn_on',
        parameters: {}
      },
      {
        headers: { 'X-User-Id': userId }
      }
    );

    return {
      success: true,
      message: `Turned on ${deviceName}`,
      data: response.data
    };
  }

  private async turnOffDevice(entities: Record<string, any>, userId: string): Promise<ExecutionResult> {
    const deviceName = entities.device;
    const location = entities.location;

    const device = await this.findDevice(deviceName, location, userId);
    
    if (!device) {
      return {
        success: false,
        message: `Could not find device: ${deviceName}${location ? ` in ${location}` : ''}`,
        error: 'DEVICE_NOT_FOUND'
      };
    }

    const response = await axios.post(
      `${this.deviceServiceUrl}/api/devices/${device.id}/command`,
      {
        command: 'turn_off',
        parameters: {}
      },
      {
        headers: { 'X-User-Id': userId }
      }
    );

    return {
      success: true,
      message: `Turned off ${deviceName}`,
      data: response.data
    };
  }

  private async setTemperature(entities: Record<string, any>, userId: string): Promise<ExecutionResult> {
    const value = entities.value;
    const location = entities.location || 'home';

    // Find thermostat
    const device = await this.findDevice('thermostat', location, userId);
    
    if (!device) {
      return {
        success: false,
        message: 'Could not find thermostat',
        error: 'DEVICE_NOT_FOUND'
      };
    }

    const response = await axios.post(
      `${this.deviceServiceUrl}/api/devices/${device.id}/command`,
      {
        command: 'set_temperature',
        parameters: { temperature: value }
      },
      {
        headers: { 'X-User-Id': userId }
      }
    );

    return {
      success: true,
      message: `Set temperature to ${value} degrees`,
      data: response.data
    };
  }

  private async setBrightness(entities: Record<string, any>, userId: string): Promise<ExecutionResult> {
    const deviceName = entities.device;
    const value = entities.value;
    const location = entities.location;

    const device = await this.findDevice(deviceName, location, userId);
    
    if (!device) {
      return {
        success: false,
        message: `Could not find device: ${deviceName}`,
        error: 'DEVICE_NOT_FOUND'
      };
    }

    const response = await axios.post(
      `${this.deviceServiceUrl}/api/devices/${device.id}/command`,
      {
        command: 'set_brightness',
        parameters: { brightness: value }
      },
      {
        headers: { 'X-User-Id': userId }
      }
    );

    return {
      success: true,
      message: `Set ${deviceName} brightness to ${value}%`,
      data: response.data
    };
  }

  private async setColor(entities: Record<string, any>, userId: string): Promise<ExecutionResult> {
    const deviceName = entities.device;
    const color = entities.color;
    const location = entities.location;

    const device = await this.findDevice(deviceName, location, userId);
    
    if (!device) {
      return {
        success: false,
        message: `Could not find device: ${deviceName}`,
        error: 'DEVICE_NOT_FOUND'
      };
    }

    const response = await axios.post(
      `${this.deviceServiceUrl}/api/devices/${device.id}/command`,
      {
        command: 'set_color',
        parameters: { color }
      },
      {
        headers: { 'X-User-Id': userId }
      }
    );

    return {
      success: true,
      message: `Set ${deviceName} to ${color}`,
      data: response.data
    };
  }

  private async activateScene(entities: Record<string, any>, userId: string): Promise<ExecutionResult> {
    const sceneName = entities.scene;

    // Find scene by name
    const scene = await this.findScene(sceneName, userId);
    
    if (!scene) {
      return {
        success: false,
        message: `Could not find scene: ${sceneName}`,
        error: 'SCENE_NOT_FOUND'
      };
    }

    const response = await axios.post(
      `${this.sceneServiceUrl}/api/scenes/${scene.id}/activate`,
      {},
      {
        headers: { 'X-User-Id': userId }
      }
    );

    return {
      success: true,
      message: `Activated ${sceneName} scene`,
      data: response.data
    };
  }

  private async queryDeviceStatus(entities: Record<string, any>, userId: string): Promise<ExecutionResult> {
    const deviceName = entities.device;
    const location = entities.location;

    const device = await this.findDevice(deviceName, location, userId);
    
    if (!device) {
      return {
        success: false,
        message: `Could not find device: ${deviceName}`,
        error: 'DEVICE_NOT_FOUND'
      };
    }

    const response = await axios.get(
      `${this.deviceServiceUrl}/api/devices/${device.id}/state`,
      {
        headers: { 'X-User-Id': userId }
      }
    );

    const state = response.data;
    const status = state.power === 'on' ? 'on' : 'off';

    return {
      success: true,
      message: `${deviceName} is currently ${status}`,
      data: state
    };
  }

  private async queryTemperature(entities: Record<string, any>, userId: string): Promise<ExecutionResult> {
    const location = entities.location || 'home';

    const device = await this.findDevice('thermostat', location, userId);
    
    if (!device) {
      return {
        success: false,
        message: 'Could not find temperature sensor',
        error: 'DEVICE_NOT_FOUND'
      };
    }

    const response = await axios.get(
      `${this.deviceServiceUrl}/api/devices/${device.id}/state`,
      {
        headers: { 'X-User-Id': userId }
      }
    );

    const temperature = response.data.temperature;

    return {
      success: true,
      message: `The current temperature is ${temperature} degrees`,
      data: { temperature }
    };
  }

  private async lockDoor(entities: Record<string, any>, userId: string): Promise<ExecutionResult> {
    const deviceName = entities.device || 'door';
    const location = entities.location;

    const device = await this.findDevice(deviceName, location, userId);
    
    if (!device) {
      return {
        success: false,
        message: `Could not find lock: ${deviceName}`,
        error: 'DEVICE_NOT_FOUND'
      };
    }

    const response = await axios.post(
      `${this.deviceServiceUrl}/api/devices/${device.id}/command`,
      {
        command: 'lock',
        parameters: {}
      },
      {
        headers: { 'X-User-Id': userId }
      }
    );

    return {
      success: true,
      message: `Locked ${deviceName}`,
      data: response.data
    };
  }

  private async unlockDoor(entities: Record<string, any>, userId: string): Promise<ExecutionResult> {
    const deviceName = entities.device || 'door';
    const location = entities.location;

    const device = await this.findDevice(deviceName, location, userId);
    
    if (!device) {
      return {
        success: false,
        message: `Could not find lock: ${deviceName}`,
        error: 'DEVICE_NOT_FOUND'
      };
    }

    const response = await axios.post(
      `${this.deviceServiceUrl}/api/devices/${device.id}/command`,
      {
        command: 'unlock',
        parameters: {}
      },
      {
        headers: { 'X-User-Id': userId }
      }
    );

    return {
      success: true,
      message: `Unlocked ${deviceName}`,
      data: response.data
    };
  }

  private async findDevice(name: string, location: string | undefined, userId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.deviceServiceUrl}/api/devices`,
        {
          headers: { 'X-User-Id': userId },
          params: { name, location }
        }
      );

      const devices = response.data;
      return devices.length > 0 ? devices[0] : null;
    } catch (error) {
      logger.error('Error finding device:', error);
      return null;
    }
  }

  private async findScene(name: string, userId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.sceneServiceUrl}/api/scenes`,
        {
          headers: { 'X-User-Id': userId },
          params: { name }
        }
      );

      const scenes = response.data;
      return scenes.length > 0 ? scenes[0] : null;
    } catch (error) {
      logger.error('Error finding scene:', error);
      return null;
    }
  }
}

export const commandExecutorService = new CommandExecutorService();
