import { useState, useEffect } from 'react';
import { apiClient } from '../utils/api';

interface Scene {
  id: string;
  name: string;
  description: string;
  icon: string;
  actions: any[];
  enabled: boolean;
  favorite: boolean;
}

export const useScenes = () => {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadScenes();
  }, []);

  const loadScenes = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<Scene[]>('/automation/scenes');
      setScenes(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createScene = async (scene: Omit<Scene, 'id'>) => {
    try {
      const newScene = await apiClient.post<Scene>('/automation/scenes', scene);
      setScenes(prev => [...prev, newScene]);
      return newScene;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const updateScene = async (id: string, updates: Partial<Scene>) => {
    try {
      const updated = await apiClient.put<Scene>(`/automation/scenes/${id}`, updates);
      setScenes(prev => prev.map(s => (s.id === id ? updated : s)));
      return updated;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const deleteScene = async (id: string) => {
    try {
      await apiClient.delete(`/automation/scenes/${id}`);
      setScenes(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const executeScene = async (id: string) => {
    try {
      await apiClient.post(`/automation/scenes/${id}/execute`);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const toggleFavorite = async (id: string) => {
    const scene = scenes.find(s => s.id === id);
    if (scene) {
      await updateScene(id, { favorite: !scene.favorite });
    }
  };

  return {
    scenes,
    loading,
    error,
    createScene,
    updateScene,
    deleteScene,
    executeScene,
    toggleFavorite,
    refresh: loadScenes,
  };
};
