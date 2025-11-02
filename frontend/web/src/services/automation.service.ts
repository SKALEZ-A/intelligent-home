import axios, { AxiosInstance } from 'axios';
import { authService } from './auth.service';

const API_BASE_URL = process.env.REACT_APP_AUTOMATION_SERVICE_URL || 'http://localhost:3003/api';

export interface Automation {
  id: string;
  userId: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  priority: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AutomationTrigger {
  type: 'device_state_change' | 'time_based' | 'location_based' | 'weather_based' | 'energy_threshold' | 'manual';
  deviceId?: string;
  property?: string;
  value?: any;
  operator?: string;
  schedule?: {
    type: 'cron' | 'interval' | 'once';
    expression?: string;
    interval?: number;
    time?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    radius: number;
    event: 'enter' | 'exit';
  };
  weatherCondition?: {
    condition: string;
    operator: string;
    value: any;
  };
  energyThreshold?: {
    metric: string;
    threshold: number;
    operator: string;
  };
}

export interface AutomationCondition {
  type: 'device_state' | 'time_range' | 'day_of_week' | 'weather' | 'energy_usage' | 'user_presence';
  deviceId?: string;
  property?: string;
  operator?: string;
  value?: any;
  timeRange?: {
    start: string;
    end: string;
  };
  daysOfWeek?: number[];
  logicalOperator?: 'AND' | 'OR';
}

export interface AutomationAction {
  type: 'device_command' | 'scene_execution' | 'notification' | 'delay' | 'http_request';
  deviceId?: string;
  command?: string;
  parameters?: Record<string, any>;
  sceneId?: string;
  notification?: {
    title: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
    channels: string[];
  };
  delay?: number;
  httpRequest?: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
  };
  order: number;
}

export interface Scene {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  actions: SceneAction[];
  executionCount?: number;
  lastExecuted?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SceneAction {
  deviceId: string;
  action: string;
  parameters: Record<string, any>;
  delay?: number;
  order: number;
}

class AutomationService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.api.interceptors.request.use(
      (config) => {
        const token = authService.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  // Automation methods
  async getAutomations(params?: {
    page?: number;
    limit?: number;
    enabled?: boolean;
    type?: string;
  }): Promise<{ automations: Automation[]; total: number; page: number; totalPages: number }> {
    const response = await this.api.get('/automations', { params });
    return response.data;
  }

  async getAutomationById(id: string): Promise<Automation> {
    const response = await this.api.get(`/automations/${id}`);
    return response.data;
  }

  async createAutomation(data: Partial<Automation>): Promise<Automation> {
    const response = await this.api.post('/automations', data);
    return response.data;
  }

  async updateAutomation(id: string, data: Partial<Automation>): Promise<Automation> {
    const response = await this.api.put(`/automations/${id}`, data);
    return response.data;
  }

  async deleteAutomation(id: string): Promise<void> {
    await this.api.delete(`/automations/${id}`);
  }

  async toggleAutomation(id: string, enabled: boolean): Promise<Automation> {
    const response = await this.api.patch(`/automations/${id}/toggle`, { enabled });
    return response.data;
  }

  async testAutomation(id: string): Promise<any> {
    const response = await this.api.post(`/automations/${id}/test`);
    return response.data;
  }

  async getAutomationExecutionHistory(
    id: string,
    params?: { page?: number; limit?: number }
  ): Promise<any> {
    const response = await this.api.get(`/automations/${id}/history`, { params });
    return response.data;
  }

  // Scene methods
  async getScenes(params?: {
    page?: number;
    limit?: number;
    category?: string;
  }): Promise<{ scenes: Scene[]; total: number; page: number; totalPages: number }> {
    const response = await this.api.get('/scenes', { params });
    return response.data;
  }

  async getSceneById(id: string): Promise<Scene> {
    const response = await this.api.get(`/scenes/${id}`);
    return response.data;
  }

  async createScene(data: Partial<Scene>): Promise<Scene> {
    const response = await this.api.post('/scenes', data);
    return response.data;
  }

  async updateScene(id: string, data: Partial<Scene>): Promise<Scene> {
    const response = await this.api.put(`/scenes/${id}`, data);
    return response.data;
  }

  async deleteScene(id: string): Promise<void> {
    await this.api.delete(`/scenes/${id}`);
  }

  async executeScene(id: string): Promise<any> {
    const response = await this.api.post(`/scenes/${id}/execute`);
    return response.data;
  }

  async getSceneExecutionHistory(
    id: string,
    params?: { page?: number; limit?: number }
  ): Promise<any> {
    const response = await this.api.get(`/scenes/${id}/history`, { params });
    return response.data;
  }

  // Utility methods
  async validateAutomation(automation: Partial<Automation>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!automation.name || automation.name.trim().length === 0) {
      errors.push('Automation name is required');
    }

    if (!automation.trigger) {
      errors.push('Trigger is required');
    }

    if (!automation.actions || automation.actions.length === 0) {
      errors.push('At least one action is required');
    }

    // Validate action order
    if (automation.actions) {
      const orders = automation.actions.map(a => a.order);
      const uniqueOrders = new Set(orders);
      if (orders.length !== uniqueOrders.size) {
        errors.push('Action orders must be unique');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async validateScene(scene: Partial<Scene>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!scene.name || scene.name.trim().length === 0) {
      errors.push('Scene name is required');
    }

    if (!scene.actions || scene.actions.length === 0) {
      errors.push('At least one action is required');
    }

    // Validate action order
    if (scene.actions) {
      const orders = scene.actions.map(a => a.order);
      const uniqueOrders = new Set(orders);
      if (orders.length !== uniqueOrders.size) {
        errors.push('Action orders must be unique');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const automationService = new AutomationService();
