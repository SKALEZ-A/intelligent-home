import winston from 'winston';

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(logColors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({ filename: 'logs/all.log' }),
];

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  levels: logLevels,
  format,
  transports,
});

export class Logger {
  private context: string;
  private correlationId?: string;

  constructor(context: string, correlationId?: string) {
    this.context = context;
    this.correlationId = correlationId;
  }

  private formatMessage(message: string, meta?: any): string {
    const prefix = this.correlationId 
      ? `[${this.context}][${this.correlationId}]`
      : `[${this.context}]`;
    
    if (meta) {
      return `${prefix} ${message} ${JSON.stringify(meta)}`;
    }
    return `${prefix} ${message}`;
  }

  error(message: string, error?: Error, meta?: any): void {
    const formattedMessage = this.formatMessage(message, meta);
    if (error) {
      logger.error(`${formattedMessage} - ${error.message}`, { stack: error.stack });
    } else {
      logger.error(formattedMessage);
    }
  }

  warn(message: string, meta?: any): void {
    logger.warn(this.formatMessage(message, meta));
  }

  info(message: string, meta?: any): void {
    logger.info(this.formatMessage(message, meta));
  }

  http(message: string, meta?: any): void {
    logger.http(this.formatMessage(message, meta));
  }

  debug(message: string, meta?: any): void {
    logger.debug(this.formatMessage(message, meta));
  }

  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }
}

export function createLogger(context: string, correlationId?: string): Logger {
  return new Logger(context, correlationId);
}
