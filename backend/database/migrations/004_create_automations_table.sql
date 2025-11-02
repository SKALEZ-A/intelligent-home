CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  triggers JSONB NOT NULL,
  conditions JSONB,
  actions JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_executed_at TIMESTAMP,
  execution_count INTEGER DEFAULT 0
);

CREATE INDEX idx_automations_user_id ON automations(user_id);
CREATE INDEX idx_automations_enabled ON automations(enabled);
CREATE INDEX idx_automations_triggers ON automations USING GIN(triggers);

CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  error TEXT,
  trigger_data JSONB,
  action_results JSONB,
  duration_ms INTEGER
);

CREATE INDEX idx_automation_executions_automation_id ON automation_executions(automation_id);
CREATE INDEX idx_automation_executions_user_id ON automation_executions(user_id);
CREATE INDEX idx_automation_executions_started_at ON automation_executions(started_at);
