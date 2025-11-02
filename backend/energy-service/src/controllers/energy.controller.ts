import { Request, Response } from 'express';
import { EnergyService } from '../services/energy.service';
import { logger } from '../../../shared/utils/logger';

export class EnergyController {
  private energyService: EnergyService;

  constructor() {
    this.energyService = new EnergyService();
  }

  async getConsumption(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { startDate, endDate, interval = 'hour' } = req.query;

      const consumption = await this.energyService.getConsumption(
        userId,
        new Date(startDate as string),
        new Date(endDate as string),
        interval as string
      );

      res.json({
        success: true,
        data: consumption,
      });
    } catch (error: any) {
      logger.error('Failed to get consumption', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getDeviceConsumption(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const { startDate, endDate } = req.query;

      const consumption = await this.energyService.getDeviceConsumption(
        deviceId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: consumption,
      });
    } catch (error: any) {
      logger.error('Failed to get device consumption', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getConsumptionSummary(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { period = 'day' } = req.query;

      const summary = await this.energyService.getConsumptionSummary(
        userId,
        period as string
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      logger.error('Failed to get consumption summary', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { period = 'week' } = req.query;

      const analytics = await this.energyService.getAnalytics(userId, period as string);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error: any) {
      logger.error('Failed to get analytics', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getTrends(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { period = 'month' } = req.query;

      const trends = await this.energyService.getTrends(userId, period as string);

      res.json({
        success: true,
        data: trends,
      });
    } catch (error: any) {
      logger.error('Failed to get trends', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getComparison(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { period1, period2 } = req.query;

      const comparison = await this.energyService.getComparison(
        userId,
        period1 as string,
        period2 as string
      );

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error: any) {
      logger.error('Failed to get comparison', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getForecast(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { hoursAhead = 24 } = req.query;

      const forecast = await this.energyService.getForecast(
        userId,
        parseInt(hoursAhead as string)
      );

      res.json({
        success: true,
        data: forecast,
      });
    } catch (error: any) {
      logger.error('Failed to get forecast', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getDeviceForecast(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.params;
      const { hoursAhead = 24 } = req.query;

      const forecast = await this.energyService.getDeviceForecast(
        deviceId,
        parseInt(hoursAhead as string)
      );

      res.json({
        success: true,
        data: forecast,
      });
    } catch (error: any) {
      logger.error('Failed to get device forecast', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getProfiles(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      const profiles = await this.energyService.getProfiles(userId);

      res.json({
        success: true,
        data: profiles,
      });
    } catch (error: any) {
      logger.error('Failed to get profiles', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const profile = await this.energyService.getProfile(id);

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      logger.error('Failed to get profile', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async createProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const profileData = req.body;

      const profile = await this.energyService.createProfile({
        ...profileData,
        userId,
      });

      res.status(201).json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      logger.error('Failed to create profile', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = req.body;

      const profile = await this.energyService.updateProfile(id, updates);

      res.json({
        success: true,
        data: profile,
      });
    } catch (error: any) {
      logger.error('Failed to update profile', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async deleteProfile(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await this.energyService.deleteProfile(id);

      res.json({
        success: true,
        message: 'Profile deleted successfully',
      });
    } catch (error: any) {
      logger.error('Failed to delete profile', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      const recommendations = await this.energyService.getOptimizationRecommendations(
        userId
      );

      res.json({
        success: true,
        data: recommendations,
      });
    } catch (error: any) {
      logger.error('Failed to get recommendations', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async applyOptimization(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { recommendationIds } = req.body;

      const result = await this.energyService.applyOptimization(
        userId,
        recommendationIds
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Failed to apply optimization', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getSavings(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { period = 'month' } = req.query;

      const savings = await this.energyService.getSavings(userId, period as string);

      res.json({
        success: true,
        data: savings,
      });
    } catch (error: any) {
      logger.error('Failed to get savings', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getLoadStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      const status = await this.energyService.getLoadStatus(userId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      logger.error('Failed to get load status', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async balanceLoad(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { strategy } = req.body;

      const result = await this.energyService.balanceLoad(userId, strategy);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Failed to balance load', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getLoadSchedule(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      const schedule = await this.energyService.getLoadSchedule(userId);

      res.json({
        success: true,
        data: schedule,
      });
    } catch (error: any) {
      logger.error('Failed to get load schedule', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getCost(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { startDate, endDate } = req.query;

      const cost = await this.energyService.getCost(
        userId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: cost,
      });
    } catch (error: any) {
      logger.error('Failed to get cost', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getCostBreakdown(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { period = 'month' } = req.query;

      const breakdown = await this.energyService.getCostBreakdown(
        userId,
        period as string
      );

      res.json({
        success: true,
        data: breakdown,
      });
    } catch (error: any) {
      logger.error('Failed to get cost breakdown', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getCostProjection(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { months = 3 } = req.query;

      const projection = await this.energyService.getCostProjection(
        userId,
        parseInt(months as string)
      );

      res.json({
        success: true,
        data: projection,
      });
    } catch (error: any) {
      logger.error('Failed to get cost projection', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getCarbonFootprint(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { period = 'month' } = req.query;

      const footprint = await this.energyService.getCarbonFootprint(
        userId,
        period as string
      );

      res.json({
        success: true,
        data: footprint,
      });
    } catch (error: any) {
      logger.error('Failed to get carbon footprint', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getCarbonOffset(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      const offset = await this.energyService.getCarbonOffset(userId);

      res.json({
        success: true,
        data: offset,
      });
    } catch (error: any) {
      logger.error('Failed to get carbon offset', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getDailyReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { date } = req.query;

      const report = await this.energyService.getDailyReport(
        userId,
        date ? new Date(date as string) : new Date()
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Failed to get daily report', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getWeeklyReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { week } = req.query;

      const report = await this.energyService.getWeeklyReport(userId, week as string);

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Failed to get weekly report', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async getMonthlyReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { month, year } = req.query;

      const report = await this.energyService.getMonthlyReport(
        userId,
        parseInt(month as string),
        parseInt(year as string)
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Failed to get monthly report', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  async exportReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { format = 'pdf', period = 'month' } = req.query;

      const report = await this.energyService.exportReport(
        userId,
        format as string,
        period as string
      );

      res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=energy-report-${period}.${format}`
      );
      res.send(report);
    } catch (error: any) {
      logger.error('Failed to export report', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
}
