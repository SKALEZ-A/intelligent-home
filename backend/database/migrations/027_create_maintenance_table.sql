CREATE TABLE IF NOT EXISTS maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  maintenance_type VARCHAR(100) NOT NULL,
  frequency_days INTEGER NOT NULL,
  last_maintenance_date DATE,
  next_maintenance_date DATE NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_maintenance_schedules_device_id ON maintenance_schedules(device_id);
CREATE INDEX idx_maintenance_schedules_next_date ON maintenance_schedules(next_maintenance_date);
CREATE INDEX idx_maintenance_schedules_priority ON maintenance_schedules(priority);

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES maintenance_schedules(id) ON DELETE SET NULL,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  maintenance_type VARCHAR(100) NOT NULL,
  description TEXT,
  cost DECIMAL(10, 2),
  parts_replaced JSONB,
  status VARCHAR(20) NOT NULL,
  performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_maintenance_logs_device_id ON maintenance_logs(device_id);
CREATE INDEX idx_maintenance_logs_schedule_id ON maintenance_logs(schedule_id);
CREATE INDEX idx_maintenance_logs_performed_at ON maintenance_logs(performed_at);
