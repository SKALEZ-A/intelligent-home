CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  floor_level INTEGER DEFAULT 0,
  area_sqm DECIMAL(10, 2),
  temperature DECIMAL(5, 2),
  humidity DECIMAL(5, 2),
  occupancy BOOLEAN DEFAULT FALSE,
  last_occupied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rooms_home_id ON rooms(home_id);
CREATE INDEX idx_rooms_type ON rooms(type);
CREATE INDEX idx_rooms_occupancy ON rooms(occupancy);

CREATE TABLE IF NOT EXISTS room_devices (
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  position_x DECIMAL(10, 2),
  position_y DECIMAL(10, 2),
  position_z DECIMAL(10, 2),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, device_id)
);

CREATE INDEX idx_room_devices_room_id ON room_devices(room_id);
CREATE INDEX idx_room_devices_device_id ON room_devices(device_id);
