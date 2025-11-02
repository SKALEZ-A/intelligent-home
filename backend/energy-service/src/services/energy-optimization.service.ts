import { createLogger } from '../../../../shared/utils/logger';
import {
  EnergyConsumption,
  EnergyProfile,
  EnergyRecommendation,
  Device,
  DeviceEnergyBreakdown,
  WeatherData,
} from '../../../../shared/types';
import { EnergyRepository } from '../repositories/energy.repository';
import { DeviceServiceClient } from '../clients/device-service.client';
import { WeatherServiceClient } from '../clients/weather-service.client';
import { MLServiceClient } from '../clients/ml-service.client';

const logger = createLogger('EnergyOptimizationService');

interface OptimizationStrategy {
  name: string;
  description: string;
  potentialSavings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  actions: string[];
  estimatedCostSavings: number;
}

interface LoadShiftingOpportunity {
  deviceId: string;
  deviceName: string;
  currentSchedule: { start: string; end: string };
  recommendedSchedule: { start: string; end: string };
  savingsPercentage: number;
  reason: string;
}

export class EnergyOptimizationService {
  private energyRepository: EnergyRepository;
  private deviceClient: DeviceServiceClient;
  private weatherClient: WeatherServiceClient;
  private mlClient: MLServiceClient;

  constructor() {
    this.energyRepository = new EnergyRepository();
    this.deviceClient = new DeviceServiceClient();
    this.weatherClient = new WeatherServiceClient();
    this.mlClient = new MLServiceClient();
  }

  async generateRecommendations(homeId: string): Promise<EnergyRecommendation[]> {
    logger.info(`Generating energy recommendations for home: ${homeId}`);

    try {
      // Fetch required data
      const [consumption, profile, devices, weather] = await Promise.all([
        this.energyRepository.getConsumption(homeId, 'month'),
        this.energyRepository.getProfile(homeId),
        this.deviceClient.getDevices(homeId),
        this.weatherClient.getCurrentWeather(homeId),
      ]);

      const recommendations: EnergyRecommendation[] = [];

      // Analyze consumption patterns
      const highConsumers = this.identifyHighConsumers(consumption);
      const inefficientDevices = this.identifyInefficientDevices(devices, consumption);
      const loadShiftingOpportunities = await this.identifyLoadShiftingOpportunities(
        homeId,
        devices,
        profile
      );
      const hvacOptimizations = await this.analyzeHVACOptimization(homeId, devices, weather);
      const solarOptimizations = this.analyzeSolarOptimization(consumption, profile);

      // Generate recommendations for high consumers
      for (const device of highConsumers) {
        recommendations.push({
          id: `high-consumer-${device.deviceId}`,
          homeId,
          type: 'device',
          title: `Optimize ${device.deviceName} Usage`,
          description: `${device.deviceName} is consuming ${device.percentage.toFixed(1)}% of your total energy. Consider reducing usage or replacing with a more efficient model.`,
          potentialSavings: Math.min(device.percentage * 0.3, 15),
          estimatedCostSavings: device.cost * 0.3,
          difficulty: 'medium',
          priority: Math.floor(device.percentage / 10),
          actions: [
            `Review ${device.deviceName} usage patterns`,
            'Consider scheduling usage during off-peak hours',
            'Check for energy-efficient alternatives',
          ],
          createdAt: new Date(),
          implemented: false,
        });
      }

      // Generate recommendations for inefficient devices
      for (const device of inefficientDevices) {
        recommendations.push({
          id: `inefficient-${device.id}`,
          homeId,
          type: 'upgrade',
          title: `Replace ${device.name} with Energy-Efficient Model`,
          description: `${device.name} is operating inefficiently. Upgrading to an Energy Star certified model could save significant energy.`,
          potentialSavings: 20,
          estimatedCostSavings: 50,
          difficulty: 'hard',
          priority: 5,
          actions: [
            'Research Energy Star certified alternatives',
            'Calculate payback period',
            'Schedule replacement',
          ],
          createdAt: new Date(),
          implemented: false,
        });
      }

      // Generate load shifting recommendations
      for (const opportunity of loadShiftingOpportunities) {
        recommendations.push({
          id: `load-shift-${opportunity.deviceId}`,
          homeId,
          type: 'schedule',
          title: `Shift ${opportunity.deviceName} to Off-Peak Hours`,
          description: opportunity.reason,
          potentialSavings: opportunity.savingsPercentage,
          estimatedCostSavings: consumption.totalCost * (opportunity.savingsPercentage / 100),
          difficulty: 'easy',
          priority: 8,
          actions: [
            `Schedule ${opportunity.deviceName} to run from ${opportunity.recommendedSchedule.start} to ${opportunity.recommendedSchedule.end}`,
            'Enable smart scheduling automation',
          ],
          createdAt: new Date(),
          implemented: false,
        });
      }

      // Generate HVAC optimization recommendations
      for (const optimization of hvacOptimizations) {
        recommendations.push(optimization);
      }

      // Generate solar optimization recommendations
      for (const optimization of solarOptimizations) {
        recommendations.push(optimization);
      }

      // Sort by priority and potential savings
      recommendations.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return b.potentialSavings - a.potentialSavings;
      });

