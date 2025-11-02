import { Router, Request, Response } from 'express';
import { nlpService } from '../services/nlp.service';
import { logger } from '../utils/logger';

const router = Router();

// Get all intents
router.get('/', async (req: Request, res: Response) => {
  try {
    const intents = nlpService.getIntents();
    res.json({ intents });
  } catch (error: any) {
    logger.error('Error fetching intents:', error);
    res.status(500).json({ error: 'Failed to fetch intents', message: error.message });
  }
});

// Add custom intent
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, patterns, entities, action } = req.body;

    if (!name || !patterns || !Array.isArray(patterns) || !action) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, patterns (array), action' 
      });
    }

    await nlpService.addCustomIntent({
      name,
      patterns,
      entities: entities || [],
      action
    });

    res.status(201).json({ 
      message: 'Custom intent added successfully',
      intent: { name, patterns, entities, action }
    });
  } catch (error: any) {
    logger.error('Error adding custom intent:', error);
    res.status(500).json({ error: 'Failed to add custom intent', message: error.message });
  }
});

export default router;
