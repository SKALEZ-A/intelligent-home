import { Router } from 'express';
import { StreamController } from '../controllers/stream.controller';
import { authenticate } from '../../../shared/middleware/authenticate';
import { validate } from '../../../shared/middleware/validation';

const router = Router();
const streamController = new StreamController();

// Apply authentication to all routes
router.use(authenticate);

// Stream management routes
router.post('/streams', streamController.createStream.bind(streamController));
router.get('/streams', streamController.listStreams.bind(streamController));
router.get('/streams/:streamId', streamController.getStream.bind(streamController));
router.delete('/streams/:streamId', streamController.deleteStream.bind(streamController));

// Stream control routes
router.post('/streams/:streamId/start', streamController.startStream.bind(streamController));
router.post('/streams/:streamId/stop', streamController.stopStream.bind(streamController));
router.post('/streams/:streamId/snapshot', streamController.takeSnapshot.bind(streamController));

// Recording routes
router.post('/streams/:streamId/recordings', streamController.startRecording.bind(streamController));
router.get('/streams/:streamId/recordings', streamController.listRecordings.bind(streamController));
router.get('/recordings/:recordingId', streamController.getRecording.bind(streamController));
router.delete('/recordings/:recordingId', streamController.deleteRecording.bind(streamController));

// Analytics routes
router.get('/streams/:streamId/analytics', streamController.getStreamAnalytics.bind(streamController));
router.get('/streams/:streamId/events', streamController.getStreamEvents.bind(streamController));

// Motion detection routes
router.post('/streams/:streamId/motion-detection', streamController.enableMotionDetection.bind(streamController));
router.delete('/streams/:streamId/motion-detection', streamController.disableMotionDetection.bind(streamController));
router.get('/streams/:streamId/motion-events', streamController.getMotionEvents.bind(streamController));

// Face recognition routes
router.post('/streams/:streamId/face-recognition', streamController.enableFaceRecognition.bind(streamController));
router.delete('/streams/:streamId/face-recognition', streamController.disableFaceRecognition.bind(streamController));
router.get('/streams/:streamId/recognized-faces', streamController.getRecognizedFaces.bind(streamController));

export default router;
