import axios, { AxiosInstance } from 'axios';
import { authService } from './auth.service';

const API_BASE_URL = process.env.REACT_APP_ENERGY_SERVICE_URL || 'http://localhost:3004/api';

export interface EnergyProfile {
  id: string;
  userId: string;
  name: string;
  description?: string;
  peakHours: { start: string; end: string }[];
  offPeakHours: { start: string; end: string }[];
  peakRate: number;
  offPeakRate: number;
  currency: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnergyUsage {
  deviceId: string;
  deviceName: string;
  timestamp: string;
  power: number;
  energy: number;
  cost: number;
  duration: number;
}

export interface EnergyStats {
  totalEnergy: number;
  totalCost: number;
  averagePower: number;
  peakPower: number;
  peakTime: string;
  deviceBreakdown: Array<{
    deviceId: string;
    deviceName: string;
    energy: number;
    cost: number;
    percentage: number;
  }>;
  hourlyData: Array<{
    hour: string;
    energy: number;
    cost: number;
    power: number;
  }>;
  dailyData: Array<{
    date: string;
    energy: number;
    cost: number;
  }>;
}

export interface EnergyForecast {
  date: string;
  predictedEnergy: number;
  predictedCost: number;
  confidence: number;
  factors: string[];
}

export interface OptimizationRecommendation {
  id: string;
  type: 'schedule_shift' | 'device_replacement' | 'usage_reduction' | 'rate_plan_change';
  title: string;
  description: string;
  potentialSavings: number;
  savingsPercentage: number;
  difficulty: 'easy' | 'medium' | 'hard';
  deviceIds?: string[];
  actions?: Array<{
    description: string;
    automated: boolean;
  }>;
  priority: number;
}

class EnergyService {
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

  // Energy Profile methods
  async getEnergyProfiles(): Promise<EnergyProfile[]> {
    const response = await this.api.get('/energy/profiles');
    return response.data;
  }

  async getEnergyProfileById(id: string): Promise<EnergyProfile> {
    const response = await this.api.get(`/energy/profiles/${id}`);
    return response.data;
  }

  async createEnergyProfile(data: Partial<EnergyProfile>): Promise<EnergyProfile> {
    const response = await this.api.post('/energy/profiles', data);
    return response.data;
  }

  async updateEnergyProfile(id: string, data: Partial<EnergyProfile>): Promise<EnergyProfile> {
    const response = await this.api.put(`/energy/profiles/${id}`, data);
    return response.data;
  }

  async deleteEnergyProfile(id: string): Promise<void> {
    await this.api.delete(`/energy/profiles/${id}`);
  }

  // Energy Usage methods
  async getEnergyUsage(params: {
    startDate: string;
    endDate: string;
    deviceIds?: string[];
    granularity?: 'hour' | 'day' | 'week' | 'month';
  }): Promise<EnergyUsage[]> {
    const response = await this.api.get('/energy/usage', { params });
    return response.data;
  }

  async getEnergyStats(params: {
    startDate: string;
    endDate: string;
    deviceIds?: string[];
  }): Promise<EnergyStats> {
    const response = await this.api.get('/energy/stats', { params });
    return response.data;
  }

  async getRealTimeUsage(): Promise<{
    totalPower: number;
    devices: Array<{
      deviceId: string;
      deviceName: string;
      power: number;
      status: string;
    }>;
  }> {
    const response = await this.api.get('/energy/realtime');
    return response.data;
  }

  // Energy Forecasting methods
  async getEnergyForecast(params: {
    days?: number;
    deviceIds?: string[];
  }): Promise<EnergyForecast[]> {
    const response = await this.api.get('/energy/forecast', { params });
    return response.data;
  }

  async getCostProjection(params: {
    months?: number;
    profileId?: string;
  }): Promise<Array<{
    month: string;
    projectedCost: number;
    confidence: number;
  }>> {
    const response = await this.api.get('/energy/cost-projection', { params });
    return response.data;
  }

  // Optimization methods
  async getOptimizationRecommendations(): Promise<OptimizationRecommendation[]> {
    const response = await this.api.get('/energy/recommendations');
    return response.data;
  }

  async applyOptimization(recommendationId: string): Promise<{
    success: boolean;
    message: string;
    automationsCreated?: string[];
  }> {
    const response = await this.api.post(`/energy/recommendations/${recommendationId}/apply`);
    return response.data;
  }

  async dismissRecommendation(recommendationId: string): Promise<void> {
    await this.api.delete(`/energy/recommendations/${recommendationId}`);
  }

  // Load Balancing methods
  async getLoadBalancingStatus(): Promise<{
    enabled: boolean;
    mode: 'automatic' | 'manual';
    maxLoad: number;
    currentLoad: number;
    managedDevices: string[];
  }> {
    const response = await this.api.get('/energy/load-balancing');
    return response.data;
  }

  async updateLoadBalancing(data: {
    enabled: boolean;
    mode?: 'automatic' | 'manual';
    maxLoad?: number;
    managedDevices?: string[];
  }): Promise<void> {
    await this.api.put('/energy/load-balancing', data);
  }

  async getLoadBalancingHistory(params: {
    startDate: string;
    endDate: string;
  }): Promise<Array<{
    timestamp: string;
    event: string;
    deviceId: string;
    action: string;
    reason: string;
  }>> {
    const response = await this.api.get('/energy/load-balancing/history', { params });
    return response.data;
  }

  // Comparison methods
  async compareUsage(params: {
    period1: { start: string; end: string };
    period2: { start: string; end: string };
    deviceIds?: string[];
  }): Promise<{
    period1: EnergyStats;
    period2: EnergyStats;
    difference: {
      energy: number;
      energyPercentage: number;
      cost: number;
      costPercentage: number;
    };
  }> {
    const response = await this.api.post('/energy/compare', params);
    return response.data;
  }

  async getBenchmark(): Promise<{
    averageUsage: number;
    averageCost: number;
    userUsage: number;
    userCost: number;
    percentile: number;
    comparison: 'below_average' | 'average' | 'above_average';
  }> {
    const response = await this.api.get('/energy/benchmark');
    return response.data;
  }

  // Export methods
  async exportEnergyData(params: {
    startDate: string;
    endDate: string;
    format: 'csv' | 'json' | 'pdf';
    deviceIds?: string[];
  }): Promise<Blob> {
    const response = await this.api.get('/energy/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  // Alerts methods
  async getEnergyAlerts(): Promise<Array<{
    id: string;
    type: 'high_usage' | 'unusual_pattern' | 'cost_threshold' | 'device_malfunction';
    severity: 'low' | 'medium' | 'high';
    message: string;
    deviceId?: string;
    timestamp: string;
    acknowledged: boolean;
  }>> {
    const response = await this.api.get('/energy/alerts');
    return response.data;
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    await this.api.post(`/energy/alerts/${alertId}/acknowledge`);
  }

  async configureAlerts(config: {
    highUsageThreshold?: number;
    costThreshold?: number;
    unusualPatternDetection?: boolean;
    notificationChannels?: string[];
  }): Promise<void> {
    await this.api.put('/energy/alerts/config', config);
  }
}

export const energyService = new EnergyService();
