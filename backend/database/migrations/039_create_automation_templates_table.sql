CREATE TABLE IF NOT EXISTS automation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  icon VARCHAR(255),
  triggers JSONB NOT NULL DEFAULT '[]',
  conditions JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  required_device_types JSONB NOT NULL DEFAULT '[]',
  difficulty_level VARCHAR(20) DEFAULT 'easy',
  popularity_score INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  tags JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_automation_templates_category ON automation_templates(category);
CREATE INDEX idx_automation_templates_featured ON automation_templates(is_featured);
CREATE INDEX idx_automation_templates_difficulty ON automation_templates(difficulty_level);
