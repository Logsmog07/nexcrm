BEGIN;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_settings_type_chk CHECK (jsonb_typeof(settings) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings(updated_at DESC);

DROP TRIGGER IF EXISTS trg_user_settings_set_updated_at ON user_settings;
CREATE TRIGGER trg_user_settings_set_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;