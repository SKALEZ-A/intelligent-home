import { Pool, PoolClient } from 'pg';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('TimescaleDB');

let pool: Pool | null = null;

export function getTimescalePool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.TIMESCALE_HOST || 'localhost',
      port: parseInt(process.env.TIMESCALE_PORT || '5432'),
      database: process.env.TIMESCALE_DB || 'home_automation_timeseries',
      user: process.env.TIMESCALE_USER || 'postgres',
      password: process.env.TIMESCALE_PASSWORD || 'postgres',
      max: parseInt(process.env.TIMESCALE_POOL_MAX || '20'),
      idleTimeoutMillis: parseInt(process.env.TIMESCALE_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.TIMESCALE_CONNECTION_TIMEOUT || '2000'),
      ssl: process.env.TIMESCALE_SSL === 'true' ? {
        rejectUnauthorized: false,
      } : false,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected TimescaleDB error', err);
    });

    pool.on('connect', () => {
      logger.debug('New TimescaleDB connection established');
    });
  }

  return pool;
}

export async function connectTimescaleDB(): Promise<void> {
  try {
    const pool = getTimescalePool();
    const client = await pool.connect();
    
    const result = await client.query('SELECT NOW()');
    logger.info('TimescaleDB connected successfully', {
      timestamp: result.rows[0].now,
      database: process.env.TIMESCALE_DB,
    });

    client.release();

    // Run migrations
    await runMigrations();
  } catch (error) {
    logger.error('Failed to connect to TimescaleDB', error as Error);
    throw error;
  }
}

export async function disconnectTimescaleDB(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('TimescaleDB connection pool closed');
  }
}

