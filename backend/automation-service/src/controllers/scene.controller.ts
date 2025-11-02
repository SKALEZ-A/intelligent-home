import { Request, Response, NextFunction } from 'express';
import { SceneRepository } from '../repositories/scene.repository';
import { SceneExecutorService } from '../services/scene-executor.service';
import { logger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';

export class SceneController {
  private sceneRepository: SceneRepository;
  private sceneExecutor: SceneExecutorService;

  constructor() {
    this.sceneRepository = new SceneRepository();
    this.sceneExecutor = new SceneExecutorService();
  }

  async createScene(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const sceneData = {
        ...req.body,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const scene = await this.sceneRepository.create(sceneData);

      logger.info(`Scene created: ${scene.id}`, { userId });
      res.status(201).json(scene);
    } catch (error) {
      next(error);
    }
  }

  async getScenes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { page = 1, limit = 20, category } = req.query;
      
      const filters: any = { userId };
      if (category) filters.category = category;

      const scenes = await this.sceneRepository.findByUserId(
        userId,
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.status(200).json(scenes);
    } catch (error) {
      next(error);
    }
  }

  async getSceneById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const scene = await this.sceneRepository.findById(id);
      
      if (!scene) {
        throw new AppError('Scene not found', 404);
      }

      if (scene.userId !== userId) {
        throw new AppError('Forbidden', 403);
      }

      res.status(200).json(scene);
    } catch (error) {
      next(error);
    }
  }

  async updateScene(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const scene = await this.sceneRepository.findById(id);
      
      if (!scene) {
        throw new AppError('Scene not found', 404);
      }

      if (scene.userId !== userId) {
        throw new AppError('Forbidden', 403);
      }

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      const updatedScene = await this.sceneRepository.update(id, updateData);

      logger.info(`Scene updated: ${id}`, { userId });
      res.status(200).json(updatedScene);
    } catch (error) {
      next(error);
    }
  }

  async deleteScene(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const scene = await this.sceneRepository.findById(id);
      
      if (!scene) {
        throw new AppError('Scene not found', 404);
      }

      if (scene.userId !== userId) {
        throw new AppError('Forbidden', 403);
      }

      await this.sceneRepository.delete(id);

      logger.info(`Scene deleted: ${id}`, { userId });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async executeScene(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const scene = await this.sceneRepository.findById(id);
      
      if (!scene) {
        throw new AppError('Scene not found', 404);
      }

      if (scene.userId !== userId) {
        throw new AppError('Forbidden', 403);
      }

      const result = await this.sceneExecutor.executeScene(scene);

      // Update last executed timestamp
      await this.sceneRepository.update(id, { 
        lastExecuted: new Date(),
        executionCount: (scene.executionCount || 0) + 1
      });

      logger.info(`Scene executed: ${id}`, { userId, result });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getSceneExecutionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { page = 1, limit = 50 } = req.query;

      const scene = await this.sceneRepository.findById(id);
      
      if (!scene) {
        throw new AppError('Scene not found', 404);
      }

      if (scene.userId !== userId) {
        throw new AppError('Forbidden', 403);
      }

      const history = await this.sceneRepository.getExecutionHistory(
        id,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.status(200).json(history);
    } catch (error) {
      next(error);
    }
  }
}