      logger.info(`Generated ${recommendations.length} energy recommendations`);
      return recommendations;
    } catch (error) {
      logger.error('Failed to generate energy recommendations', error as Error);
      throw error;
    }
  }

  private identifyHighConsumers(consumption: EnergyConsumption): DeviceEnergyBreakdown[] {
    if (!consumption.deviceBreakdown) return [];

    // Identify devices consuming more than 10% of total energy
    return consumption.deviceBreakdown
      .filter((device) => device.percentage > 10)
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);
  }

  private identifyInefficientDevices(
    devices: Device[],
    consumption: EnergyConsumption
  ): Device[] {
    const inefficient: Device[] = [];

    for (const device of devices) {
      const deviceConsumption = consumption.deviceBreakdown?.find(
        (d) => d.deviceId === device.id
      );

      if (!deviceConsumption) continue;

      // Check if device is consuming more energy than expected
      const expectedConsumption = this.getExpectedConsumption(device);
      const actualConsumption = deviceConsumption.energyWh;

      if (actualConsumption > expectedConsumption * 1.5) {
        inefficient.push(device);
      }
    }

    return inefficient;
  }

  private getExpectedConsumption(device: Device): number {
    // Expected consumption in Wh based on device type
    const expectedConsumption: Record<string, number> = {
      light: 100,
      thermostat: 5000,
      plug: 500,
      appliance: 2000,
      fan: 300,
      heater: 3000,
      cooler: 2500,
    };

    return expectedConsumption[device.type] || 1000;
  }

  private async identifyLoadShiftingOpportunities(
    homeId: string,
    devices: Device[],
    profile: EnergyProfile
  ): Promise<LoadShiftingOpportunity[]> {
    const opportunities: LoadShiftingOpportunity[] = [];

    // Identify devices that can be scheduled
    const schedulableDevices = devices.filter((device) =>
      ['appliance', 'heater', 'cooler', 'plug'].includes(device.type)
    );

    for (const device of schedulableDevices) {
      // Get device usage pattern
      const usagePattern = await this.mlClient.getDeviceUsagePattern(device.id);

      if (!usagePattern) continue;

      // Check if device is running during peak hours
      const isPeakUsage = this.isRunningDuringPeakHours(usagePattern, profile.peakHours);

      if (isPeakUsage) {
        const offPeakSchedule = this.findOptimalOffPeakSchedule(
          usagePattern.duration,
          profile.peakHours
        );

        opportunities.push({
          deviceId: device.id,
          deviceName: device.name,
          currentSchedule: {
            start: usagePattern.typicalStartTime,
            end: usagePattern.typicalEndTime,
          },
          recommendedSchedule: offPeakSchedule,
          savingsPercentage: this.calculateLoadShiftSavings(profile),
          reason: `${device.name} typically runs during peak hours when electricity rates are higher. Shifting to off-peak hours could save ${this.calculateLoadShiftSavings(profile).toFixed(1)}%.`,
        });
      }
    }

    return opportunities;
  }

  private isRunningDuringPeakHours(
    usagePattern: any,
    peakHours: { start: string; end: string }[]
  ): boolean {
    const startHour = parseInt(usagePattern.typicalStartTime.split(':')[0]);

    for (const peak of peakHours) {
      const peakStart = parseInt(peak.start.split(':')[0]);
      const peakEnd = parseInt(peak.end.split(':')[0]);

      if (startHour >= peakStart && startHour < peakEnd) {
        return true;
      }
    }

    return false;
  }

  private findOptimalOffPeakSchedule(
    duration: number,
    peakHours: { start: string; end: string }[]
  ): { start: string; end: string } {
    // Find the best off-peak window
    // Prefer late night/early morning hours
    const offPeakStart = 2; // 2 AM
    const offPeakEnd = offPeakStart + Math.ceil(duration / 60);

    return {
      start: `${offPeakStart.toString().padStart(2, '0')}:00`,
      end: `${offPeakEnd.toString().padStart(2, '0')}:00`,
    };
  }

  private calculateLoadShiftSavings(profile: EnergyProfile): number {
    // Calculate savings from shifting from peak to off-peak
    const peakRate = profile.peakRate || profile.utilityRate * 1.5;
    const offPeakRate = profile.offPeakRate || profile.utilityRate * 0.7;

    return ((peakRate - offPeakRate) / peakRate) * 100;
  }

  private async analyzeHVACOptimization(
    homeId: string,
    devices: Device[],
    weather: WeatherData
  ): Promise<EnergyRecommendation[]> {
    const recommendations: EnergyRecommendation[] = [];

    const hvacDevices = devices.filter((d) => d.type === 'thermostat');

    for (const device of hvacDevices) {
      // Get current thermostat settings
      const state = await this.deviceClient.getDeviceState(device.id);
      const targetTemp = state.attributes.target_temperature;
      const currentTemp = state.attributes.current_temperature;

      // Analyze temperature setpoint
      if (Math.abs(targetTemp - currentTemp) > 3) {
        recommendations.push({
          id: `hvac-setpoint-${device.id}`,
          homeId,
          type: 'behavior',
          title: 'Optimize Thermostat Setpoint',
          description: `Your thermostat is set ${targetTemp > currentTemp ? 'higher' : 'lower'} than the current temperature. Adjusting by 2-3 degrees could save 10-15% on heating/cooling costs.`,
          potentialSavings: 12,
          estimatedCostSavings: 30,
          difficulty: 'easy',
          priority: 9,
          actions: [
            'Adjust thermostat setpoint by 2-3 degrees',
            'Enable smart scheduling',
            'Use eco mode when away',
          ],
          createdAt: new Date(),
          implemented: false,
        });
      }

      // Check for weather-based optimization
      if (weather.temperature < 15 || weather.temperature > 25) {
        recommendations.push({
          id: `hvac-weather-${device.id}`,
          homeId,
          type: 'behavior',
          title: 'Weather-Based HVAC Optimization',
          description: `Current outdoor temperature is ${weather.temperature}°C. Consider adjusting your thermostat or using natural ventilation to reduce HVAC usage.`,
          potentialSavings: 8,
          estimatedCostSavings: 20,
          difficulty: 'easy',
          priority: 7,
          actions: [
            'Open windows for natural ventilation',
            'Adjust thermostat based on outdoor temperature',
            'Enable weather-based automation',
          ],
          createdAt: new Date(),
          implemented: false,
        });
      }
    }

    return recommendations;
  }

  private analyzeSolarOptimization(
    consumption: EnergyConsumption,
    profile: EnergyProfile
  ): EnergyRecommendation[] {
    const recommendations: EnergyRecommendation[] = [];

    if (!profile.solarEnabled) {
      // Recommend solar installation
      if (consumption.totalEnergyWh > 500000) {
        // > 500 kWh per month
        recommendations.push({
          id: 'solar-installation',
          homeId: profile.homeId!,
          type: 'upgrade',
          title: 'Consider Solar Panel Installation',
          description: `Your monthly energy consumption is ${(consumption.totalEnergyWh / 1000).toFixed(0)} kWh. Solar panels could significantly reduce your electricity bills and carbon footprint.`,
          potentialSavings: 40,
          estimatedCostSavings: consumption.totalCost * 0.4,
          difficulty: 'hard',
          priority: 6,
          actions: [
            'Get solar installation quotes',
            'Calculate ROI and payback period',
            'Check for government incentives',
            'Assess roof suitability',
          ],
          createdAt: new Date(),
          implemented: false,
        });
      }
    } else {
      // Optimize existing solar system
      const solarProduction = consumption.solarProductionWh || 0;
      const gridExport = consumption.gridExportWh || 0;

      if (gridExport > solarProduction * 0.3) {
        recommendations.push({
          id: 'solar-battery',
          homeId: profile.homeId!,
          type: 'upgrade',
          title: 'Add Battery Storage',
          description: `You're exporting ${(gridExport / 1000).toFixed(0)} kWh to the grid. Adding battery storage could store this excess energy for use during peak hours, increasing savings.`,
          potentialSavings: 25,
          estimatedCostSavings: gridExport * profile.gridExportRate! * 0.5,
          difficulty: 'hard',
          priority: 7,
          actions: [
            'Research battery storage options',
            'Calculate storage capacity needed',
            'Get installation quotes',
            'Check for incentives',
          ],
          createdAt: new Date(),
          implemented: false,
        });
      }

      // Recommend load shifting to solar hours
      recommendations.push({
        id: 'solar-load-shift',
        homeId: profile.homeId!,
        type: 'schedule',
        title: 'Maximize Solar Self-Consumption',
        description: 'Schedule high-energy devices to run during peak solar production hours (10 AM - 3 PM) to maximize self-consumption and reduce grid dependency.',
        potentialSavings: 15,
        estimatedCostSavings: consumption.totalCost * 0.15,
        difficulty: 'easy',
        priority: 8,
        actions: [
          'Schedule dishwasher, washing machine during solar hours',
          'Charge electric vehicles during daytime',
          'Run pool pumps during peak solar production',
          'Enable smart solar optimization',
        ],
        createdAt: new Date(),
        implemented: false,
      });
    }

    return recommendations;
  }

  async optimizeDeviceSchedule(
    homeId: string,
    deviceId: string
  ): Promise<{ start: string; end: string }> {
    logger.info(`Optimizing schedule for device: ${deviceId}`);

    const profile = await this.energyRepository.getProfile(homeId);
    const device = await this.deviceClient.getDevice(deviceId);
    const usagePattern = await this.mlClient.getDeviceUsagePattern(deviceId);

    // Find optimal time window based on:
    // 1. Off-peak electricity rates
    // 2. Solar production (if available)
    // 3. User preferences
    // 4. Device constraints

    const optimalSchedule = this.findOptimalOffPeakSchedule(
      usagePattern.duration,
      profile.peakHours
    );

    return optimalSchedule;
  }

  async calculatePotentialSavings(
    homeId: string,
    recommendations: EnergyRecommendation[]
  ): Promise<{
    totalSavingsPercentage: number;
    totalCostSavings: number;
    savingsByCategory: Record<string, number>;
  }> {
    const consumption = await this.energyRepository.getConsumption(homeId, 'month');

    let totalSavingsPercentage = 0;
    let totalCostSavings = 0;
    const savingsByCategory: Record<string, number> = {};

    for (const rec of recommendations) {
      totalSavingsPercentage += rec.potentialSavings;
      totalCostSavings += rec.estimatedCostSavings;

      if (!savingsByCategory[rec.type]) {
        savingsByCategory[rec.type] = 0;
      }
      savingsByCategory[rec.type] += rec.estimatedCostSavings;
    }

    // Cap total savings at realistic maximum (50%)
    totalSavingsPercentage = Math.min(totalSavingsPercentage, 50);
    totalCostSavings = Math.min(totalCostSavings, consumption.totalCost * 0.5);

    return {
      totalSavingsPercentage,
      totalCostSavings,
      savingsByCategory,
    };
  }

  async implementRecommendation(
    homeId: string,
    recommendationId: string
  ): Promise<void> {
    logger.info(`Implementing recommendation: ${recommendationId}`);

    const recommendation = await this.energyRepository.getRecommendation(
      homeId,
      recommendationId
    );

    if (!recommendation) {
      throw new Error('Recommendation not found');
    }

    // Implement based on type
    switch (recommendation.type) {
      case 'schedule':
        await this.implementScheduleRecommendation(recommendation);
        break;
      case 'device':
        await this.implementDeviceRecommendation(recommendation);
        break;
      case 'behavior':
        await this.implementBehaviorRecommendation(recommendation);
        break;
      default:
        logger.warn(`Cannot auto-implement recommendation type: ${recommendation.type}`);
    }

    // Mark as implemented
    await this.energyRepository.updateRecommendation(homeId, recommendationId, {
      implemented: true,
    });

    logger.info(`Recommendation implemented: ${recommendationId}`);
  }

  private async implementScheduleRecommendation(
    recommendation: EnergyRecommendation
  ): Promise<void> {
    // Create automation to schedule device
    // This would integrate with the automation service
    logger.info('Creating schedule automation');
  }

  private async implementDeviceRecommendation(
    recommendation: EnergyRecommendation
  ): Promise<void> {
    // Adjust device settings
    logger.info('Adjusting device settings');
  }

  private async implementBehaviorRecommendation(
    recommendation: EnergyRecommendation
  ): Promise<void> {
    // Send notification to user
    logger.info('Sending behavior change notification');
  }

  async generateEnergyReport(
    homeId: string,
    period: 'day' | 'week' | 'month' | 'year'
  ): Promise<{
    consumption: EnergyConsumption;
    recommendations: EnergyRecommendation[];
    savings: any;
    trends: any;
  }> {
    logger.info(`Generating energy report for home: ${homeId}, period: ${period}`);

    const [consumption, recommendations] = await Promise.all([
      this.energyRepository.getConsumption(homeId, period),
      this.generateRecommendations(homeId),
    ]);

    const savings = await this.calculatePotentialSavings(homeId, recommendations);
    const trends = await this.analyzeTrends(homeId, period);

    return {
      consumption,
      recommendations,
      savings,
      trends,
    };
  }

  private async analyzeTrends(
    homeId: string,
    period: 'day' | 'week' | 'month' | 'year'
  ): Promise<any> {
    // Analyze energy consumption trends
    const historicalData = await this.energyRepository.getHistoricalConsumption(
      homeId,
      period,
      12
    );

    const trends = {
      consumption: this.calculateTrend(historicalData.map((d) => d.totalEnergyWh)),
      cost: this.calculateTrend(historicalData.map((d) => d.totalCost)),
      solar: this.calculateTrend(
        historicalData.map((d) => d.solarProductionWh || 0)
      ),
    };

    return trends;
  }

  private calculateTrend(data: number[]): {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  } {
    if (data.length < 2) {
      return { direction: 'stable', percentage: 0 };
    }

    const recent = data.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const previous = data.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;

    const change = ((recent - previous) / previous) * 100;

    return {
      direction: change > 2 ? 'up' : change < -2 ? 'down' : 'stable',
      percentage: Math.abs(change),
    };
  }
}
