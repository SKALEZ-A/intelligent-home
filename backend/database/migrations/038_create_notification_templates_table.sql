CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(100) NOT NULL,
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  email_subject_template TEXT,
  email_body_template TEXT,
  sms_template TEXT,
  push_template TEXT,
  variables JSONB NOT NULL DEFAULT '[]',
  default_priority VARCHAR(20) DEFAULT 'normal',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_templates_category ON notification_templates(category);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active);