async function runMigrations(): Promise<void> {
  const pool = getTimescalePool();
  
  try {
    // Enable TimescaleDB extension
    await pool.query(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;`);

    // Create device_states table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_states (
        time TIMESTAMPTZ NOT NULL,
        device_id UUID NOT NULL,
        home_id UUID NOT NULL,
        attributes JSONB NOT NULL,
        source VARCHAR(50),
        version INTEGER DEFAULT 1,
        PRIMARY KEY (device_id, time)
      );

      SELECT create_hypertable('device_states', 'time', 
        chunk_time_interval => INTERVAL '1 day',
        if_not_exists => TRUE
      );

      CREATE INDEX IF NOT EXISTS idx_device_states_device_id ON device_states(device_id, time DESC);
      CREATE INDEX IF NOT EXISTS idx_device_states_home_id ON device_states(home_id, time DESC);
      CREATE INDEX IF NOT EXISTS idx_device_states_attributes ON device_states USING GIN(attributes);
    `);

    // Create energy_readings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS energy_readings (
        time TIMESTAMPTZ NOT NULL,
        device_id UUID NOT NULL,
        home_id UUID NOT NULL,
        power_watts DOUBLE PRECISION NOT NULL,
        energy_wh DOUBLE PRECISION NOT NULL,
        voltage DOUBLE PRECISION,
        current DOUBLE PRECISION,
        power_factor DOUBLE PRECISION,
        frequency DOUBLE PRECISION,
        PRIMARY KEY (device_id, time)
      );

      SELECT create_hypertable('energy_readings', 'time',
        chunk_time_interval => INTERVAL '1 day',
        if_not_exists => TRUE
      );

      CREATE INDEX IF NOT EXISTS idx_energy_readings_device_id ON energy_readings(device_id, time DESC);
      CREATE INDEX IF NOT EXISTS idx_energy_readings_home_id ON energy_readings(home_id, time DESC);
    `);

    // Create sensor_readings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sensor_readings (
        time TIMESTAMPTZ NOT NULL,
        device_id UUID NOT NULL,
        home_id UUID NOT NULL,
        sensor_type VARCHAR(50) NOT NULL,
        value DOUBLE PRECISION NOT NULL,
        unit VARCHAR(20),
        metadata JSONB,
        PRIMARY KEY (device_id, sensor_type, time)
      );

      SELECT create_hypertable('sensor_readings', 'time',
        chunk_time_interval => INTERVAL '1 day',
        if_not_exists => TRUE
      );

      CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_id ON sensor_readings(device_id, time DESC);
      CREATE INDEX IF NOT EXISTS idx_sensor_readings_home_id ON sensor_readings(home_id, time DESC);
      CREATE INDEX IF NOT EXISTS idx_sensor_readings_type ON sensor_readings(sensor_type, time DESC);
    `);

    // Create device_events table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_events (
        time TIMESTAMPTZ NOT NULL,
        device_id UUID NOT NULL,
        home_id UUID NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        severity VARCHAR(20),
        message TEXT,
        metadata JSONB,
        PRIMARY KEY (device_id, time)
      );

      SELECT create_hypertable('device_events', 'time',
        chunk_time_interval => INTERVAL '1 day',
        if_not_exists => TRUE
      );

      CREATE INDEX IF NOT EXISTS idx_device_events_device_id ON device_events(device_id, time DESC);
      CREATE INDEX IF NOT EXISTS idx_device_events_home_id ON device_events(home_id, time DESC);
      CREATE INDEX IF NOT EXISTS idx_device_events_type ON device_events(event_type, time DESC);
      CREATE INDEX IF NOT EXISTS idx_device_events_severity ON device_events(severity, time DESC);
    `);

    // Create device_metrics table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_metrics (
        time TIMESTAMPTZ NOT NULL,
        device_id UUID NOT NULL,
        home_id UUID NOT NULL,
        metric_name VARCHAR(100) NOT NULL,
        metric_value DOUBLE PRECISION NOT NULL,
        tags JSONB,
        PRIMARY KEY (device_id, metric_name, time)
      );

      SELECT create_hypertable('device_metrics', 'time',
        chunk_time_interval => INTERVAL '1 day',
        if_not_exists => TRUE
      );

      CREATE INDEX IF NOT EXISTS idx_device_metrics_device_id ON device_metrics(device_id, time DESC);
      CREATE INDEX IF NOT EXISTS idx_device_metrics_home_id ON device_metrics(home_id, time DESC);
      CREATE INDEX IF NOT EXISTS idx_device_metrics_name ON device_metrics(metric_name, time DESC);
    `);

    // Create continuous aggregates for hourly stats
    await pool.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS device_states_hourly
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 hour', time) AS bucket,
        device_id,
        home_id,
        COUNT(*) as state_changes,
        LAST(attributes, time) as last_attributes
      FROM device_states
      GROUP BY bucket, device_id, home_id
      WITH NO DATA;

      SELECT add_continuous_aggregate_policy('device_states_hourly',
        start_offset => INTERVAL '3 hours',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 hour',
        if_not_exists => TRUE
      );
    `);

    await pool.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS energy_readings_hourly
      WITH (timescaledb.continuous) AS
      SELECT
        time_bucket('1 hour', time) AS bucket,
        device_id,
        home_id,
        AVG(power_watts) as avg_power_watts,
        MAX(power_watts) as max_power_watts,
        MIN(power_watts) as min_power_watts,
        SUM(energy_wh) as total_energy_wh,
        COUNT(*) as reading_count
      FROM energy_readings
      GROUP BY bucket, device_id, home_id
      WITH NO DATA;

      SELECT add_continuous_aggregate_policy('energy_readings_hourly',
        start_offset => INTERVAL '3 hours',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 hour',
        if_not_exists => TRUE
      );
    `);

    // Create retention policies
    await pool.query(`
      SELECT add_retention_policy('device_states', INTERVAL '90 days', if_not_exists => TRUE);
      SELECT add_retention_policy('energy_readings', INTERVAL '365 days', if_not_exists => TRUE);
      SELECT add_retention_policy('sensor_readings', INTERVAL '180 days', if_not_exists => TRUE);
      SELECT add_retention_policy('device_events', INTERVAL '180 days', if_not_exists => TRUE);
      SELECT add_retention_policy('device_metrics', INTERVAL '90 days', if_not_exists => TRUE);
    `);

    // Create compression policies
    await pool.query(`
      ALTER TABLE device_states SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'device_id'
      );
      SELECT add_compression_policy('device_states', INTERVAL '7 days', if_not_exists => TRUE);

      ALTER TABLE energy_readings SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'device_id'
      );
      SELECT add_compression_policy('energy_readings', INTERVAL '7 days', if_not_exists => TRUE);

      ALTER TABLE sensor_readings SET (
        timescaledb.compress,
        timescaledb.compress_segmentby = 'device_id,sensor_type'
      );
      SELECT add_compression_policy('sensor_readings', INTERVAL '7 days', if_not_exists => TRUE);
    `);

    logger.info('TimescaleDB migrations completed successfully');
  } catch (error) {
    logger.error('Failed to run TimescaleDB migrations', error as Error);
    throw error;
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const pool = getTimescalePool();
    const result = await pool.query('SELECT 1');
    return result.rows.length > 0;
  } catch (error) {
    logger.error('TimescaleDB health check failed', error as Error);
    return false;
  }
}

