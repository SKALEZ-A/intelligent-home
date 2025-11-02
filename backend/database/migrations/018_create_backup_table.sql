CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type VARCHAR(50) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  compression VARCHAR(50),
  encryption BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'completed',
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  error_message TEXT,
  metadata JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_backups_type (backup_type),
  INDEX idx_backups_status (status),
  INDEX idx_backups_started (started_at)
);

CREATE TABLE IF NOT EXISTS backup_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  backup_type VARCHAR(50) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  retention_days INTEGER DEFAULT 30,
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_backup_schedules_enabled (enabled),
  INDEX idx_backup_schedules_next_run (next_run)
);
