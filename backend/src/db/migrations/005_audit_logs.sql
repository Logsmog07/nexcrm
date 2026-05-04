CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80),
  actor_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  company_id INT REFERENCES companies(id) ON DELETE SET NULL,
  outcome VARCHAR(24) NOT NULL DEFAULT 'success',
  ip_address VARCHAR(64),
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