export async function insertDeviceState(
  deviceId: string,
  homeId: string,
  attributes: Record<string, any>,
  source: string
): Promise<void> {
  const pool = getTimescalePool();
  try {
    await pool.query(
      `INSERT INTO device_states (time, device_id, home_id, attributes, source)
       VALUES (NOW(), $1, $2, $3, $4)`,
      [deviceId, homeId, JSON.stringify(attributes), source]
    );
  } catch (error) {
    logger.error('Error inserting device state', error as Error);
    throw error;
  }
}

export async function insertEnergyReading(
  deviceId: string,
  homeId: string,
  powerWatts: number,
  energyWh: number,
  voltage?: number,
  current?: number,
  powerFactor?: number,
  frequency?: number
): Promise<void> {
  const pool = getTimescalePool();
  try {
    await pool.query(
      `INSERT INTO energy_readings 
       (time, device_id, home_id, power_watts, energy_wh, voltage, current, power_factor, frequency)
       VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7, $8)`,
      [deviceId, homeId, powerWatts, energyWh, voltage, current, powerFactor, frequency]
    );
  } catch (error) {
    logger.error('Error inserting energy reading', error as Error);
    throw error;
  }
}

export async function insertSensorReading(
  deviceId: string,
  homeId: string,
  sensorType: string,
  value: number,
  unit?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const pool = getTimescalePool();
  try {
    await pool.query(
      `INSERT INTO sensor_readings (time, device_id, home_id, sensor_type, value, unit, metadata)
       VALUES (NOW(), $1, $2, $3, $4, $5, $6)`,
      [deviceId, homeId, sensorType, value, unit, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (error) {
    logger.error('Error inserting sensor reading', error as Error);
    throw error;
  }
}

export async function insertDeviceEvent(
  deviceId: string,
  homeId: string,
  eventType: string,
  severity: string,
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  const pool = getTimescalePool();
  try {
    await pool.query(
      `INSERT INTO device_events (time, device_id, home_id, event_type, severity, message, metadata)
       VALUES (NOW(), $1, $2, $3, $4, $5, $6)`,
      [deviceId, homeId, eventType, severity, message, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (error) {
    logger.error('Error inserting device event', error as Error);
    throw error;
  }
}

export async function getDeviceStateHistory(
  deviceId: string,
  startTime: Date,
  endTime: Date,
  limit: number = 1000
): Promise<any[]> {
  const pool = getTimescalePool();
  try {
    const result = await pool.query(
      `SELECT time, attributes, source, version
       FROM device_states
       WHERE device_id = $1 AND time >= $2 AND time <= $3
       ORDER BY time DESC
       LIMIT $4`,
      [deviceId, startTime, endTime, limit]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting device state history', error as Error);
    throw error;
  }
}

export async function getEnergyReadings(
  deviceId: string,
  startTime: Date,
  endTime: Date
): Promise<any[]> {
  const pool = getTimescalePool();
  try {
    const result = await pool.query(
      `SELECT time, power_watts, energy_wh, voltage, current, power_factor, frequency
       FROM energy_readings
       WHERE device_id = $1 AND time >= $2 AND time <= $3
       ORDER BY time ASC`,
      [deviceId, startTime, endTime]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting energy readings', error as Error);
    throw error;
  }
}

export async function getAggregatedEnergyData(
  homeId: string,
  startTime: Date,
  endTime: Date,
  interval: string = '1 hour'
): Promise<any[]> {
  const pool = getTimescalePool();
  try {
    const result = await pool.query(
      `SELECT 
        time_bucket($1, time) AS bucket,
        device_id,
        AVG(power_watts) as avg_power,
        MAX(power_watts) as max_power,
        SUM(energy_wh) as total_energy
       FROM energy_readings
       WHERE home_id = $2 AND time >= $3 AND time <= $4
       GROUP BY bucket, device_id
       ORDER BY bucket ASC`,
      [interval, homeId, startTime, endTime]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting aggregated energy data', error as Error);
    throw error;
  }
}
