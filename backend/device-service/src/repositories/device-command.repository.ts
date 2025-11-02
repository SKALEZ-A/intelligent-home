import { Collection, Db, ObjectId } from 'mongodb';
import { DeviceCommand } from '../../../shared/types';
import { AppError } from '../../../shared/utils/errors';
import { createLogger } from '../../../shared/utils/logger';
import { getMongoDb } from '../config/mongodb';

const logger = createLogger('DeviceCommandRepository');

export class DeviceCommandRepository {
  private db: Db;
  private collection: Collection<DeviceCommand>;

  constructor() {
    this.db = getMongoDb();
    this.collection = this.db.collection('device_commands');
    this.ensureIndexes();
  }

  private async ensureIndexes(): Promise<void> {
    try {
      await this.collection.createIndex({ deviceId: 1, createdAt: -1 });
      await this.collection.createIndex({ status: 1 });
      await this.collection.createIndex({ userId: 1 });
      await this.collection.createIndex({ priority: -1 });
      await this.collection.createIndex({ createdAt: -1 });
      await this.collection.createIndex({ executedAt: -1 });
      await this.collection.createIndex({ completedAt: -1 });
    } catch (error) {
      logger.error('Error creating indexes', error as Error);
    }
  }

  async findById(id: string): Promise<DeviceCommand | null> {
    try {
      const command = await this.collection.findOne({ _id: new ObjectId(id) } as any);
      return command ? this.mapToCommand(command) : null;
    } catch (error) {
      logger.error('Error finding command by ID', error as Error);
      throw new AppError('Failed to find command', 500, 'DATABASE_ERROR');
    }
  }

  async findByDeviceId(deviceId: string, limit: number = 100): Promise<DeviceCommand[]> {
    try {
      const commands = await this.collection
        .find({ deviceId } as any)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      return commands.map(c => this.mapToCommand(c));
    } catch (error) {
      logger.error('Error finding commands by device ID', error as Error);
      throw new AppError('Failed to find commands', 500, 'DATABASE_ERROR');
    }
  }

  async findPendingCommands(deviceId?: string): Promise<DeviceCommand[]> {
    try {
      const query: any = { status: 'pending' };
      if (deviceId) {
        query.deviceId = deviceId;
      }

      const commands = await this.collection
        .find(query)
        .sort({ priority: -1, createdAt: 1 })
        .toArray();
      return commands.map(c => this.mapToCommand(c));
    } catch (error) {
      logger.error('Error finding pending commands', error as Error);
      throw new AppError('Failed to find pending commands', 500, 'DATABASE_ERROR');
    }
  }

  async create(commandData: Partial<DeviceCommand>): Promise<DeviceCommand> {
    try {
      const now = new Date();
      const command = {
        ...commandData,
        createdAt: now,
      };

      const result = await this.collection.insertOne(command as any);
      const created = await this.findById(result.insertedId.toString());

      if (!created) {
        throw new AppError('Failed to create command', 500, 'CREATE_FAILED');
      }

      logger.info('Command created', { commandId: created.id });
      return created;
    } catch (error) {
      logger.error('Error creating command', error as Error);
      throw new AppError('Failed to create command', 500, 'DATABASE_ERROR');
    }
  }

  async update(id: string, updates: Partial<DeviceCommand>): Promise<DeviceCommand> {
    try {
      const result = await this.collection.findOneAndUpdate(
        { _id: new ObjectId(id) } as any,
        { $set: updates },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new AppError('Command not found', 404, 'COMMAND_NOT_FOUND');
      }

      return this.mapToCommand(result);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating command', error as Error);
      throw new AppError('Failed to update command', 500, 'DATABASE_ERROR');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await this.collection.deleteOne({ _id: new ObjectId(id) } as any);

      if (result.deletedCount === 0) {
        throw new AppError('Command not found', 404, 'COMMAND_NOT_FOUND');
      }

      logger.info('Command deleted', { commandId: id });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error deleting command', error as Error);
      throw new AppError('Failed to delete command', 500, 'DATABASE_ERROR');
    }
  }

  async findByStatus(status: string, limit: number = 100): Promise<DeviceCommand[]> {
    try {
      const commands = await this.collection
        .find({ status } as any)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      return commands.map(c => this.mapToCommand(c));
    } catch (error) {
      logger.error('Error finding commands by status', error as Error);
      throw new AppError('Failed to find commands', 500, 'DATABASE_ERROR');
    }
  }

  async findByUserId(userId: string, limit: number = 100): Promise<DeviceCommand[]> {
    try {
      const commands = await this.collection
        .find({ userId } as any)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      return commands.map(c => this.mapToCommand(c));
    } catch (error) {
      logger.error('Error finding commands by user ID', error as Error);
      throw new AppError('Failed to find commands', 500, 'DATABASE_ERROR');
    }
  }

  async findFailedCommands(deviceId?: string, limit: number = 100): Promise<DeviceCommand[]> {
    try {
      const query: any = { status: 'failed' };
      if (deviceId) {
        query.deviceId = deviceId;
      }

      const commands = await this.collection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();
      return commands.map(c => this.mapToCommand(c));
    } catch (error) {
      logger.error('Error finding failed commands', error as Error);
      throw new AppError('Failed to find failed commands', 500, 'DATABASE_ERROR');
    }
  }

  async getCommandStats(deviceId: string, startDate: Date, endDate: Date): Promise<any> {
    try {
      const stats = await this.collection
        .aggregate([
          {
            $match: {
              deviceId,
              createdAt: { $gte: startDate, $lte: endDate },
            },
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              avgExecutionTime: {
                $avg: {
                  $subtract: ['$completedAt', '$executedAt'],
                },
              },
            },
          },
        ])
        .toArray();

      return stats;
    } catch (error) {
      logger.error('Error getting command stats', error as Error);
      throw new AppError('Failed to get command stats', 500, 'DATABASE_ERROR');
    }
  }

  async deleteOldCommands(daysOld: number): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      const result = await this.collection.deleteMany({
        createdAt: { $lt: cutoffDate },
        status: { $in: ['completed', 'failed'] },
      } as any);

      logger.info('Old commands deleted', { count: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      logger.error('Error deleting old commands', error as Error);
      throw new AppError('Failed to delete old commands', 500, 'DATABASE_ERROR');
    }
  }

  async getCommandCountByDevice(deviceId: string): Promise<number> {
    try {
      return await this.collection.countDocuments({ deviceId } as any);
    } catch (error) {
      logger.error('Error getting command count', error as Error);
      throw new AppError('Failed to get command count', 500, 'DATABASE_ERROR');
    }
  }

  async getSuccessRate(deviceId: string, days: number = 7): Promise<number> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const [total, successful] = await Promise.all([
        this.collection.countDocuments({
          deviceId,
          createdAt: { $gte: startDate },
        } as any),
        this.collection.countDocuments({
          deviceId,
          status: 'completed',
          createdAt: { $gte: startDate },
        } as any),
      ]);

      return total > 0 ? (successful / total) * 100 : 0;
    } catch (error) {
      logger.error('Error calculating success rate', error as Error);
      throw new AppError('Failed to calculate success rate', 500, 'DATABASE_ERROR');
    }
  }

  private mapToCommand(doc: any): DeviceCommand {
    return {
      ...doc,
      id: doc._id.toString(),
      _id: undefined,
    };
  }
}
