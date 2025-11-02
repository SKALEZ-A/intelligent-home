-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  protocol VARCHAR(50) NOT NULL,
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  firmware_version VARCHAR(50),
  hardware_version VARCHAR(50),
  serial_number VARCHAR(100),
  mac_address VARCHAR(17),
  ip_address VARCHAR(45),
  network_address VARCHAR(255),
  home_id UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  hub_id UUID,
  user_id UUID NOT NULL REFERENCES users(id),
  is_online BOOLEAN DEFAULT TRUE,
  is_paired BOOLEAN DEFAULT FALSE,
  is_enabled BOOLEAN DEFAULT TRUE,
  battery_level INTEGER,
  signal_strength INTEGER,
  last_seen TIMESTAMP,
  paired_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_device_type CHECK (type IN (
    'light', 'switch', 'sensor', 'thermostat', 'lock', 'camera',
    'speaker', 'tv', 'fan', 'blind', 'outlet', 'garage', 'doorbell',
    'alarm', 'valve', 'sprinkler', 'other'
  )),
  CONSTRAINT valid_protocol CHECK (protocol IN (
    'zigbee', 'zwave', 'wifi', 'bluetooth', 'thread', 'matter', 'http', 'mqtt'
  )),
  CONSTRAINT valid_battery_level CHECK (battery_level >= 0 AND battery_level <= 100),
  CONSTRAINT valid_signal_strength CHECK (signal_strength >= -100 AND signal_strength <= 0)
);

-- Create indexes
CREATE INDEX idx_devices_home_id ON devices(home_id);
CREATE INDEX idx_devices_room_id ON devices(room_id);
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_type ON devices(type);
CREATE INDEX idx_devices_protocol ON devices(protocol);
CREATE INDEX idx_devices_is_online ON devices(is_online);
CREATE INDEX idx_devices_last_seen ON devices(last_seen);

-- Create trigger
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create device_capabilities table
CREATE TABLE IF NOT EXISTS device_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  capability VARCHAR(50) NOT NULL,
  parameters JSONB DEFAULT '{}',
  UNIQUE(device_id, capability),
  CONSTRAINT valid_capability CHECK (capability IN (
    'on_off', 'brightness', 'color', 'color_temperature', 'temperature',
    'humidity', 'motion', 'contact', 'lock', 'unlock', 'open', 'close',
    'volume', 'mute', 'play', 'pause', 'stop', 'speed', 'position',
    'tilt', 'battery', 'energy', 'power', 'voltage', 'current'
  ))
);

CREATE INDEX idx_device_capabilities_device_id ON device_capabilities(device_id);
CREATE INDEX idx_device_capabilities_capability ON device_capabilities(capability);

-- Create device_groups table
CREATE TABLE IF NOT EXISTS device_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  home_id UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  icon VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_groups_home_id ON device_groups(home_id);

CREATE TRIGGER update_device_groups_updated_at BEFORE UPDATE ON device_groups
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create device_group_members table
CREATE TABLE IF NOT EXISTS device_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES device_groups(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, device_id)
);

CREATE INDEX idx_device_group_members_group_id ON device_group_members(group_id);
CREATE INDEX idx_device_group_members_device_id ON device_group_members(device_id);
