import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../../../shared/utils/errors';
import { createLogger } from '../../../shared/utils/logger';
import { RedisService } from '../services/redis.service';
import { UserRepository } from '../repositories/user.repository';

const logger = createLogger('AuthMiddleware');
const redisService = new RedisService();
const userRepository = new UserRepository();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    homeIds: string[];
  };
  token?: string;
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No authentication token provided', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.substring(7);
    req.token = token;

    // Check if token is blacklisted
    const isBlacklisted = await redisService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      email: string;
      role: string;
      type: string;
    };

    if (decoded.type !== 'access') {
      throw new AppError('Invalid token type', 401, 'INVALID_TOKEN_TYPE');
    }

    // Check if user still exists and is active
    const user = await userRepository.findById(decoded.userId);
    if (!user) {
      throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    }

    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      throw new AppError('Account is locked', 403, 'ACCOUNT_LOCKED');
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      homeIds: user.homes,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', { error: error.message });
      return next(new AppError('Invalid authentication token', 401, 'INVALID_TOKEN'));
    }

    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired JWT token');
      return next(new AppError('Authentication token has expired', 401, 'TOKEN_EXPIRED'));
    }

    next(error);
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Unauthorized access attempt', {
        userId: req.user.id,
        requiredRoles: roles,
        userRole: req.user.role,
      });
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }

    next();
  };
}

export function requireHomeAccess(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  }

  const homeId = req.params.homeId || req.body.homeId || req.query.homeId;

  if (!homeId) {
    return next(new AppError('Home ID is required', 400, 'HOME_ID_REQUIRED'));
  }

  if (!req.user.homeIds.includes(homeId as string)) {
    logger.warn('Unauthorized home access attempt', {
      userId: req.user.id,
      homeId,
      userHomes: req.user.homeIds,
    });
    return next(new AppError('Access to this home is not allowed', 403, 'HOME_ACCESS_DENIED'));
  }

  next();
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  authenticate(req, res, (err) => {
    if (err) {
      logger.debug('Optional auth failed, continuing without authentication');
      return next();
    }
    next();
  });
}
