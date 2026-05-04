CREATE TABLE IF NOT EXISTS audit_log_policy (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  retention_days INT NOT NULL DEFAULT 365 CHECK (retention_days BETWEEN 30 AND 3650),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO audit_log_policy (id, retention_days)
VALUES (1, 365)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_action_created_at
  ON audit_logs (company_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at
  ON audit_logs (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created_at
  ON audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome_created_at
  ON audit_logs (outcome, created_at DESC);

CREATE OR REPLACE FUNCTION prune_audit_logs(p_retention_days INT DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  effective_retention_days INT;
  deleted_count INT;
BEGIN
  SELECT COALESCE(p_retention_days, retention_days)
  INTO effective_retention_days
  FROM audit_log_policy
  WHERE id = 1;

  IF effective_retention_days IS NULL THEN
    effective_retention_days := 365;
  END IF;

  DELETE FROM audit_logs
  WHERE created_at < (NOW() - make_interval(days => effective_retention_days));

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
