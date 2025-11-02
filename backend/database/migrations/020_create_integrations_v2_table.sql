CREATE TABLE IF NOT EXISTS integration_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url TEXT,
  auth_type VARCHAR(50) NOT NULL,
  oauth_config JSONB,
  api_endpoint TEXT,
  supported_features JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_integration_providers_name (name),
  INDEX idx_integration_providers_active (active)
);

CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  credentials JSONB NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active',
  last_sync TIMESTAMP,
  sync_frequency INTEGER DEFAULT 3600,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_integrations_user (user_id),
  INDEX idx_user_integrations_provider (provider_id),
  INDEX idx_user_integrations_status (status),
  UNIQUE(user_id, provider_id)
);
