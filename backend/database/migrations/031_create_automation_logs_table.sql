CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  execution_id UUID,
  trigger_type VARCHAR(50),
  trigger_data JSONB,
  conditions_met BOOLEAN,
  conditions_data JSONB,
  actions_executed INTEGER DEFAULT 0,
  actions_failed INTEGER DEFAULT 0,
  execution_status VARCHAR(20),
  execution_duration INTEGER,
  error_details JSONB,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_automation_logs_automation_id ON automation_logs(automation_id);
CREATE INDEX idx_automation_logs_execution_id ON automation_logs(execution_id);
CREATE INDEX idx_automation_logs_user_id ON automation_logs(user_id);
CREATE INDEX idx_automation_logs_executed_at ON automation_logs(executed_at);
CREATE INDEX idx_automation_logs_execution_status ON automation_logs(execution_status);
