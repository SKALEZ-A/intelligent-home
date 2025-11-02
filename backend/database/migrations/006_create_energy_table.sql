CREATE TABLE IF NOT EXISTS energy_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,
  consumption DECIMAL(10, 4) NOT NULL,
  unit VARCHAR(10) NOT NULL,
  cost DECIMAL(10, 4),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_energy_readings_device_id ON energy_readings(device_id);
CREATE INDEX idx_energy_readings_user_id ON energy_readings(user_id);
CREATE INDEX idx_energy_readings_timestamp ON energy_readings(timestamp);

CREATE TABLE IF NOT EXISTS energy_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  peak_hours INTEGER[] NOT NULL,
  off_peak_hours INTEGER[] NOT NULL,
  peak_rate DECIMAL(10, 4) NOT NULL,
  off_peak_rate DECIMAL(10, 4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_energy_profiles_user_id ON energy_profiles(user_id);
CREATE INDEX idx_energy_profiles_active ON energy_profiles(active);
