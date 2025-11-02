import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { createLogger } from '../../../../shared/utils/logger';
import { ValidationError, AuthenticationError } from '../../../../shared/utils/errors';

const logger = createLogger('AuthController');
const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, firstName, lastName, phoneNumber } = req.body;
      
      logger.info(`Registration attempt for email: ${email}`);
      
      const result = await authService.register({
        email,
        password,
        firstName,
        lastName,
        phoneNumber,
      });

      res.status(201).json({
        success: true,
        data: result,
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, mfaCode } = req.body;
      const userAgent = req.headers['user-agent'] || 'unknown';
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

      logger.info(`Login attempt for email: ${email}`);

      const result = await authService.login({
        email,
        password,
        mfaCode,
        userAgent,
        ipAddress,
      });

      res.json({
        success: true,
        data: result,
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      const result = await authService.refreshToken(refreshToken);

      res.json({
        success: true,
        data: result,
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const token = req.headers.authorization?.split(' ')[1];

      if (!userId || !token) {
        throw new AuthenticationError('Invalid session');
      }

      await authService.logout(userId, token);

      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AuthenticationError('User not authenticated');
      }

      const user = await authService.getUserById(userId);

      res.json({
        success: true,
        data: user,
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const updates = req.body;

      if (!userId) {
        throw new AuthenticationError('User not authenticated');
      }

      const user = await authService.updateProfile(userId, updates);

      res.json({
        success: true,
        data: user,
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async enableMFA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AuthenticationError('User not authenticated');
      }

      const result = await authService.enableMFA(userId);

      res.json({
        success: true,
        data: result,
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async disableMFA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { password } = req.body;

      if (!userId) {
        throw new AuthenticationError('User not authenticated');
      }

      await authService.disableMFA(userId, password);

      res.json({
        success: true,
        data: { message: 'MFA disabled successfully' },
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyMFA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { code } = req.body;

      if (!userId) {
        throw new AuthenticationError('User not authenticated');
      }

      const result = await authService.verifyMFA(userId, code);

      res.json({
        success: true,
        data: result,
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      await authService.requestPasswordReset(email);

      res.json({
        success: true,
        data: { message: 'Password reset email sent if account exists' },
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async confirmPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      await authService.confirmPasswordReset(token, newPassword);

      res.json({
        success: true,
        data: { message: 'Password reset successfully' },
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;

      await authService.verifyEmail(token);

      res.json({
        success: true,
        data: { message: 'Email verified successfully' },
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        throw new AuthenticationError('User not authenticated');
      }

      await authService.changePassword(userId, currentPassword, newPassword);

      res.json({
        success: true,
        data: { message: 'Password changed successfully' },
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AuthenticationError('User not authenticated');
      }

      const sessions = await authService.getUserSessions(userId);

      res.json({
        success: true,
        data: sessions,
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }

  async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      const { sessionId } = req.params;

      if (!userId) {
        throw new AuthenticationError('User not authenticated');
      }

      await authService.revokeSession(userId, sessionId);

      res.json({
        success: true,
        data: { message: 'Session revoked successfully' },
        meta: { timestamp: new Date() },
      });
    } catch (error) {
      next(error);
    }
  }
}
