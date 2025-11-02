import { Request, Response, NextFunction } from 'express';
import { AutomationEngineService } from '../services/automation-engine.service';
import { AutomationRepository } from '../repositories/automation.repository';
import { logger } from '../../../shared/utils/logger';
import { AppError } from '../../../shared/utils/errors';

export class AutomationController {
  private automationEngine: AutomationEngineService;
  private automationRepository: AutomationRepository;

  constructor() {
    this.automationEngine = AutomationEngineService.getInstance();
    this.automationRepository = new AutomationRepository();
  }

  async createAutomation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const automationData = {
        ...req.body,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const automation = await this.automationRepository.create(automationData);
      
      if (automation.enabled) {
        await this.automationEngine.registerAutomation(automation);
      }

      logger.info(`Automation created: ${automation.id}`, { userId });
      res.status(201).json(automation);
    } catch (error) {
      next(error);
    }
  }

  async getAutomations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      const { page = 1, limit = 20, enabled, type } = req.query;
      
      const filters: any = { userId };
      if (enabled !== undefined) filters.enabled = enabled === 'true';
      if (type) filters.type = type;

      const automations = await this.automationRepository.findByUserId(
        userId,
        filters,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.status(200).json(automations);
    } catch (error) {
      next(error);
    }
  }

  async getAutomationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const automation = await this.automationRepository.findById(id);
      
      if (!automation) {
        throw new AppError('Automation not found', 404);
      }

      if (automation.userId !== userId) {
        throw new AppError('Forbidden', 403);
      }

      res.status(200).json(automation);
    } catch (error) {
      next(error);
    }
  }

  async updateAutomation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const automation = await this.automationRepository.findById(id);
      
      if (!automation) {
        throw new AppError('Automation not found', 404);
      }

      if (automation.userId !== userId) {
        throw new AppError('Forbidden', 403);
      }

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      const updatedAutomation = await this.automationRepository.update(id, updateData);

      // Re-register if enabled
      if (updatedAutomation.enabled) {
        await this.automationEngine.unregisterAutomation(id);
        await this.automationEngine.registerAutomation(updatedAutomation);
      } else {
        await this.automationEngine.unregisterAutomation(id);
      }

      logger.info(`Automation updated: ${id}`, { userId });
      res.status(200).json(updatedAutomation);
    } catch (error) {
      next(error);
    }
  }

  async deleteAutomation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const automation = await this.automationRepository.findById(id);
      
      if (!automation) {
        throw new AppError('Automation not found', 404);
      }

      if (automation.userId !== userId) {
        throw new AppError('Forbidden', 403);
      }

      await this.automationEngine.unregisterAutomation(id);
      await this.automationRepository.delete(id);

      logger.info(`Automation deleted: ${id}`, { userId });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async toggleAutomation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { enabled } = req.body;

      const automation = await this.automationRepository.findById(id);
      
      if (!automation) {
        throw new AppError('Automation not found', 404);
      }

      if (automation.userId !== userId) {
        throw new AppError('Forbidden', 403);
      }

      const updatedAutomation = await this.automationRepository.update(id, { 
        enabled,
        updatedAt: new Date()
      });

      if (enabled) {
        await this.automationEngine.registerAutomation(updatedAutomation);
      } else {
        await this.automationEngine.unregisterAutomation(id);
      }

      logger.info(`Automation ${enabled ? 'enabled' : 'disabled'}: ${id}`, { userId });
      res.status(200).json(updatedAutomation);
    } catch (error) {
      next(error);
    }
  }

  async getAutomationExecutionHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { page = 1, limit = 50 } = req.query;

      const automation = await this.automationRepository.findById(id);
      
      if (!automation) {
        throw new AppError('Automation not found', 404);
      }

      if (automation.userId !== userId) {
        throw new AppError('Forbidden', 403);
      }

      const history = await this.automationRepository.getExecutionHistory(
        id,
        parseInt(page as string),
        parseInt(limit as string)
      );

      res.status(200).json(history);
    } catch (error) {
      next(error);
    }
  }

  async testAutomation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const automation = await this.automationRepository.findById(id);
      
      if (!automation) {
        throw new AppError('Automation not found', 404);
      }

      if (automation.userId !== userId) {
        throw new AppError('Forbidden', 403);
      }

      const result = await this.automationEngine.testAutomation(automation);

      logger.info(`Automation tested: ${id}`, { userId, result });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
