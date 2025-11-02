import { Request, Response } from 'express';
import { AlertService } from '../services/alert.service';
import { logger } from '../utils/logger';

const alertService = new AlertService();

export class AlertController {
  async getActiveAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { lat, lon } = req.query;
      
      if (!lat || !lon) {
        res.status(400).json({ error: 'Latitude and longitude are required' });
        return;
      }

      const alerts = await alertService.getActiveAlerts(
        parseFloat(lat as string),
        parseFloat(lon as string)
      );

      res.json(alerts);
    } catch (error) {
      logger.error('Error in getActiveAlerts:', error);
      res.status(500).json({ error: 'Failed to fetch weather alerts' });
    }
  }

  async createCustomAlert(req: Request, res: Response): Promise<void> {
    try {
      const alertData = req.body;
      const alert = await alertService.createCustomAlert(alertData);
      res.status(201).json(alert);
    } catch (error) {
      logger.error('Error in createCustomAlert:', error);
      res.status(500).json({ error: 'Failed to create custom alert' });
    }
  }

  async subscribeToAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { locationId } = req.body;
      
      if (!locationId) {
        res.status(400).json({ error: 'Location ID is required' });
        return;
      }

      // Subscribe to alerts for this location
      alertService.subscribe(locationId, (alert) => {
        logger.info(`Alert received for ${locationId}:`, alert);
        // Send notification to user
      });

      res.json({ message: 'Successfully subscribed to alerts' });
    } catch (error) {
      logger.error('Error in subscribeToAlerts:', error);
      res.status(500).json({ error: 'Failed to subscribe to alerts' });
    }
  }
}
