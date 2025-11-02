import { Automation, AutomationModel } from '../models/automation.model';
import { AutomationExecution, AutomationExecutionModel } from '../models/automation-execution.model';
import { logger } from '../../../shared/utils/logger';

export class AutomationRepository {
  async create(automationData: Partial<Automation>): Promise<Automation> {
    try {
      const automation = new AutomationModel(automationData);
      await automation.save();
      return automation.toObject();
    } catch (error) {
      logger.error('Error creating automation:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Automation | null> {
    try {
      const automation = await AutomationModel.findById(id).lean();
      return automation;
    } catch (error) {
      logger.error('Error finding automation by ID:', error);
      throw error;
    }
  }

  async findByUserId(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ automations: Automation[]; total: number; page: number; totalPages: number }> {
    try {
      const query = { userId, ...filters };
      const skip = (page - 1) * limit;

      const [automations, total] = await Promise.all([
        AutomationModel.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AutomationModel.countDocuments(query),
      ]);

      return {
        automations,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error finding automations by user ID:', error);
      throw error;
    }
  }

  async findAll(filters: any = {}): Promise<Automation[]> {
    try {
      const automations = await AutomationModel.find(filters).lean();
      return automations;
    } catch (error) {
      logger.error('Error finding all automations:', error);
      throw error;
    }
  }

  async update(id: string, updateData: Partial<Automation>): Promise<Automation> {
    try {
      const automation = await AutomationModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).lean();

      if (!automation) {
        throw new Error('Automation not found');
      }

      return automation;
    } catch (error) {
      logger.error('Error updating automation:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await AutomationModel.findByIdAndDelete(id);
      // Also delete execution history
      await AutomationExecutionModel.deleteMany({ automationId: id });
    } catch (error) {
      logger.error('Error deleting automation:', error);
      throw error;
    }
  }

  async logExecution(executionData: Partial<AutomationExecution>): Promise<AutomationExecution> {
    try {
      const execution = new AutomationExecutionModel(executionData);
      await execution.save();
      return execution.toObject();
    } catch (error) {
      logger.error('Error logging automation execution:', error);
      throw error;
    }
  }

  async getExecutionHistory(
    automationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ executions: AutomationExecution[]; total: number; page: number; totalPages: number }> {
    try {
      const skip = (page - 1) * limit;

      const [executions, total] = await Promise.all([
        AutomationExecutionModel.find({ automationId })
          .sort({ executedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AutomationExecutionModel.countDocuments({ automationId }),
      ]);

      return {
        executions,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error getting execution history:', error);
      throw error;
    }
  }

  async getExecutionStats(automationId: string, days: number = 30): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const stats = await AutomationExecutionModel.aggregate([
        {
          $match: {
            automationId,
            executedAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: null,
            totalExecutions: { $sum: 1 },
            successfulExecutions: {
              $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
            },
            failedExecutions: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
            },
            avgExecutionTime: { $avg: '$executionTime' },
          },
        },
      ]);

      return stats[0] || {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0,
      };
    } catch (error) {
      logger.error('Error getting execution stats:', error);
      throw error;
    }
  }
}
