import { api } from '../utils/api';

export interface Scene {
  id: string;
  name: string;
  description?: string;
  actions: SceneAction[];
  icon?: string;
  active: boolean;
}

export interface SceneAction {
  deviceId: string;
  action: string;
  value: any;
  delay?: number;
}

class SceneService {
  async getScenes(): Promise<Scene[]> {
    const response = await api.get('/scenes');
    return response.data;
  }

  async getScene(sceneId: string): Promise<Scene> {
    const response = await api.get(`/scenes/${sceneId}`);
    return response.data;
  }

  async createScene(scene: Omit<Scene, 'id'>): Promise<Scene> {
    const response = await api.post('/scenes', scene);
    return response.data;
  }

  async updateScene(sceneId: string, updates: Partial<Scene>): Promise<Scene> {
    const response = await api.put(`/scenes/${sceneId}`, updates);
    return response.data;
  }

  async deleteScene(sceneId: string): Promise<void> {
    await api.delete(`/scenes/${sceneId}`);
  }

  async activateScene(sceneId: string): Promise<void> {
    await api.post(`/scenes/${sceneId}/activate`);
  }

  async deactivateScene(sceneId: string): Promise<void> {
    await api.post(`/scenes/${sceneId}/deactivate`);
  }

  async duplicateScene(sceneId: string, newName: string): Promise<Scene> {
    const response = await api.post(`/scenes/${sceneId}/duplicate`, { name: newName });
    return response.data;
  }
}

export const sceneService = new SceneService();
