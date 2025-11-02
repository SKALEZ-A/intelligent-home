import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface CorsOptions {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

const defaultOptions: CorsOptions = {
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://app.smarthome.com',
    'https://admin.smarthome.com'
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-Device-ID',
    'X-Session-ID'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'X-Rate-Limit'],
  credentials: true,
  maxAge: 86400
};

export const corsMiddleware = (options: Partial<CorsOptions> = {}) => {
  const config = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (config.allowedOrigins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
    res.setHeader('Access-Control-Allow-Credentials', config.credentials.toString());
    res.setHeader('Access-Control-Max-Age', config.maxAge.toString());

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    logger.debug('CORS headers set', { origin, method: req.method });
    next();
  };
};

export const strictCorsMiddleware = corsMiddleware({
  allowedOrigins: [
    process.env.FRONTEND_URL || 'http://localhost:3000'
  ],
  credentials: true
});

export const publicCorsMiddleware = corsMiddleware({
  allowedOrigins: ['*'],
  credentials: false
});
