import { Request, Response } from 'express';
import { ForecastService } from '../services/forecast.service';
import { logger } from '../utils/logger';

const forecastService = new ForecastService();

export class ForecastController {
  async getHourlyForecast(req: Request, res: Response): Promise<void> {
    try {
      const { lat, lon, hours } = req.query;
      
      if (!lat || !lon) {
        res.status(400).json({ error: 'Latitude and longitude are required' });
        return;
      }

      const forecast = await forecastService.getHourlyForecast(
        parseFloat(lat as string),
        parseFloat(lon as string),
        hours ? parseInt(hours as string) : 48
      );

      res.json(forecast);
    } catch (error) {
      logger.error('Error in getHourlyForecast:', error);
      res.status(500).json({ error: 'Failed to fetch hourly forecast' });
    }
  }

  async getDailyForecast(req: Request, res: Response): Promise<void> {
    try {
      const { lat, lon, days } = req.query;
      
      if (!lat || !lon) {
        res.status(400).json({ error: 'Latitude and longitude are required' });
        return;
      }

      const forecast = await forecastService.getDailyForecast(
        parseFloat(lat as string),
        parseFloat(lon as string),
        days ? parseInt(days as string) : 7
      );

      res.json(forecast);
    } catch (error) {
      logger.error('Error in getDailyForecast:', error);
      res.status(500).json({ error: 'Failed to fetch daily forecast' });
    }
  }

  async getExtendedForecast(req: Request, res: Response): Promise<void> {
    try {
      const { lat, lon } = req.query;
      
      if (!lat || !lon) {
        res.status(400).json({ error: 'Latitude and longitude are required' });
        return;
      }

      const forecast = await forecastService.getExtendedForecast(
        parseFloat(lat as string),
        parseFloat(lon as string)
      );

      res.json(forecast);
    } catch (error) {
      logger.error('Error in getExtendedForecast:', error);
      res.status(500).json({ error: 'Failed to fetch extended forecast' });
    }
  }

  async getPrecipitationForecast(req: Request, res: Response): Promise<void> {
    try {
      const { lat, lon } = req.query;
      
      if (!lat || !lon) {
        res.status(400).json({ error: 'Latitude and longitude are required' });
        return;
      }

      const forecast = await forecastService.getPrecipitationForecast(
        parseFloat(lat as string),
        parseFloat(lon as string)
      );

      res.json(forecast);
    } catch (error) {
      logger.error('Error in getPrecipitationForecast:', error);
      res.status(500).json({ error: 'Failed to fetch precipitation forecast' });
    }
  }
}
