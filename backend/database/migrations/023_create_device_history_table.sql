CREATE TABLE IF NOT EXISTS device_state_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  changed_by UUID REFERENCES users(id),
  change_source VARCHAR(50),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_state_history_device_id ON device_state_history(device_id);
CREATE INDEX idx_device_state_history_timestamp ON device_state_history(timestamp);

CREATE TABLE IF NOT EXISTS device_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  error_code VARCHAR(50) NOT NULL,
  error_message TEXT,
  severity VARCHAR(20) NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_errors_device_id ON device_errors(device_id);
CREATE INDEX idx_device_errors_resolved ON device_errors(resolved);
CREATE INDEX idx_device_errors_severity ON device_errors(severity);
