import axios from 'axios';
import { Device } from '../types/device';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

class DeviceService {
  private api = axios.create({
    baseURL: `${API_BASE_URL}/api`,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  constructor() {
    // Add auth token interceptor
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Redirect to login
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async getDevices(userId: string, filter?: any): Promise<Device[]> {
    const response = await this.api.get('/devices', {
      params: { userId, ...filter },
    });
    return response.data;
  }

  async getDevice(deviceId: string): Promise<Device> {
    const response = await this.api.get(`/devices/${deviceId}`);
    return response.data;
  }

  async createDevice(device: Partial<Device>): Promise<Device> {
    const response = await this.api.post('/devices', device);
    return response.data;
  }

  async updateDevice(deviceId: string, updates: Partial<Device>): Promise<Device> {
    const response = await this.api.patch(`/devices/${deviceId}`, updates);
    return response.data;
  }

  async deleteDevice(deviceId: string): Promise<void> {
    await this.api.delete(`/devices/${deviceId}`);
  }

  async toggleDevice(deviceId: string, state: boolean): Promise<void> {
    await this.api.post(`/devices/${deviceId}/command`, {
      command: 'setPower',
      parameters: { power: state },
    });
  }

  async sendCommand(deviceId: string, command: string, parameters?: any): Promise<any> {
    const response = await this.api.post(`/devices/${deviceId}/command`, {
      command,
      parameters,
    });
    return response.data;
  }

  async getDeviceHistory(deviceId: string, hours: number = 24): Promise<any[]> {
    const response = await this.api.get(`/devices/${deviceId}/history`, {
      params: { hours },
    });
    return response.data;
  }

  async getDeviceEvents(deviceId: string, hours: number = 24): Promise<any[]> {
    const response = await this.api.get(`/devices/${deviceId}/events`, {
      params: { hours },
    });
    return response.data;
  }

  async getDeviceGroups(userId: string): Promise<any[]> {
    const response = await this.api.get('/device-groups', {
      params: { userId },
    });
    return response.data;
  }

  async createDeviceGroup(group: any): Promise<any> {
    const response = await this.api.post('/device-groups', group);
    return response.data;
  }

  async updateDeviceGroup(groupId: string, updates: any): Promise<any> {
    const response = await this.api.patch(`/device-groups/${groupId}`, updates);
    return response.data;
  }

  async deleteDeviceGroup(groupId: string): Promise<void> {
    await this.api.delete(`/device-groups/${groupId}`);
  }

  async controlGroup(groupId: string, command: string, parameters?: any): Promise<void> {
    await this.api.post(`/device-groups/${groupId}/command`, {
      command,
      parameters,
    });
  }

  async discoverDevices(protocols: string[]): Promise<any> {
    const response = await this.api.post('/devices/discover', { protocols });
    return response.data;
  }

  async pairDevice(deviceId: string, pairingCode?: string): Promise<Device> {
    const response = await this.api.post(`/devices/${deviceId}/pair`, {
      pairingCode,
    });
    return response.data;
  }

  async updateFirmware(deviceId: string, version: string): Promise<void> {
    await this.api.post(`/devices/${deviceId}/firmware`, { version });
  }

  async checkFirmwareUpdates(deviceId: string): Promise<any> {
    const response = await this.api.get(`/devices/${deviceId}/firmware/check`);
    return response.data;
  }

  async getDeviceHealth(deviceId: string): Promise<any> {
    const response = await this.api.get(`/devices/${deviceId}/health`);
    return response.data;
  }

  async shareDevice(deviceId: string, userId: string, permissions: string[]): Promise<void> {
    await this.api.post(`/devices/${deviceId}/share`, {
      userId,
      permissions,
    });
  }

  async unshareDevice(deviceId: string, userId: string): Promise<void> {
    await this.api.delete(`/devices/${deviceId}/share/${userId}`);
  }

  async getSharedDevices(userId: string): Promise<Device[]> {
    const response = await this.api.get('/devices/shared', {
      params: { userId },
    });
    return response.data;
  }

  async exportDeviceData(deviceId: string, format: 'json' | 'csv'): Promise<Blob> {
    const response = await this.api.get(`/devices/${deviceId}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  }

  async getDeviceStatistics(deviceId: string, period: string): Promise<any> {
    const response = await this.api.get(`/devices/${deviceId}/statistics`, {
      params: { period },
    });
    return response.data;
  }

  async setDeviceSchedule(deviceId: string, schedule: any): Promise<void> {
    await this.api.post(`/devices/${deviceId}/schedule`, schedule);
  }

  async getDeviceSchedule(deviceId: string): Promise<any> {
    const response = await this.api.get(`/devices/${deviceId}/schedule`);
    return response.data;
  }

  async deleteDeviceSchedule(deviceId: string, scheduleId: string): Promise<void> {
    await this.api.delete(`/devices/${deviceId}/schedule/${scheduleId}`);
  }

  // WebSocket connection for real-time updates
  connectWebSocket(userId: string, onMessage: (data: any) => void): WebSocket {
    const wsUrl = API_BASE_URL.replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/ws?userId=${userId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        this.connectWebSocket(userId, onMessage);
      }, 5000);
    };

    return ws;
  }
}

export const deviceService = new DeviceService();
