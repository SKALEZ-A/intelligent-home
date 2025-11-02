import { Router } from 'express';
import { DeviceController } from '../controllers/device.controller';
import { validateRequest } from '../../../shared/middleware/validation';
import { authenticate, requireHomeAccess } from '../../../backend/auth-service/src/middleware/authenticate';
import {
  createDeviceSchema,
  updateDeviceSchema,
  deviceCommandSchema,
  pairDeviceSchema,
} from '../validators/device.validators';

const router = Router();
const deviceController = new DeviceController();

// All routes require authentication
router.use(authenticate);

// Device management
router.get('/', deviceController.getDevices);
router.get('/:deviceId', deviceController.getDevice);
router.post('/', requireHomeAccess, validateRequest(createDeviceSchema), deviceController.createDevice);
router.put('/:deviceId', requireHomeAccess, validateRequest(updateDeviceSchema), deviceController.updateDevice);
router.delete('/:deviceId', requireHomeAccess, deviceController.deleteDevice);

// Device pairing
router.post('/pair', requireHomeAccess, validateRequest(pairDeviceSchema), deviceController.pairDevice);
router.post('/:deviceId/unpair', requireHomeAccess, deviceController.unpairDevice);
router.get('/discover/:protocol', requireHomeAccess, deviceController.discoverDevices);

// Device control
router.post('/:deviceId/command', requireHomeAccess, validateRequest(deviceCommandSchema), deviceController.sendCommand);
router.get('/:deviceId/state', deviceController.getDeviceState);
router.put('/:deviceId/state', requireHomeAccess, deviceController.updateDeviceState);
router.get('/:deviceId/history', deviceController.getDeviceHistory);

// Device health and diagnostics
router.get('/:deviceId/health', deviceController.getDeviceHealth);
router.post('/:deviceId/ping', requireHomeAccess, deviceController.pingDevice);
router.post('/:deviceId/restart', requireHomeAccess, deviceController.restartDevice);
router.post('/:deviceId/firmware-update', requireHomeAccess, deviceController.updateFirmware);

// Device groups
router.get('/groups', deviceController.getDeviceGroups);
router.post('/groups', requireHomeAccess, deviceController.createDeviceGroup);
router.put('/groups/:groupId', requireHomeAccess, deviceController.updateDeviceGroup);
router.delete('/groups/:groupId', requireHomeAccess, deviceController.deleteDeviceGroup);
router.post('/groups/:groupId/devices/:deviceId', requireHomeAccess, deviceController.addDeviceToGroup);
router.delete('/groups/:groupId/devices/:deviceId', requireHomeAccess, deviceController.removeDeviceFromGroup);

// Device statistics
router.get('/:deviceId/stats', deviceController.getDeviceStats);
router.get('/:deviceId/energy', deviceController.getDeviceEnergy);
router.get('/:deviceId/usage', deviceController.getDeviceUsage);

// Bulk operations
router.post('/bulk/command', requireHomeAccess, deviceController.bulkCommand);
router.post('/bulk/update', requireHomeAccess, deviceController.bulkUpdate);
router.delete('/bulk/delete', requireHomeAccess, deviceController.bulkDelete);

// Device capabilities
router.get('/:deviceId/capabilities', deviceController.getDeviceCapabilities);
router.post('/:deviceId/capabilities', requireHomeAccess, deviceController.updateDeviceCapabilities);

// Device metadata
router.get('/:deviceId/metadata', deviceController.getDeviceMetadata);
router.put('/:deviceId/metadata', requireHomeAccess, deviceController.updateDeviceMetadata);

// Device logs
router.get('/:deviceId/logs', deviceController.getDeviceLogs);
router.delete('/:deviceId/logs', requireHomeAccess, deviceController.clearDeviceLogs);

export default router;
