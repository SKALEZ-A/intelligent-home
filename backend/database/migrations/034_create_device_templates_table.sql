CREATE TABLE IF NOT EXISTS device_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255),
  model VARCHAR(255),
  device_type VARCHAR(50) NOT NULL,
  protocol VARCHAR(50) NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]',
  default_config JSONB NOT NULL DEFAULT '{}',
  icon VARCHAR(255),
  image_url VARCHAR(500),
  description TEXT,
  setup_instructions TEXT,
  support_url VARCHAR(500),
  firmware_version VARCHAR(50),
  is_verified BOOLEAN DEFAULT false,
  popularity_score INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_templates_type ON device_templates(device_type);
CREATE INDEX idx_device_templates_protocol ON device_templates(protocol);
CREATE INDEX idx_device_templates_manufacturer ON device_templates(manufacturer);
CREATE INDEX idx_device_templates_verified ON device_templates(is_verified);
