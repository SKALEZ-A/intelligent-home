import { Collection, Db, ObjectId } from 'mongodb';
import { Device, DeviceState } from '../../../shared/types';
import { AppError } from '../../../shared/utils/errors';
import { createLogger } from '../../../shared/utils/logger';
import { getMongoDb } from '../config/mongodb';

const logger = createLogger('DeviceRepository');

export class DeviceRepository {
  private db: Db;
  private collection: Collection<Device>;

  constructor() {
    this.db = getMongoDb();
    this.collection = this.db.collection('devices');
    this.ensureIndexes();
  }

  private async ensureIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ homeId: 1, userId: 1 });
      await this.collection.createIndex({ type: 1 });
      await this.collection.createIndex({ protocol: 1 });
      await this.collection.createIndex({ hubId: 1 });
      await this.collection.createIndex({ isOnline: 1 });
      await this.collection.createIndex({ room: 1 });
      await this.collection.createIndex({ 'metadata.tags': 1 });
      await this.collection.createIndex({ lastSeen: -1 });
      await this.collection.createIndex({ createdAt: -1 });
    } catch (error) {
      logger.error('Error creating indexes', error as Error);
    }
  }

  async findById(id: string): Promise<Device | null> {
    try {
      const device = await this.collection.findOne({ _id: new ObjectId(id) } as any);
      return device ? this.mapToDevice(device) : null;
    } catch (error) {
      logger.error('Error finding device by ID', error as Error);
      throw new AppError('Failed to find device', 500, 'DATABASE_ERROR');
    }
  }

  async findByHomeId(homeId: string, userId: string): Promise<Device[]> {
    try {
      const devices = await this.collection
        .find({ homeId, userId } as any)
        .sort({ name: 1 })
        .toArray();
      return devices.map(d => this.mapToDevice(d));
    } catch (error) {
      logger.error('Error finding devices by home ID', error as Error);
      throw new AppError('Failed to find devices', 500, 'DATABASE_ERROR');
    }
  }

  async findWithFilters(
    filters: {
      homeId?: string;
      userId?: string;
      type?: string;
      protocol?: string;
      room?: string;
      online?: boolean;
    },
    page: number = 1,
    limit: number = 50
  ): Promise<{ devices: Device[]; total: number }> {
    try {
      const query: any = {};

      if (filters.homeId) query.homeId = filters.homeId;
      if (filters.userId) query.userId = filters.userId;
      if (filters.type) query.type = filters.type;
      if (filters.protocol) query.protocol = filters.protocol;
      if (filters.room) query.room = filters.room;
      if (filters.online !== undefined) query.isOnline = filters.online;

      const skip = (page - 1) * limit;

      const [devices, total] = await Promise.all([
        this.collection
          .find(query)
          .sort({ name: 1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        this.collection.countDocuments(query),
      ]);

      return {
        devices: devices.map(d => this.mapToDevice(d)),
        total,
      };
    } catch (error) {
      logger.error('Error finding devices with filters', error as Error);
      throw new AppError('Failed to find devices', 500, 'DATABASE_ERROR');
    }
  }

  async create(deviceData: Partial<Device>): Promise<Device> {
    try {
      const now = new Date();
      const device = {
        ...deviceData,
        createdAt: now,
        updatedAt: now,
        lastSeen: now,
        isOnline: false,
        isPaired: false,
        isReachable: false,
        state: {
          deviceId: '',
          attributes: {},
          timestamp: now,
          version: 1,
          source: 'system',
        },
      };

      const result = await this.collection.insertOne(device as any);
      const created = await this.findById(result.insertedId.toString());

      if (!created) {
        throw new AppError('Failed to create device', 500, 'CREATE_FAILED');
      }

      logger.info('Device created', { deviceId: created.id });
      return created;
    } catch (error) {
      logger.error('Error creating device', error as Error);
      throw new AppError('Failed to create device', 500, 'DATABASE_ERROR');
    }
  }

  async update(id: string, updates: Partial<Device>): Promise<Device> {
    try {
      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };

      const result = await this.collection.findOneAndUpdate(
        { _id: new ObjectId(id) } as any,
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new AppError('Device not found', 404, 'DEVICE_NOT_FOUND');
      }

      logger.info('Device updated', { deviceId: id });
      return this.mapToDevice(result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating device', error as Error);
      throw new AppError('Failed to update device', 500, 'DATABASE_ERROR');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await this.collection.deleteOne({ _id: new ObjectId(id) } as any);

      if (result.deletedCount === 0) {
        throw new AppError('Device not found', 404, 'DEVICE_NOT_FOUND');
      }

      logger.info('Device deleted', { deviceId: id });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error deleting device', error as Error);
      throw new AppError('Failed to delete device', 500, 'DATABASE_ERROR');
    }
  }

  async updateState(deviceId: string, state: Partial<DeviceState>): Promise<DeviceState> {
    try {
      const device = await this.findById(deviceId);
      if (!device) {
        throw new AppError('Device not found', 404, 'DEVICE_NOT_FOUND');
      }

      const newState: DeviceState = {
        deviceId,
        attributes: { ...device.state.attributes, ...state.attributes },
        timestamp: new Date(),
        version: device.state.version + 1,
        source: state.source || 'system',
      };

      await this.collection.updateOne(
        { _id: new ObjectId(deviceId) } as any,
        {
          $set: {
            state: newState,
            lastSeen: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      return newState;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating device state', error as Error);
      throw new AppError('Failed to update device state', 500, 'DATABASE_ERROR');
    }
  }

  async updateLastSeen(deviceId: string): Promise<void> {
    try {
      await this.collection.updateOne(
        { _id: new ObjectId(deviceId) } as any,
        {
          $set: {
            lastSeen: new Date(),
            isOnline: true,
          },
        }
      );
    } catch (error) {
      logger.error('Error updating last seen', error as Error);
    }
  }

  async setOnlineStatus(deviceId: string, isOnline: boolean): Promise<void> {
    try {
      await this.collection.updateOne(
        { _id: new ObjectId(deviceId) } as any,
        {
          $set: {
            isOnline,
            lastSeen: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      logger.info('Device online status updated', { deviceId, isOnline });
    } catch (error) {
      logger.error('Error setting online status', error as Error);
      throw new AppError('Failed to update online status', 500, 'DATABASE_ERROR');
    }
  }

  async findByHubId(hubId: string): Promise<Device[]> {
    try {
      const devices = await this.collection
        .find({ hubId } as any)
        .sort({ name: 1 })
        .toArray();
      return devices.map(d => this.mapToDevice(d));
    } catch (error) {
      logger.error('Error finding devices by hub ID', error as Error);
      throw new AppError('Failed to find devices', 500, 'DATABASE_ERROR');
    }
  }

  async findByRoom(homeId: string, room: string): Promise<Device[]> {
    try {
      const devices = await this.collection
        .find({ homeId, room } as any)
        .sort({ name: 1 })
        .toArray();
      return devices.map(d => this.mapToDevice(d));
    } catch (error) {
      logger.error('Error finding devices by room', error as Error);
      throw new AppError('Failed to find devices', 500, 'DATABASE_ERROR');
    }
  }

  async findByType(homeId: string, type: string): Promise<Device[]> {
    try {
      const devices = await this.collection
        .find({ homeId, type } as any)
        .sort({ name: 1 })
        .toArray();
      return devices.map(d => this.mapToDevice(d));
    } catch (error) {
      logger.error('Error finding devices by type', error as Error);
      throw new AppError('Failed to find devices', 500, 'DATABASE_ERROR');
    }
  }

  async findOfflineDevices(homeId: string, thresholdMinutes: number = 30): Promise<Device[]> {
    try {
      const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);
      const devices = await this.collection
        .find({
          homeId,
          lastSeen: { $lt: threshold },
          isOnline: true,
        } as any)
        .toArray();
      return devices.map(d => this.mapToDevice(d));
    } catch (error) {
      logger.error('Error finding offline devices', error as Error);
      throw new AppError('Failed to find offline devices', 500, 'DATABASE_ERROR');
    }
  }

  async updateBatteryLevel(deviceId: string, batteryLevel: number): Promise<void> {
    try {
      await this.collection.updateOne(
        { _id: new ObjectId(deviceId) } as any,
        {
          $set: {
            batteryLevel,
            updatedAt: new Date(),
          },
        }
      );
    } catch (error) {
      logger.error('Error updating battery level', error as Error);
    }
  }

  async updateSignalStrength(deviceId: string, signalStrength: number): Promise<void> {
    try {
      await this.collection.updateOne(
        { _id: new ObjectId(deviceId) } as any,
        {
          $set: {
            signalStrength,
            updatedAt: new Date(),
          },
        }
      );
    } catch (error) {
      logger.error('Error updating signal strength', error as Error);
    }
  }

  async updateFirmwareVersion(deviceId: string, firmwareVersion: string): Promise<void> {
    try {
      await this.collection.updateOne(
        { _id: new ObjectId(deviceId) } as any,
        {
          $set: {
            firmwareVersion,
            updatedAt: new Date(),
          },
        }
      );

      logger.info('Firmware version updated', { deviceId, firmwareVersion });
    } catch (error) {
      logger.error('Error updating firmware version', error as Error);
      throw new AppError('Failed to update firmware version', 500, 'DATABASE_ERROR');
    }
  }

  async bulkUpdate(deviceIds: string[], updates: Partial<Device>): Promise<number> {
    try {
      const objectIds = deviceIds.map(id => new ObjectId(id));
      const result = await this.collection.updateMany(
        { _id: { $in: objectIds } } as any,
        {
          $set: {
            ...updates,
            updatedAt: new Date(),
          },
        }
      );

      logger.info('Bulk update completed', { count: result.modifiedCount });
      return result.modifiedCount;
    } catch (error) {
      logger.error('Error in bulk update', error as Error);
      throw new AppError('Failed to bulk update devices', 500, 'DATABASE_ERROR');
    }
  }

  async bulkDelete(deviceIds: string[]): Promise<number> {
    try {
      const objectIds = deviceIds.map(id => new ObjectId(id));
      const result = await this.collection.deleteMany({ _id: { $in: objectIds } } as any);

      logger.info('Bulk delete completed', { count: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      logger.error('Error in bulk delete', error as Error);
      throw new AppError('Failed to bulk delete devices', 500, 'DATABASE_ERROR');
    }
  }

  async getDeviceCount(homeId: string): Promise<number> {
    try {
      return await this.collection.countDocuments({ homeId } as any);
    } catch (error) {
      logger.error('Error getting device count', error as Error);
      throw new AppError('Failed to get device count', 500, 'DATABASE_ERROR');
    }
  }

  async getOnlineDeviceCount(homeId: string): Promise<number> {
    try {
      return await this.collection.countDocuments({ homeId, isOnline: true } as any);
    } catch (error) {
      logger.error('Error getting online device count', error as Error);
      throw new AppError('Failed to get online device count', 500, 'DATABASE_ERROR');
    }
  }

  async getDevicesByTag(homeId: string, tag: string): Promise<Device[]> {
    try {
      const devices = await this.collection
        .find({
          homeId,
          'metadata.tags': tag,
        } as any)
        .toArray();
      return devices.map(d => this.mapToDevice(d));
    } catch (error) {
      logger.error('Error finding devices by tag', error as Error);
      throw new AppError('Failed to find devices', 500, 'DATABASE_ERROR');
    }
  }

  async searchDevices(homeId: string, searchTerm: string): Promise<Device[]> {
    try {
      const regex = new RegExp(searchTerm, 'i');
      const devices = await this.collection
        .find({
          homeId,
          $or: [
            { name: regex },
            { type: regex },
            { manufacturer: regex },
            { model: regex },
            { location: regex },
            { room: regex },
          ],
        } as any)
        .limit(50)
        .toArray();
      return devices.map(d => this.mapToDevice(d));
    } catch (error) {
      logger.error('Error searching devices', error as Error);
      throw new AppError('Failed to search devices', 500, 'DATABASE_ERROR');
    }
  }

  private mapToDevice(doc: any): Device {
    return {
      ...doc,
      id: doc._id.toString(),
      _id: undefined,
    };
  }
}
