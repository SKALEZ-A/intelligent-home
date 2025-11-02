import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../../shared/utils/logger';

const logger = new Logger('RequestLogger');

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || generateRequestId();

  req['requestId'] = requestId;
  req['startTime'] = startTime;

  const originalSend = res.send;
  res.send = function (data: any): Response {
    res.send = originalSend;
    
    const duration = Date.now() - startTime;
    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      timestamp: new Date().toISOString()
    };

    if (res.statusCode >= 400) {
      logger.error('Request failed', logData);
    } else {
      logger.info('Request completed', logData);
    }

    return originalSend.call(this, data);
  };

  next();
};

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    requestId: req['requestId'],
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl
  });

  next(err);
};
