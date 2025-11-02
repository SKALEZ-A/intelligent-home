import axios from 'axios';

export interface MLPrediction {
  automationId: string;
  confidence: number;
  suggestedActions: any[];
  reasoning: string;
}

export class MachineLearningAutomationService {
  private mlServiceUrl: string;

  constructor() {
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://ml-models:5000';
  }

  async predictUserBehavior(userId: string, context: any): Promise<MLPrediction> {
    try {
      const response = await axios.post(`${this.mlServiceUrl}/predict/behavior`, {
        userId,
        context,
        timestamp: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('ML prediction error:', error);
      throw error;
    }
  }

  async suggestAutomations(userId: string, deviceData: any[]): Promise<any[]> {
    try {
      const response = await axios.post(`${this.mlServiceUrl}/suggest/automations`, {
        userId,
        deviceData,
        timestamp: new Date().toISOString()
      });

      return response.data.suggestions || [];
    } catch (error) {
      console.error('Automation suggestion error:', error);
      return [];
    }
  }

  async optimizeAutomation(automationId: string, performanceData: any): Promise<any> {
    try {
      const response = await axios.post(`${this.mlServiceUrl}/optimize/automation`, {
        automationId,
        performanceData,
        timestamp: new Date().toISOString()
      });

      return response.data.optimizations;
    } catch (error) {
      console.error('Automation optimization error:', error);
      return null;
    }
  }

  async detectAnomalies(deviceId: string, telemetryData: any[]): Promise<any> {
    try {
      const response = await axios.post(`${this.mlServiceUrl}/detect/anomalies`, {
        deviceId,
        telemetryData,
        timestamp: new Date().toISOString()
      });

      return response.data.anomalies || [];
    } catch (error) {
      console.error('Anomaly detection error:', error);
      return [];
    }
  }

  async predictEnergyUsage(homeId: string, timeRange: any): Promise<any> {
    try {
      const response = await axios.post(`${this.mlServiceUrl}/predict/energy`, {
        homeId,
        timeRange,
        timestamp: new Date().toISOString()
      });

      return response.data.prediction;
    } catch (error) {
      console.error('Energy prediction error:', error);
      return null;
    }
  }

  async trainModel(modelType: string, trainingData: any[]): Promise<any> {
    try {
      const response = await axios.post(`${this.mlServiceUrl}/train/${modelType}`, {
        data: trainingData,
        timestamp: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      console.error('Model training error:', error);
      throw error;
    }
  }

  async getModelMetrics(modelType: string): Promise<any> {
    try {
      const response = await axios.get(`${this.mlServiceUrl}/metrics/${modelType}`);
      return response.data;
    } catch (error) {
      console.error('Model metrics error:', error);
      return null;
    }
  }
}
