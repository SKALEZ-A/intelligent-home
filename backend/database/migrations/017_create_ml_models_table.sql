CREATE TABLE IF NOT EXISTS ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name VARCHAR(255) NOT NULL,
  model_type VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  file_path TEXT NOT NULL,
  accuracy DECIMAL(5, 4),
  precision_score DECIMAL(5, 4),
  recall_score DECIMAL(5, 4),
  f1_score DECIMAL(5, 4),
  training_date TIMESTAMP NOT NULL,
  training_samples INTEGER,
  hyperparameters JSONB,
  feature_importance JSONB,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ml_models_name (model_name),
  INDEX idx_ml_models_type (model_type),
  INDEX idx_ml_models_status (status)
);

CREATE TABLE IF NOT EXISTS ml_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES ml_models(id) ON DELETE CASCADE,
  input_data JSONB NOT NULL,
  prediction JSONB NOT NULL,
  confidence DECIMAL(5, 4),
  actual_outcome JSONB,
  correct BOOLEAN,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ml_predictions_model (model_id),
  INDEX idx_ml_predictions_timestamp (timestamp)
);
