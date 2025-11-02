import { useState, useEffect, useCallback } from 'react';
import { automationService, Automation, Scene } from '../services/automation.service';

interface UseAutomationReturn {
  automations: Automation[];
  scenes: Scene[];
  loading: boolean;
  error: string | null;
  refreshAutomations: () => Promise<void>;
  refreshScenes: () => Promise<void>;
  createAutomation: (data: Partial<Automation>) => Promise<Automation>;
  updateAutomation: (id: string, data: Partial<Automation>) => Promise<Automation>;
  deleteAutomation: (id: string) => Promise<void>;
  toggleAutomation: (id: string, enabled: boolean) => Promise<void>;
  createScene: (data: Partial<Scene>) => Promise<Scene>;
  updateScene: (id: string, data: Partial<Scene>) => Promise<Scene>;
  deleteScene: (id: string) => Promise<void>;
  executeScene: (id: string) => Promise<void>;
}

export const useAutomation = (): UseAutomationReturn => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAutomations = useCallback(async () => {
    try {
      setError(null);
      const data = await automationService.getAutomations();
      setAutomations(data.automations);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch automations');
      console.error('Error fetching automations:', err);
    }
  }, []);

  const fetchScenes = useCallback(async () => {
    try {
      setError(null);
      const data = await automationService.getScenes();
      setScenes(data.scenes);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch scenes');
      console.error('Error fetching scenes:', err);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchAutomations(), fetchScenes()]);
      setLoading(false);
    };

    fetchData();
  }, [fetchAutomations, fetchScenes]);

  const createAutomation = useCallback(async (data: Partial<Automation>) => {
    try {
      const newAutomation = await automationService.createAutomation(data);
      setAutomations(prev => [...prev, newAutomation]);
      return newAutomation;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create automation');
      throw err;
    }
  }, []);

  const updateAutomation = useCallback(async (id: string, data: Partial<Automation>) => {
    try {
      const updatedAutomation = await automationService.updateAutomation(id, data);
      setAutomations(prev =>
        prev.map(automation =>
          automation.id === id ? updatedAutomation : automation
        )
      );
      return updatedAutomation;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update automation');
      throw err;
    }
  }, []);

  const deleteAutomation = useCallback(async (id: string) => {
    try {
      await automationService.deleteAutomation(id);
      setAutomations(prev => prev.filter(automation => automation.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete automation');
      throw err;
    }
  }, []);

  const toggleAutomation = useCallback(async (id: string, enabled: boolean) => {
    try {
      const updatedAutomation = await automationService.toggleAutomation(id, enabled);
      setAutomations(prev =>
        prev.map(automation =>
          automation.id === id ? updatedAutomation : automation
        )
      );
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to toggle automation');
      throw err;
    }
  }, []);

  const createScene = useCallback(async (data: Partial<Scene>) => {
    try {
      const newScene = await automationService.createScene(data);
      setScenes(prev => [...prev, newScene]);
      return newScene;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create scene');
      throw err;
    }
  }, []);

  const updateScene = useCallback(async (id: string, data: Partial<Scene>) => {
    try {
      const updatedScene = await automationService.updateScene(id, data);
      setScenes(prev =>
        prev.map(scene => (scene.id === id ? updatedScene : scene))
      );
      return updatedScene;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update scene');
      throw err;
    }
  }, []);

  const deleteScene = useCallback(async (id: string) => {
    try {
      await automationService.deleteScene(id);
      setScenes(prev => prev.filter(scene => scene.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete scene');
      throw err;
    }
  }, []);

  const executeScene = useCallback(async (id: string) => {
    try {
      await automationService.executeScene(id);
      // Update execution count
      setScenes(prev =>
        prev.map(scene =>
          scene.id === id
            ? {
                ...scene,
                executionCount: (scene.executionCount || 0) + 1,
                lastExecuted: new Date().toISOString(),
              }
            : scene
        )
      );
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to execute scene');
      throw err;
    }
  }, []);

  return {
    automations,
    scenes,
    loading,
    error,
    refreshAutomations: fetchAutomations,
    refreshScenes: fetchScenes,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
    createScene,
    updateScene,
    deleteScene,
    executeScene,
  };
};
