import { Collection, Db, ObjectId } from 'mongodb';
import { AppError } from '../../../shared/utils/errors';
import { createLogger } from '../../../shared/utils/logger';
import { getMongoDb } from '../config/mongodb';
import { DeviceRepository } from '../repositories/device.repository';

const logger = createLogger('DeviceGroupService');

interface DeviceGroup {
  id: string;
  name: string;
  description?: string;
  homeId: string;
  userId: string;
  deviceIds: string[];
  icon?: string;
  color?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class DeviceGroupService {
  private db: Db;
  private collection: Collection<DeviceGroup>;
  private deviceRepository = new DeviceRepository();

  constructor() {
    this.db = getMongoDb();
    this.collection = this.db.collection('device_groups');
    this.ensureIndexes();
  }

  private async ensureIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ homeId: 1, userId: 1 });
      await this.collection.createIndex({ name: 1 });
      await this.collection.createIndex({ tags: 1 });
      await this.collection.createIndex({ createdAt: -1 });
    } catch (error) {
      logger.error('Error creating indexes', error as Error);
    }
  }

  async getGroups(homeId: string, userId: string): Promise<DeviceGroup[]> {
    try {
      const groups = await this.collection
        .find({ homeId, userId } as any)
        .sort({ name: 1 })
        .toArray();
      return groups.map(g => this.mapToGroup(g));
    } catch (error) {
      logger.error('Error getting groups', error as Error);
      throw new AppError('Failed to get groups', 500, 'DATABASE_ERROR');
    }
  }

  async getGroupById(groupId: string, userId: string): Promise<DeviceGroup> {
    try {
      const group = await this.collection.findOne({ _id: new ObjectId(groupId) } as any);
      
      if (!group) {
        throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
      }

      if (group.userId !== userId) {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      return this.mapToGroup(group);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting group by ID', error as Error);
      throw new AppError('Failed to get group', 500, 'DATABASE_ERROR');
    }
  }

  async createGroup(groupData: Partial<DeviceGroup>, userId: string): Promise<DeviceGroup> {
    try {
      const now = new Date();
      const group = {
        ...groupData,
        userId,
        deviceIds: groupData.deviceIds || [],
        tags: groupData.tags || [],
        createdAt: now,
        updatedAt: now,
      };

      const result = await this.collection.insertOne(group as any);
      const created = await this.collection.findOne({ _id: result.insertedId } as any);

      if (!created) {
        throw new AppError('Failed to create group', 500, 'CREATE_FAILED');
      }

      logger.info('Device group created', { groupId: created._id.toString(), userId });
      return this.mapToGroup(created);
    } catch (error) {
      logger.error('Error creating group', error as Error);
      throw new AppError('Failed to create group', 500, 'DATABASE_ERROR');
    }
  }

  async updateGroup(groupId: string, updates: Partial<DeviceGroup>, userId: string): Promise<DeviceGroup> {
    try {
      // Verify ownership
      await this.getGroupById(groupId, userId);

      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };

      const result = await this.collection.findOneAndUpdate(
        { _id: new ObjectId(groupId) } as any,
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
      }

      logger.info('Device group updated', { groupId, userId });
      return this.mapToGroup(result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating group', error as Error);
      throw new AppError('Failed to update group', 500, 'DATABASE_ERROR');
    }
  }

  async deleteGroup(groupId: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      await this.getGroupById(groupId, userId);

      const result = await this.collection.deleteOne({ _id: new ObjectId(groupId) } as any);

      if (result.deletedCount === 0) {
        throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
      }

      logger.info('Device group deleted', { groupId, userId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error deleting group', error as Error);
      throw new AppError('Failed to delete group', 500, 'DATABASE_ERROR');
    }
  }

  async addDeviceToGroup(groupId: string, deviceId: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      const group = await this.getGroupById(groupId, userId);

      // Verify device exists and user has access
      const device = await this.deviceRepository.findById(deviceId);
      if (!device) {
        throw new AppError('Device not found', 404, 'DEVICE_NOT_FOUND');
      }

      if (device.userId !== userId) {
        throw new AppError('Access denied to device', 403, 'ACCESS_DENIED');
      }

      // Check if device is already in group
      if (group.deviceIds.includes(deviceId)) {
        throw new AppError('Device already in group', 400, 'DEVICE_ALREADY_IN_GROUP');
      }

      await this.collection.updateOne(
        { _id: new ObjectId(groupId) } as any,
        {
          $push: { deviceIds: deviceId },
          $set: { updatedAt: new Date() },
        }
      );

      logger.info('Device added to group', { groupId, deviceId, userId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error adding device to group', error as Error);
      throw new AppError('Failed to add device to group', 500, 'DATABASE_ERROR');
    }
  }

  async removeDeviceFromGroup(groupId: string, deviceId: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      await this.getGroupById(groupId, userId);

      await this.collection.updateOne(
        { _id: new ObjectId(groupId) } as any,
        {
          $pull: { deviceIds: deviceId },
          $set: { updatedAt: new Date() },
        }
      );

      logger.info('Device removed from group', { groupId, deviceId, userId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error removing device from group', error as Error);
      throw new AppError('Failed to remove device from group', 500, 'DATABASE_ERROR');
    }
  }

  async getGroupDevices(groupId: string, userId: string): Promise<any[]> {
    try {
      const group = await this.getGroupById(groupId, userId);
      
      const devices = await Promise.all(
        group.deviceIds.map(deviceId => 
          this.deviceRepository.findById(deviceId).catch(() => null)
        )
      );

      return devices.filter(d => d !== null);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting group devices', error as Error);
      throw new AppError('Failed to get group devices', 500, 'DATABASE_ERROR');
    }
  }

  async getDeviceGroups(deviceId: string, userId: string): Promise<DeviceGroup[]> {
    try {
      const groups = await this.collection
        .find({
          userId,
          deviceIds: deviceId,
        } as any)
        .toArray();

      return groups.map(g => this.mapToGroup(g));
    } catch (error) {
      logger.error('Error getting device groups', error as Error);
      throw new AppError('Failed to get device groups', 500, 'DATABASE_ERROR');
    }
  }

  async bulkAddDevices(groupId: string, deviceIds: string[], userId: string): Promise<void> {
    try {
      // Verify ownership
      await this.getGroupById(groupId, userId);

      // Verify all devices exist and user has access
      const devices = await Promise.all(
        deviceIds.map(id => this.deviceRepository.findById(id))
      );

      const invalidDevices = devices.filter(d => !d || d.userId !== userId);
      if (invalidDevices.length > 0) {
        throw new AppError('Some devices not found or access denied', 400, 'INVALID_DEVICES');
      }

      await this.collection.updateOne(
        { _id: new ObjectId(groupId) } as any,
        {
          $addToSet: { deviceIds: { $each: deviceIds } },
          $set: { updatedAt: new Date() },
        }
      );

      logger.info('Devices bulk added to group', { groupId, count: deviceIds.length, userId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error bulk adding devices to group', error as Error);
      throw new AppError('Failed to bulk add devices to group', 500, 'DATABASE_ERROR');
    }
  }

  async bulkRemoveDevices(groupId: string, deviceIds: string[], userId: string): Promise<void> {
    try {
      // Verify ownership
      await this.getGroupById(groupId, userId);

      await this.collection.updateOne(
        { _id: new ObjectId(groupId) } as any,
        {
          $pullAll: { deviceIds },
          $set: { updatedAt: new Date() },
        }
      );

      logger.info('Devices bulk removed from group', { groupId, count: deviceIds.length, userId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error bulk removing devices from group', error as Error);
      throw new AppError('Failed to bulk remove devices from group', 500, 'DATABASE_ERROR');
    }
  }

  async searchGroups(homeId: string, userId: string, searchTerm: string): Promise<DeviceGroup[]> {
    try {
      const regex = new RegExp(searchTerm, 'i');
      const groups = await this.collection
        .find({
          homeId,
          userId,
          $or: [
            { name: regex },
            { description: regex },
            { tags: regex },
          ],
        } as any)
        .limit(50)
        .toArray();

      return groups.map(g => this.mapToGroup(g));
    } catch (error) {
      logger.error('Error searching groups', error as Error);
      throw new AppError('Failed to search groups', 500, 'DATABASE_ERROR');
    }
  }

  async getGroupsByTag(homeId: string, userId: string, tag: string): Promise<DeviceGroup[]> {
    try {
      const groups = await this.collection
        .find({
          homeId,
          userId,
          tags: tag,
        } as any)
        .toArray();

      return groups.map(g => this.mapToGroup(g));
    } catch (error) {
      logger.error('Error getting groups by tag', error as Error);
      throw new AppError('Failed to get groups by tag', 500, 'DATABASE_ERROR');
    }
  }

  async duplicateGroup(groupId: string, newName: string, userId: string): Promise<DeviceGroup> {
    try {
      const originalGroup = await this.getGroupById(groupId, userId);

      const newGroup = {
        ...originalGroup,
        id: undefined,
        name: newName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return await this.createGroup(newGroup, userId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error duplicating group', error as Error);
      throw new AppError('Failed to duplicate group', 500, 'DATABASE_ERROR');
    }
  }

  async mergeGroups(groupIds: string[], newName: string, userId: string): Promise<DeviceGroup> {
    try {
      // Get all groups and verify ownership
      const groups = await Promise.all(
        groupIds.map(id => this.getGroupById(id, userId))
      );

      // Merge device IDs (remove duplicates)
      const allDeviceIds = [...new Set(groups.flatMap(g => g.deviceIds))];

      // Merge tags (remove duplicates)
      const allTags = [...new Set(groups.flatMap(g => g.tags))];

      // Create new merged group
      const mergedGroup = await this.createGroup({
        name: newName,
        homeId: groups[0].homeId,
        deviceIds: allDeviceIds,
        tags: allTags,
        description: `Merged from ${groups.length} groups`,
      }, userId);

      logger.info('Groups merged', { newGroupId: mergedGroup.id, sourceGroupCount: groups.length, userId });

      return mergedGroup;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error merging groups', error as Error);
      throw new AppError('Failed to merge groups', 500, 'DATABASE_ERROR');
    }
  }

  async getGroupStats(groupId: string, userId: string): Promise<any> {
    try {
      const group = await this.getGroupById(groupId, userId);
      const devices = await this.getGroupDevices(groupId, userId);

      const onlineCount = devices.filter(d => d.isOnline).length;
      const offlineCount = devices.length - onlineCount;

      const deviceTypes = devices.reduce((acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const avgBatteryLevel = devices
        .filter(d => d.batteryLevel !== undefined)
        .reduce((sum, d) => sum + d.batteryLevel!, 0) / devices.length || null;

      return {
        groupId: group.id,
        name: group.name,
        totalDevices: devices.length,
        onlineDevices: onlineCount,
        offlineDevices: offlineCount,
        deviceTypes,
        avgBatteryLevel,
        lastUpdated: group.updatedAt,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error getting group stats', error as Error);
      throw new AppError('Failed to get group stats', 500, 'DATABASE_ERROR');
    }
  }

  private mapToGroup(doc: any): DeviceGroup {
    return {
      ...doc,
      id: doc._id.toString(),
      _id: undefined,
    };
  }
}
