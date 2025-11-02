CREATE TABLE IF NOT EXISTS scene_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  icon VARCHAR(255),
  color VARCHAR(7),
  actions JSONB NOT NULL DEFAULT '[]',
  required_device_types JSONB NOT NULL DEFAULT '[]',
  popularity_score INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  tags JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scene_templates_category ON scene_templates(category);
CREATE INDEX idx_scene_templates_featured ON scene_templates(is_featured);
