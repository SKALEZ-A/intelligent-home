import { pool } from '../config/database';
import { logger } from '../../../shared/utils/logger';

export interface WeatherData {
  id: string;
  location: string;
  latitude: number;
  longitude: number;
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  conditions: string;
  timestamp: Date;
  source: string;
}

export class WeatherRepository {
  async save(data: Omit<WeatherData, 'id'>): Promise<WeatherData> {
    const query = `
      INSERT INTO weather_data 
      (location, latitude, longitude, temperature, humidity, pressure, 
       wind_speed, wind_direction, conditions, timestamp, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      data.location,
      data.latitude,
      data.longitude,
      data.temperature,
      data.humidity,
      data.pressure,
      data.windSpeed,
      data.windDirection,
      data.conditions,
      data.timestamp,
      data.source,
    ];

    try {
      const result = await pool.query(query, values);
      return this.mapRow(result.rows[0]);
    } catch (error) {
      logger.error('Failed to save weather data', { error });
      throw error;
    }
  }

  async getLatest(location: string): Promise<WeatherData | null> {
    const query = `
      SELECT * FROM weather_data
      WHERE location = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;

    try {
      const result = await pool.query(query, [location]);
      return result.rows[0] ? this.mapRow(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to get latest weather', { error, location });
      throw error;
    }
  }

  async getHistory(location: string, startDate: Date, endDate: Date): Promise<WeatherData[]> {
    const query = `
      SELECT * FROM weather_data
      WHERE location = $1 AND timestamp BETWEEN $2 AND $3
      ORDER BY timestamp DESC
    `;

    try {
      const result = await pool.query(query, [location, startDate, endDate]);
      return result.rows.map(this.mapRow);
    } catch (error) {
      logger.error('Failed to get weather history', { error, location });
      throw error;
    }
  }

  private mapRow(row: any): WeatherData {
    return {
      id: row.id,
      location: row.location,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      temperature: parseFloat(row.temperature),
      humidity: parseFloat(row.humidity),
      pressure: parseFloat(row.pressure),
      windSpeed: parseFloat(row.wind_speed),
      windDirection: parseFloat(row.wind_direction),
      conditions: row.conditions,
      timestamp: row.timestamp,
      source: row.source,
    };
  }
}
