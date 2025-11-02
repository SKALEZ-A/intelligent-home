import { pool } from '../config/database';
import { logger } from '../../../shared/utils/logger';

export interface EnergyReading {
  id: string;
  deviceId: string;
  userId: string;
  timestamp: Date;
  consumption: number;
  unit: string;
  cost?: number;
  metadata?: Record<string, any>;
}

export interface EnergyAggregation {
  period: string;
  totalConsumption: number;
  averageConsumption: number;
  peakConsumption: number;
  totalCost: number;
  deviceBreakdown: Array<{
    deviceId: string;
    consumption: number;
    percentage: number;
  }>;
}

export class EnergyRepository {
  async saveReading(reading: Omit<EnergyReading, 'id'>): Promise<EnergyReading> {
    const query = `
      INSERT INTO energy_readings (device_id, user_id, timestamp, consumption, unit, cost, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      reading.deviceId,
      reading.userId,
      reading.timestamp,
      reading.consumption,
      reading.unit,
      reading.cost,
      JSON.stringify(reading.metadata || {}),
    ];

    try {
      const result = await pool.query(query, values);
      return this.mapRowToReading(result.rows[0]);
    } catch (error) {
      logger.error('Failed to save energy reading', { error, reading });
      throw error;
    }
  }

  async getReadingsByDevice(
    deviceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<EnergyReading[]> {
    const query = `
      SELECT * FROM energy_readings
      WHERE device_id = $1 AND timestamp BETWEEN $2 AND $3
      ORDER BY timestamp DESC
    `;

    try {
      const result = await pool.query(query, [deviceId, startDate, endDate]);
      return result.rows.map(this.mapRowToReading);
    } catch (error) {
      logger.error('Failed to get energy readings', { error, deviceId });
      throw error;
    }
  }

  async getReadingsByUser(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<EnergyReading[]> {
    const query = `
      SELECT * FROM energy_readings
      WHERE user_id = $1 AND timestamp BETWEEN $2 AND $3
      ORDER BY timestamp DESC
    `;

    try {
      const result = await pool.query(query, [userId, startDate, endDate]);
      return result.rows.map(this.mapRowToReading);
    } catch (error) {
      logger.error('Failed to get user energy readings', { error, userId });
      throw error;
    }
  }

  async getAggregatedData(
    userId: string,
    period: 'hour' | 'day' | 'week' | 'month',
    startDate: Date,
    endDate: Date
  ): Promise<EnergyAggregation[]> {
    const truncFunction = this.getPeriodTruncFunction(period);
    
    const query = `
      SELECT 
        date_trunc($1, timestamp) as period,
        SUM(consumption) as total_consumption,
        AVG(consumption) as average_consumption,
        MAX(consumption) as peak_consumption,
        SUM(cost) as total_cost,
        device_id,
        COUNT(*) as reading_count
      FROM energy_readings
      WHERE user_id = $2 AND timestamp BETWEEN $3 AND $4
      GROUP BY date_trunc($1, timestamp), device_id
      ORDER BY period DESC
    `;

    try {
      const result = await pool.query(query, [period, userId, startDate, endDate]);
      return this.aggregateResults(result.rows);
    } catch (error) {
      logger.error('Failed to get aggregated energy data', { error, userId, period });
      throw error;
    }
  }

  async getTotalConsumption(userId: string, startDate: Date, endDate: Date): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(consumption), 0) as total
      FROM energy_readings
      WHERE user_id = $1 AND timestamp BETWEEN $2 AND $3
    `;

    try {
      const result = await pool.query(query, [userId, startDate, endDate]);
      return parseFloat(result.rows[0].total);
    } catch (error) {
      logger.error('Failed to get total consumption', { error, userId });
      throw error;
    }
  }

  async getDeviceConsumptionRanking(
    userId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{ deviceId: string; consumption: number; cost: number }>> {
    const query = `
      SELECT 
        device_id,
        SUM(consumption) as total_consumption,
        SUM(cost) as total_cost
      FROM energy_readings
      WHERE user_id = $1 AND timestamp BETWEEN $2 AND $3
      GROUP BY device_id
      ORDER BY total_consumption DESC
      LIMIT $4
    `;

    try {
      const result = await pool.query(query, [userId, startDate, endDate, limit]);
      return result.rows.map(row => ({
        deviceId: row.device_id,
        consumption: parseFloat(row.total_consumption),
        cost: parseFloat(row.total_cost || 0),
      }));
    } catch (error) {
      logger.error('Failed to get device consumption ranking', { error, userId });
      throw error;
    }
  }

  async deleteOldReadings(olderThan: Date): Promise<number> {
    const query = `
      DELETE FROM energy_readings
      WHERE timestamp < $1
    `;

    try {
      const result = await pool.query(query, [olderThan]);
      logger.info('Deleted old energy readings', { count: result.rowCount });
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to delete old readings', { error });
      throw error;
    }
  }

  private mapRowToReading(row: any): EnergyReading {
    return {
      id: row.id,
      deviceId: row.device_id,
      userId: row.user_id,
      timestamp: row.timestamp,
      consumption: parseFloat(row.consumption),
      unit: row.unit,
      cost: row.cost ? parseFloat(row.cost) : undefined,
      metadata: row.metadata,
    };
  }

  private getPeriodTruncFunction(period: string): string {
    const mapping: Record<string, string> = {
      hour: 'hour',
      day: 'day',
      week: 'week',
      month: 'month',
    };
    return mapping[period] || 'day';
  }

  private aggregateResults(rows: any[]): EnergyAggregation[] {
    const periodMap = new Map<string, any[]>();
    
    rows.forEach(row => {
      const period = row.period.toISOString();
      if (!periodMap.has(period)) {
        periodMap.set(period, []);
      }
      periodMap.get(period)!.push(row);
    });

    return Array.from(periodMap.entries()).map(([period, deviceRows]) => {
      const totalConsumption = deviceRows.reduce((sum, r) => sum + parseFloat(r.total_consumption), 0);
      
      return {
        period,
        totalConsumption,
        averageConsumption: deviceRows.reduce((sum, r) => sum + parseFloat(r.average_consumption), 0) / deviceRows.length,
        peakConsumption: Math.max(...deviceRows.map(r => parseFloat(r.peak_consumption))),
        totalCost: deviceRows.reduce((sum, r) => sum + parseFloat(r.total_cost || 0), 0),
        deviceBreakdown: deviceRows.map(r => ({
          deviceId: r.device_id,
          consumption: parseFloat(r.total_consumption),
          percentage: (parseFloat(r.total_consumption) / totalConsumption) * 100,
        })),
      };
    });
  }
}
