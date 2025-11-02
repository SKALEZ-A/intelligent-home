CREATE TABLE IF NOT EXISTS voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  voice_signature BYTEA NOT NULL,
  confidence_threshold DECIMAL(3, 2) DEFAULT 0.85,
  enabled BOOLEAN DEFAULT true,
  training_samples_count INTEGER DEFAULT 0,
  last_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_voice_profiles_user_id ON voice_profiles(user_id);
CREATE INDEX idx_voice_profiles_enabled ON voice_profiles(enabled);

CREATE TABLE IF NOT EXISTS voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  command_text TEXT NOT NULL,
  intent VARCHAR(100) NOT NULL,
  entities JSONB,
  confidence DECIMAL(3, 2) NOT NULL,
  executed BOOLEAN DEFAULT false,
  execution_result JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_voice_commands_user_id ON voice_commands(user_id);
CREATE INDEX idx_voice_commands_intent ON voice_commands(intent);
CREATE INDEX idx_voice_commands_created_at ON voice_commands(created_at);
