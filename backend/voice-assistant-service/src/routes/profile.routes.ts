import { Router, Request, Response } from 'express';
import { voiceProfileService } from '../services/voice-profile.service';
import { logger } from '../utils/logger';

const router = Router();

// Create voice profile
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, name, language } = req.body;

    if (!userId || !name) {
      return res.status(400).json({ error: 'Missing required fields: userId, name' });
    }

    const profile = await voiceProfileService.createProfile(userId, name, language);
    res.status(201).json(profile);
  } catch (error: any) {
    logger.error('Error creating voice profile:', error);
    res.status(500).json({ error: 'Failed to create profile', message: error.message });
  }
});

// Get user's voice profiles
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profiles = await voiceProfileService.getProfilesByUser(userId);
    res.json({ profiles });
  } catch (error: any) {
    logger.error('Error fetching voice profiles:', error);
    res.status(500).json({ error: 'Failed to fetch profiles', message: error.message });
  }
});

// Get specific profile
router.get('/:profileId', async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const profile = await voiceProfileService.getProfile(profileId);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile);
  } catch (error: any) {
    logger.error('Error fetching voice profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile', message: error.message });
  }
});

// Update profile
router.put('/:profileId', async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const updates = req.body;

    const profile = await voiceProfileService.updateProfile(profileId, updates);
    res.json(profile);
  } catch (error: any) {
    logger.error('Error updating voice profile:', error);
    res.status(500).json({ error: 'Failed to update profile', message: error.message });
  }
});

// Delete profile
router.delete('/:profileId', async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    await voiceProfileService.deleteProfile(profileId);
    res.json({ message: 'Profile deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting voice profile:', error);
    res.status(500).json({ error: 'Failed to delete profile', message: error.message });
  }
});

// Get command history
router.get('/:profileId/history', async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await voiceProfileService.getCommandHistory(profileId, limit);
    res.json({ history });
  } catch (error: any) {
    logger.error('Error fetching command history:', error);
    res.status(500).json({ error: 'Failed to fetch history', message: error.message });
  }
});

// Get command statistics
router.get('/:profileId/stats', async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const stats = await voiceProfileService.getCommandStats(profileId, days);
    res.json(stats);
  } catch (error: any) {
    logger.error('Error fetching command stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
  }
});

export default router;
