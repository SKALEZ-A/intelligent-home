import { useState, useEffect, useCallback } from 'react';
import {
  energyService,
  EnergyStats,
  EnergyForecast,
  OptimizationRecommendation,
} from '../services/energy.service';

interface UseEnergyOptions {
  startDate: string;
  endDate: string;
  deviceIds?: string[];
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseEnergyReturn {
  stats: EnergyStats | null;
  forecast: EnergyForecast[];
  recommendations: OptimizationRecommendation[];
  realTimePower: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  applyRecommendation: (id: string) => Promise<void>;
  dismissRecommendation: (id: string) => Promise<void>;
}

export const useEnergy = (options: UseEnergyOptions): UseEnergyReturn => {
  const {
    startDate,
    endDate,
    deviceIds,
    autoRefresh = false,
    refreshInterval = 60000,
  } = options;

  const [stats, setStats] = useState<EnergyStats | null>(null);
  const [forecast, setForecast] = useState<EnergyForecast[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  const [realTimePower, setRealTimePower] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      const [statsData, forecastData, recommendationsData, realTimeData] = await Promise.all([
        energyService.getEnergyStats({ startDate, endDate, deviceIds }),
        energyService.getEnergyForecast({ days: 7, deviceIds }),
        energyService.getOptimizationRecommendations(),
        energyService.getRealTimeUsage(),
      ]);

      setStats(statsData);
      setForecast(forecastData);
      setRecommendations(recommendationsData);
      setRealTimePower(realTimeData.totalPower);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch energy data');
      console.error('Error fetching energy data:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, deviceIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchData]);

  const applyRecommendation = useCallback(async (id: string) => {
    try {
      await energyService.applyOptimization(id);
      setRecommendations(prev => prev.filter(rec => rec.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to apply recommendation');
      throw err;
    }
  }, []);

  const dismissRecommendation = useCallback(async (id: string) => {
    try {
      await energyService.dismissRecommendation(id);
      setRecommendations(prev => prev.filter(rec => rec.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to dismiss recommendation');
      throw err;
    }
  }, []);

  return {
    stats,
    forecast,
    recommendations,
    realTimePower,
    loading,
    error,
    refresh: fetchData,
    applyRecommendation,
    dismissRecommendation,
  };
};
