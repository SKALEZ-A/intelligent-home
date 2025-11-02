CREATE TABLE IF NOT EXISTS weather_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  temperature DECIMAL(5, 2) NOT NULL,
  humidity DECIMAL(5, 2) NOT NULL,
  pressure DECIMAL(7, 2) NOT NULL,
  wind_speed DECIMAL(5, 2) NOT NULL,
  wind_direction DECIMAL(5, 2) NOT NULL,
  conditions VARCHAR(100) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  source VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weather_data_location ON weather_data(location);
CREATE INDEX idx_weather_data_timestamp ON weather_data(timestamp);
CREATE INDEX idx_weather_data_coordinates ON weather_data(latitude, longitude);

CREATE TABLE IF NOT EXISTS weather_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  condition VARCHAR(50) NOT NULL,
  threshold DECIMAL(10, 2) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_weather_alerts_user_id ON weather_alerts(user_id);
CREATE INDEX idx_weather_alerts_enabled ON weather_alerts(enabled);
