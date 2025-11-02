CREATE TABLE IF NOT EXISTS device_sharing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '[]',
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, shared_with_user_id)
);

CREATE INDEX idx_device_sharing_device_id ON device_sharing(device_id);
CREATE INDEX idx_device_sharing_owner_id ON device_sharing(owner_id);
CREATE INDEX idx_device_sharing_shared_with ON device_sharing(shared_with_user_id);
CREATE INDEX idx_device_sharing_active ON device_sharing(is_active);
