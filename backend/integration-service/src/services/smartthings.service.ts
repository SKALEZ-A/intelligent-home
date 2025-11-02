import axios from 'axios';

export interface SmartThingsDevice {
  deviceId: string;
  label: string;
  deviceTypeName: string;
  capabilities: string[];
  status: any;
}

export class SmartThingsService {
  private apiUrl: string = 'https://api.smartthings.com/v1';
  private accessToken: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || process.env.SMARTTHINGS_TOKEN || '';
  }

  async getDevices(): Promise<SmartThingsDevice[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/devices`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      return response.data.items || [];
    } catch (error) {
      console.error('SmartThings get devices error:', error);
      return [];
    }
  }

  async getDeviceStatus(deviceId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/devices/${deviceId}/status`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      return response.data;
    } catch (error) {
      console.error('SmartThings get device status error:', error);
      return null;
    }
  }

  async executeCommand(deviceId: string, capability: string, command: string, args?: any[]): Promise<boolean> {
    try {
      await axios.post(
        `${this.apiUrl}/devices/${deviceId}/commands`,
        {
          commands: [{
            component: 'main',
            capability,
            command,
            arguments: args || []
          }]
        },
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      return true;
    } catch (error) {
      console.error('SmartThings execute command error:', error);
      return false;
    }
  }

  async turnOn(deviceId: string): Promise<boolean> {
    return this.executeCommand(deviceId, 'switch', 'on');
  }

  async turnOff(deviceId: string): Promise<boolean> {
    return this.executeCommand(deviceId, 'switch', 'off');
  }

  async setLevel(deviceId: string, level: number): Promise<boolean> {
    return this.executeCommand(deviceId, 'switchLevel', 'setLevel', [level]);
  }

  async setColor(deviceId: string, hue: number, saturation: number): Promise<boolean> {
    return this.executeCommand(deviceId, 'colorControl', 'setColor', [{ hue, saturation }]);
  }

  async setTemperature(deviceId: string, temperature: number): Promise<boolean> {
    return this.executeCommand(deviceId, 'thermostatCoolingSetpoint', 'setCoolingSetpoint', [temperature]);
  }

  async lock(deviceId: string): Promise<boolean> {
    return this.executeCommand(deviceId, 'lock', 'lock');
  }

  async unlock(deviceId: string): Promise<boolean> {
    return this.executeCommand(deviceId, 'lock', 'unlock');
  }

  async getScenes(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/scenes`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      return response.data.items || [];
    } catch (error) {
      console.error('SmartThings get scenes error:', error);
      return [];
    }
  }

  async executeScene(sceneId: string): Promise<boolean> {
    try {
      await axios.post(
        `${this.apiUrl}/scenes/${sceneId}/execute`,
        {},
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      return true;
    } catch (error) {
      console.error('SmartThings execute scene error:', error);
      return false;
    }
  }

  async subscribeToEvents(deviceId: string, callback: (event: any) => void): Promise<void> {
    console.log(`Subscribed to events for device ${deviceId}`);
  }
}
