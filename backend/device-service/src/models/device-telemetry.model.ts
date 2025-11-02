export interface DeviceTelemetry {
  time: Date;
  deviceId: string;
  userId: string;
  metrics: {
    power?: number;
    energy?: number;
    voltage?: number;
    current?: number;
    temperature?: number;
    humidity?: number;
    brightness?: number;
    signalStrength?: number;
    battery?: number;
    motion?: boolean;
    contact?: boolean;
    [key: string]: any;
  };
  metadata?: {
    firmware?: string;
    uptime?: number;
    errorCode?: string;
  };
}

export interface DeviceEvent {
  time: Date;
  deviceId: string;
  userId: string;
  eventType: 'state_change' | 'error' | 'warning' | 'info' | 'command' | 'firmware_update';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data?: any;
  source?: string;
}

export interface EnergyReading {
  time: Date;
  deviceId: string;
  userId: string;
  power: number;
  energy: number;
  voltage?: number;
  current?: number;
  powerFactor?: number;
  cost?: number;
}

export interface DeviceAnalytics {
  deviceId: string;
  userId: string;
  period: 'hour' | 'day' | 'week' | 'month';
  startTime: Date;
  endTime: Date;
  metrics: {
    avgPower?: number;
    totalEnergy?: number;
    uptime?: number;
    downtime?: number;
    errorCount?: number;
    commandCount?: number;
    avgResponseTime?: number;
    peakPower?: number;
    minPower?: number;
  };
}

export class DeviceTelemetryQueries {
  static createTelemetryTable(): string {
    return `
      CREATE TABLE IF NOT EXISTS device_telemetry (
        time TIMESTAMPTZ NOT NULL,
        device_id VARCHAR(50) NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        power DOUBLE PRECISION,
        energy DOUBLE PRECISION,
        voltage DOUBLE PRECISION,
        current DOUBLE PRECISION,
        temperature DOUBLE PRECISION,
        humidity DOUBLE PRECISION,
        brightness INTEGER,
        signal_strength INTEGER,
        battery INTEGER,
        motion BOOLEAN,
        contact BOOLEAN,
        metadata JSONB
      );
      
      SELECT create_hypertable('device_telemetry', 'time', if_not_exists => TRUE);
      
      CREATE INDEX IF NOT EXISTS idx_device_telemetry_device_time 
        ON device_telemetry (device_id, time DESC);
      
      CREATE INDEX IF NOT EXISTS idx_device_telemetry_user_time 
        ON device_telemetry (user_id, time DESC);
    `;
  }

  static createEventsTable(): string {
    return `
      CREATE TABLE IF NOT EXISTS device_events (
        time TIMESTAMPTZ NOT NULL,
        device_id VARCHAR(50) NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        message TEXT,
        data JSONB,
        source VARCHAR(100)
      );
      
      SELECT create_hypertable('device_events', 'time', if_not_exists => TRUE);
      
      CREATE INDEX IF NOT EXISTS idx_device_events_device_time 
        ON device_events (device_id, time DESC);
      
      CREATE INDEX IF NOT EXISTS idx_device_events_type 
        ON device_events (event_type, time DESC);
      
      CREATE INDEX IF NOT EXISTS idx_device_events_severity 
        ON device_events (severity, time DESC);
    `;
  }

  static createEnergyTable(): string {
    return `
      CREATE TABLE IF NOT EXISTS energy_readings (
        time TIMESTAMPTZ NOT NULL,
        device_id VARCHAR(50) NOT NULL,
        user_id VARCHAR(50) NOT NULL,
        power DOUBLE PRECISION NOT NULL,
        energy DOUBLE PRECISION NOT NULL,
        voltage DOUBLE PRECISION,
        current DOUBLE PRECISION,
        power_factor DOUBLE PRECISION,
        cost DOUBLE PRECISION
      );
      
      SELECT create_hypertable('energy_readings', 'time', if_not_exists => TRUE);
      
      CREATE INDEX IF NOT EXISTS idx_energy_readings_device_time 
        ON energy_readings (device_id, time DESC);
      
      CREATE INDEX IF NOT EXISTS idx_energy_readings_user_time 
        ON energy_readings (user_id, time DESC);
    `;
  }

  static insertTelemetry(): string {
    return `
      INSERT INTO device_telemetry (
        time, device_id, user_id, power, energy, voltage, current,
        temperature, humidity, brightness, signal_strength, battery,
        motion, contact, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `;
  }

  static insertEvent(): string {
    return `
      INSERT INTO device_events (
        time, device_id, user_id, event_type, severity, message, data, source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
  }

  static insertEnergyReading(): string {
    return `
      INSERT INTO energy_readings (
        time, device_id, user_id, power, energy, voltage, current, power_factor, cost
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
  }

  static getDeviceTelemetry(deviceId: string, hours: number = 24): string {
    return `
      SELECT * FROM device_telemetry
      WHERE device_id = '${deviceId}'
        AND time > NOW() - INTERVAL '${hours} hours'
      ORDER BY time DESC
      LIMIT 1000
    `;
  }

  static getDeviceEvents(deviceId: string, hours: number = 24): string {
    return `
      SELECT * FROM device_events
      WHERE device_id = '${deviceId}'
        AND time > NOW() - INTERVAL '${hours} hours'
      ORDER BY time DESC
      LIMIT 500
    `;
  }

  static getEnergyUsage(deviceId: string, days: number = 7): string {
    return `
      SELECT 
        time_bucket('1 hour', time) AS bucket,
        AVG(power) as avg_power,
        SUM(energy) as total_energy,
        MAX(power) as peak_power
      FROM energy_readings
      WHERE device_id = '${deviceId}'
        AND time > NOW() - INTERVAL '${days} days'
      GROUP BY bucket
      ORDER BY bucket DESC
    `;
  }

  static getUserEnergyUsage(userId: string, days: number = 7): string {
    return `
      SELECT 
        time_bucket('1 day', time) AS day,
        SUM(energy) as total_energy,
        AVG(power) as avg_power,
        SUM(cost) as total_cost
      FROM energy_readings
      WHERE user_id = '${userId}'
        AND time > NOW() - INTERVAL '${days} days'
      GROUP BY day
      ORDER BY day DESC
    `;
  }

  static getDeviceUptime(deviceId: string, days: number = 30): string {
    return `
      WITH status_changes AS (
        SELECT 
          time,
          CASE 
            WHEN message LIKE '%online%' THEN 'online'
            WHEN message LIKE '%offline%' THEN 'offline'
          END as status
        FROM device_events
        WHERE device_id = '${deviceId}'
          AND event_type = 'state_change'
          AND time > NOW() - INTERVAL '${days} days'
      )
      SELECT 
        COUNT(*) FILTER (WHERE status = 'online') as online_count,
        COUNT(*) FILTER (WHERE status = 'offline') as offline_count
      FROM status_changes
    `;
  }
}
