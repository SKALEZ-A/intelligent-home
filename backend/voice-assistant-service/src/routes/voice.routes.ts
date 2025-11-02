import { Router } from 'express';
import { VoiceController } from '../controllers/voice.controller';
import { authenticate } from '../../../shared/middleware/authenticate';

const router = Router();
const voiceController = new VoiceController();

router.use(authenticate);

router.post('/command', voiceController.processVoiceCommand.bind(voiceController));
router.post('/profile', voiceController.createVoiceProfile.bind(voiceController));
router.post('/verify', voiceController.verifyVoice.bind(voiceController));

export default router;
