CREATE TABLE IF NOT EXISTS firmware_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_type VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  release_notes TEXT,
  download_url VARCHAR(500) NOT NULL,
  checksum VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  released_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_type, version)
);

CREATE INDEX idx_firmware_versions_device_type ON firmware_versions(device_type);
CREATE INDEX idx_firmware_versions_released_at ON firmware_versions(released_at);

CREATE TABLE IF NOT EXISTS firmware_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  firmware_version_id UUID NOT NULL REFERENCES firmware_versions(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_firmware_updates_device_id ON firmware_updates(device_id);
CREATE INDEX idx_firmware_updates_status ON firmware_updates(status);
CREATE INDEX idx_firmware_updates_started_at ON firmware_updates(started_at);
