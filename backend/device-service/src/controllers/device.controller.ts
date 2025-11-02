import { Request, Response, NextFunction } from 'express';
import { DeviceService } from '../services/device.service';
import { DeviceCommandService } from '../services/device-command.service';
import { DeviceHealthService } from '../services/device-health.service';
import { DeviceGroupService } from '../services/device-group.service';
import { createLogger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';
import { AuthRequest } from '../../../backend/auth-service/src/middleware/authenticate';

const logger = createLogger('DeviceController');

export class DeviceController {
  private deviceService = new DeviceService();
  private commandService = new DeviceCommandService();
  private healthService = new DeviceHealthService();
  private groupService = new DeviceGroupService();

  getDevices = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { homeId, type, protocol, room, online, page = 1, limit = 50 } = req.query;

      const filters = {
        homeId: homeId as string,
        userId: req.user!.id,
        type: type as string,
        protocol: protocol as string,
        room: room as string,
        online: online === 'true' ? true : online === 'false' ? false : undefined,
      };

      const result = await this.deviceService.getDevices(
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: result.devices,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasMore: result.hasMore,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getDevice = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const device = await this.deviceService.getDeviceById(deviceId, req.user!.id);

      res.json({
        success: true,
        data: device,
      });
    } catch (error) {
      next(error);
    }
  };

  createDevice = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deviceData = {
        ...req.body,
        userId: req.user!.id,
      };

      const device = await this.deviceService.createDevice(deviceData);

      logger.info('Device created', { deviceId: device.id, userId: req.user!.id });

      res.status(201).json({
        success: true,
        data: device,
      });
    } catch (error) {
      next(error);
    }
  };

  updateDevice = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const device = await this.deviceService.updateDevice(deviceId, req.body, req.user!.id);

      logger.info('Device updated', { deviceId, userId: req.user!.id });

      res.json({
        success: true,
        data: device,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteDevice = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      await this.deviceService.deleteDevice(deviceId, req.user!.id);

      logger.info('Device deleted', { deviceId, userId: req.user!.id });

      res.json({
        success: true,
        message: 'Device deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  pairDevice = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { protocol, deviceInfo, homeId } = req.body;
      const device = await this.deviceService.pairDevice(protocol, deviceInfo, homeId, req.user!.id);

      logger.info('Device paired', { deviceId: device.id, protocol, userId: req.user!.id });

      res.status(201).json({
        success: true,
        data: device,
      });
    } catch (error) {
      next(error);
    }
  };

  unpairDevice = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      await this.deviceService.unpairDevice(deviceId, req.user!.id);

      logger.info('Device unpaired', { deviceId, userId: req.user!.id });

      res.json({
        success: true,
        message: 'Device unpaired successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  discoverDevices = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { protocol } = req.params;
      const { homeId } = req.query;

      const devices = await this.deviceService.discoverDevices(protocol, homeId as string);

      res.json({
        success: true,
        data: devices,
      });
    } catch (error) {
      next(error);
    }
  };

  sendCommand = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const { command, parameters, priority } = req.body;

      const result = await this.commandService.sendCommand(
        deviceId,
        command,
        parameters,
        req.user!.id,
        priority
      );

      logger.info('Command sent to device', { deviceId, command, userId: req.user!.id });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getDeviceState = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const state = await this.deviceService.getDeviceState(deviceId, req.user!.id);

      res.json({
        success: true,
        data: state,
      });
    } catch (error) {
      next(error);
    }
  };

  updateDeviceState = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const { attributes } = req.body;

      const state = await this.deviceService.updateDeviceState(
        deviceId,
        attributes,
        req.user!.id,
        'user'
      );

      logger.info('Device state updated', { deviceId, userId: req.user!.id });

      res.json({
        success: true,
        data: state,
      });
    } catch (error) {
      next(error);
    }
  };

  getDeviceHistory = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const { startDate, endDate, limit = 100 } = req.query;

      const history = await this.deviceService.getDeviceHistory(
        deviceId,
        req.user!.id,
        startDate as string,
        endDate as string,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  };

  getDeviceHealth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const health = await this.healthService.getDeviceHealth(deviceId, req.user!.id);

      res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      next(error);
    }
  };

  pingDevice = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const result = await this.deviceService.pingDevice(deviceId, req.user!.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  restartDevice = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      await this.deviceService.restartDevice(deviceId, req.user!.id);

      logger.info('Device restart initiated', { deviceId, userId: req.user!.id });

      res.json({
        success: true,
        message: 'Device restart initiated',
      });
    } catch (error) {
      next(error);
    }
  };

  updateFirmware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const { version } = req.body;

      await this.deviceService.updateFirmware(deviceId, version, req.user!.id);

      logger.info('Firmware update initiated', { deviceId, version, userId: req.user!.id });

      res.json({
        success: true,
        message: 'Firmware update initiated',
      });
    } catch (error) {
      next(error);
    }
  };

  getDeviceGroups = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { homeId } = req.query;
      const groups = await this.groupService.getGroups(homeId as string, req.user!.id);

      res.json({
        success: true,
        data: groups,
      });
    } catch (error) {
      next(error);
    }
  };

  createDeviceGroup = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const group = await this.groupService.createGroup(req.body, req.user!.id);

      logger.info('Device group created', { groupId: group.id, userId: req.user!.id });

      res.status(201).json({
        success: true,
        data: group,
      });
    } catch (error) {
      next(error);
    }
  };

  updateDeviceGroup = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { groupId } = req.params;
      const group = await this.groupService.updateGroup(groupId, req.body, req.user!.id);

      logger.info('Device group updated', { groupId, userId: req.user!.id });

      res.json({
        success: true,
        data: group,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteDeviceGroup = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { groupId } = req.params;
      await this.groupService.deleteGroup(groupId, req.user!.id);

      logger.info('Device group deleted', { groupId, userId: req.user!.id });

      res.json({
        success: true,
        message: 'Device group deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  addDeviceToGroup = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { groupId, deviceId } = req.params;
      await this.groupService.addDeviceToGroup(groupId, deviceId, req.user!.id);

      logger.info('Device added to group', { groupId, deviceId, userId: req.user!.id });

      res.json({
        success: true,
        message: 'Device added to group successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  removeDeviceFromGroup = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { groupId, deviceId } = req.params;
      await this.groupService.removeDeviceFromGroup(groupId, deviceId, req.user!.id);

      logger.info('Device removed from group', { groupId, deviceId, userId: req.user!.id });

      res.json({
        success: true,
        message: 'Device removed from group successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getDeviceStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const { period = 'day' } = req.query;

      const stats = await this.deviceService.getDeviceStats(deviceId, period as string, req.user!.id);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  getDeviceEnergy = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const { startDate, endDate } = req.query;

      const energy = await this.deviceService.getDeviceEnergy(
        deviceId,
        startDate as string,
        endDate as string,
        req.user!.id
      );

      res.json({
        success: true,
        data: energy,
      });
    } catch (error) {
      next(error);
    }
  };

  getDeviceUsage = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const { period = 'week' } = req.query;

      const usage = await this.deviceService.getDeviceUsage(deviceId, period as string, req.user!.id);

      res.json({
        success: true,
        data: usage,
      });
    } catch (error) {
      next(error);
    }
  };

  bulkCommand = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceIds, command, parameters } = req.body;

      const results = await this.commandService.bulkCommand(
        deviceIds,
        command,
        parameters,
        req.user!.id
      );

      logger.info('Bulk command sent', { deviceCount: deviceIds.length, command, userId: req.user!.id });

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  };

  bulkUpdate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceIds, updates } = req.body;

      const results = await this.deviceService.bulkUpdate(deviceIds, updates, req.user!.id);

      logger.info('Bulk update completed', { deviceCount: deviceIds.length, userId: req.user!.id });

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  };

  bulkDelete = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceIds } = req.body;

      await this.deviceService.bulkDelete(deviceIds, req.user!.id);

      logger.info('Bulk delete completed', { deviceCount: deviceIds.length, userId: req.user!.id });

      res.json({
        success: true,
        message: 'Devices deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  getDeviceCapabilities = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const device = await this.deviceService.getDeviceById(deviceId, req.user!.id);

      res.json({
        success: true,
        data: device.capabilities,
      });
    } catch (error) {
      next(error);
    }
  };

  updateDeviceCapabilities = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const { capabilities } = req.body;

      const device = await this.deviceService.updateDevice(
        deviceId,
        { capabilities },
        req.user!.id
      );

      logger.info('Device capabilities updated', { deviceId, userId: req.user!.id });

      res.json({
        success: true,
        data: device.capabilities,
      });
    } catch (error) {
      next(error);
    }
  };

  getDeviceMetadata = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const device = await this.deviceService.getDeviceById(deviceId, req.user!.id);

      res.json({
        success: true,
        data: device.metadata,
      });
    } catch (error) {
      next(error);
    }
  };

  updateDeviceMetadata = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const { metadata } = req.body;

      const device = await this.deviceService.updateDevice(
        deviceId,
        { metadata },
        req.user!.id
      );

      logger.info('Device metadata updated', { deviceId, userId: req.user!.id });

      res.json({
        success: true,
        data: device.metadata,
      });
    } catch (error) {
      next(error);
    }
  };

  getDeviceLogs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      const { startDate, endDate, level, limit = 100 } = req.query;

      const logs = await this.deviceService.getDeviceLogs(
        deviceId,
        req.user!.id,
        {
          startDate: startDate as string,
          endDate: endDate as string,
          level: level as string,
          limit: parseInt(limit as string),
        }
      );

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      next(error);
    }
  };

  clearDeviceLogs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { deviceId } = req.params;
      await this.deviceService.clearDeviceLogs(deviceId, req.user!.id);

      logger.info('Device logs cleared', { deviceId, userId: req.user!.id });

      res.json({
        success: true,
        message: 'Device logs cleared successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}
