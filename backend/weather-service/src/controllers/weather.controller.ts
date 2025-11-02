import { Request, Response } from 'express';
import { WeatherService } from '../services/weather.service';
import { logger } from '../utils/logger';

const weatherService = new WeatherService();

export class WeatherController {
  async getCurrentWeather(req: Request, res: Response): Promise<void> {
    try {
      const { lat, lon } = req.query;
      
      if (!lat || !lon) {
        res.status(400).json({ error: 'Latitude and longitude are required' });
        return;
      }

      const weather = await weatherService.getCurrentWeather(
        parseFloat(lat as string),
        parseFloat(lon as string)
      );

      res.json(weather);
    } catch (error) {
      logger.error('Error in getCurrentWeather:', error);
      res.status(500).json({ error: 'Failed to fetch weather data' });
    }
  }

  async getAirQuality(req: Request, res: Response): Promise<void> {
    try {
      const { lat, lon } = req.query;
      
      if (!lat || !lon) {
        res.status(400).json({ error: 'Latitude and longitude are required' });
        return;
      }

      const airQuality = await weatherService.getAirQuality(
        parseFloat(lat as string),
        parseFloat(lon as string)
      );

      res.json(airQuality);
    } catch (error) {
      logger.error('Error in getAirQuality:', error);
      res.status(500).json({ error: 'Failed to fetch air quality data' });
    }
  }

  async getHistoricalWeather(req: Request, res: Response): Promise<void> {
    try {
      const { lat, lon, date } = req.query;
      
      if (!lat || !lon || !date) {
        res.status(400).json({ error: 'Latitude, longitude, and date are required' });
        return;
      }

      const weather = await weatherService.getHistoricalWeather(
        parseFloat(lat as string),
        parseFloat(lon as string),
        new Date(date as string)
      );

      res.json(weather);
    } catch (error) {
      logger.error('Error in getHistoricalWeather:', error);
      res.status(500).json({ error: 'Failed to fetch historical weather data' });
    }
  }
}
