import { logger } from '../../../shared/utils/logger';
import { pool as timescalePool } from '../config/timescale';

interface TelemetryData {
  deviceId: string;
  timestamp: Date;
  metrics: Record<string, number>;
  metadata?: Record<string, any>;
}

interface AggregatedMetrics {
  deviceId: string;
  period: string;
  metrics: Record<string, {
    avg: number;
    min: number;
    max: number;
    sum: number;
    count: number;
  }>;
}

export class DeviceTelemetryService {
  private batchQueue: TelemetryData[] = [];
  private batchSize = 100;
  private flushInterval = 5000;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startBatchProcessor();
  }

  async recordTelemetry(data: TelemetryData): Promise<void> {
    this.batchQueue.push(data);

    if (this.batchQueue.length >= this.batchSize) {
      await this.flushBatch();
    }
  }

  private startBatchProcessor(): void {
    this.flushTimer = setInterval(() => {
      if (this.batchQueue.length > 0) {
        this.flushBatch();
      }
    }, this.flushInterval);
  }

  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    try {
      await this.insertBatch(batch);
      logger.debug('Telemetry batch flushed', { count: batch.length });
    } catch (error) {
      logger.error('Failed to flush telemetry batch', { error });
      this.batchQueue.unshift(...batch);
    }
  }

  private async insertBatch(batch: TelemetryData[]): Promise<void> {
    const query = `
      INSERT INTO device_telemetry (device_id, timestamp, metrics, metadata)
      VALUES ($1, $2, $3, $4)
    `;

    const client = await timescalePool.connect();
    try {
      await client.query('BEGIN');

      for (const data of batch) {
        await client.query(query, [
          data.deviceId,
          data.timestamp,
          JSON.stringify(data.metrics),
          JSON.stringify(data.metadata || {}),
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getAggregatedMetrics(
    deviceId: string,
    startDate: Date,
    endDate: Date,
    interval: string = '1 hour'
  ): Promise<AggregatedMetrics[]> {
    const query = `
      SELECT 
        time_bucket($1, timestamp) AS period,
        device_id,
        jsonb_object_agg(
          metric_key,
          jsonb_build_object(
            'avg', avg_value,
            'min', min_value,
            'max', max_value,
            'sum', sum_value,
            'count', count_value
          )
        ) as metrics
      FROM (
        SELECT 
          time_bucket($1, timestamp) AS bucket,
          device_id,
          key AS metric_key,
          AVG(value::numeric) AS avg_value,
          MIN(value::numeric) AS min_value,
          MAX(value::numeric) AS max_value,
          SUM(value::numeric) AS sum_value,
          COUNT(*) AS count_value
        FROM device_telemetry,
        jsonb_each_text(metrics)
        WHERE device_id = $2
        AND timestamp BETWEEN $3 AND $4
        GROUP BY bucket, device_id, key
      ) subquery
      GROUP BY period, device_id
      ORDER BY period DESC
    `;

    try {
      const result = await timescalePool.query(query, [
        interval,
        deviceId,
        startDate,
        endDate,
      ]);

      return result.rows.map(row => ({
        deviceId: row.device_id,
        period: row.period,
        metrics: row.metrics,
      }));
    } catch (error) {
      logger.error('Failed to get aggregated metrics', { error, deviceId });
      throw error;
    }
  }

  async getLatestMetrics(deviceId: string): Promise<TelemetryData | null> {
    const query = `
      SELECT * FROM device_telemetry
      WHERE device_id = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    try {
      const result = await timescalePool.query(query, [deviceId]);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        deviceId: row.device_id,
        timestamp: row.timestamp,
        metrics: row.metrics,
        metadata: row.metadata,
      };
    } catch (error) {
      logger.error('Failed to get latest metrics', { error, deviceId });
      throw error;
    }
  }

  async deleteOldTelemetry(olderThan: Date): Promise<number> {
    const query = `
      DELETE FROM device_telemetry
      WHERE timestamp < $1
    `;

    try {
      const result = await timescalePool.query(query, [olderThan]);
      logger.info('Deleted old telemetry data', { count: result.rowCount });
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to delete old telemetry', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushBatch();
  }
}
