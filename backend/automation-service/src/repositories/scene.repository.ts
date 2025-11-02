import { Scene, SceneModel } from '../models/scene.model';
import { SceneExecution, SceneExecutionModel } from '../models/scene-execution.model';
import { logger } from '../../../shared/utils/logger';

export class SceneRepository {
  async create(sceneData: Partial<Scene>): Promise<Scene> {
    try {
      const scene = new SceneModel(sceneData);
      await scene.save();
      return scene.toObject();
    } catch (error) {
      logger.error('Error creating scene:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<Scene | null> {
    try {
      const scene = await SceneModel.findById(id).lean();
      return scene;
    } catch (error) {
      logger.error('Error finding scene by ID:', error);
      throw error;
    }
  }

  async findByUserId(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ scenes: Scene[]; total: number; page: number; totalPages: number }> {
    try {
      const query = { userId, ...filters };
      const skip = (page - 1) * limit;

      const [scenes, total] = await Promise.all([
        SceneModel.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        SceneModel.countDocuments(query),
      ]);

      return {
        scenes,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error finding scenes by user ID:', error);
      throw error;
    }
  }

  async update(id: string, updateData: Partial<Scene>): Promise<Scene> {
    try {
      const scene = await SceneModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).lean();

      if (!scene) {
        throw new Error('Scene not found');
      }

      return scene;
    } catch (error) {
      logger.error('Error updating scene:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await SceneModel.findByIdAndDelete(id);
      // Also delete execution history
      await SceneExecutionModel.deleteMany({ sceneId: id });
    } catch (error) {
      logger.error('Error deleting scene:', error);
      throw error;
    }
  }

  async logExecution(executionData: Partial<SceneExecution>): Promise<SceneExecution> {
    try {
      const execution = new SceneExecutionModel(executionData);
      await execution.save();
      return execution.toObject();
    } catch (error) {
      logger.error('Error logging scene execution:', error);
      throw error;
    }
  }

  async getExecutionHistory(
    sceneId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<{ executions: SceneExecution[]; total: number; page: number; totalPages: number }> {
    try {
      const skip = (page - 1) * limit;

      const [executions, total] = await Promise.all([
        SceneExecutionModel.find({ sceneId })
          .sort({ executedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        SceneExecutionModel.countDocuments({ sceneId }),
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

  async getMostUsedScenes(userId: string, limit: number = 10): Promise<Scene[]> {
    try {
      const scenes = await SceneModel.find({ userId })
        .sort({ executionCount: -1 })
        .limit(limit)
        .lean();

      return scenes;
    } catch (error) {
      logger.error('Error getting most used scenes:', error);
      throw error;
    }
  }
}
