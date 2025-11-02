CREATE TABLE IF NOT EXISTS scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100),
  actions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  favorite BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_executed_at TIMESTAMP,
  execution_count INTEGER DEFAULT 0
);

CREATE INDEX idx_scenes_user_id ON scenes(user_id);
CREATE INDEX idx_scenes_enabled ON scenes(enabled);
CREATE INDEX idx_scenes_favorite ON scenes(favorite);

CREATE TABLE IF NOT EXISTS scene_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  error TEXT,
  action_results JSONB,
  duration_ms INTEGER
);

CREATE INDEX idx_scene_executions_scene_id ON scene_executions(scene_id);
CREATE INDEX idx_scene_executions_user_id ON scene_executions(user_id);
CREATE INDEX idx_scene_executions_started_at ON scene_executions(started_at);
