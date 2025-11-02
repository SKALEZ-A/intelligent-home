import { Pool, PoolConfig } from 'pg';
import { logger } from '../../../shared/utils/logger';

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'weather_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: parseInt(process.env.DB_POOL_SIZE || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export const pool = new Pool(poolConfig);

pool.on('connect', () => {
  logger.info('Weather database connection established');
});

pool.on('error', (err) => {
  logger.error('Unexpected weather database error', { error: err });
});

export async function initializeDatabase(): Promise<void> {
  try {
    await pool.query('SELECT NOW()');
    logger.info('Weather database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize weather database', { error });
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
  logger.info('Weather database connection closed');
}
