BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    CREATE TYPE user_role_enum AS ENUM ('admin', 'manager', 'sales_rep');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status_enum') THEN
    CREATE TYPE lead_status_enum AS ENUM ('new', 'contacted', 'qualified', 'lost', 'converted');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_stage_enum') THEN
    CREATE TYPE deal_stage_enum AS ENUM ('discovery', 'proposal', 'negotiation', 'won', 'lost');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deal_status_enum') THEN
    CREATE TYPE deal_status_enum AS ENUM ('open', 'won', 'lost');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type_enum') THEN
    CREATE TYPE activity_type_enum AS ENUM ('call', 'email', 'meeting', 'note', 'task');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum') THEN
    CREATE TYPE notification_type_enum AS ENUM ('reminder', 'system', 'deal', 'lead');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lifecycle_stage_enum') THEN
    CREATE TYPE lifecycle_stage_enum AS ENUM ('active', 'at_risk', 'churned', 'vip');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role_enum NOT NULL DEFAULT 'sales_rep',
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email CITEXT NOT NULL,
  phone VARCHAR(30),
  company VARCHAR(160),
  source VARCHAR(80),
  status lead_status_enum NOT NULL DEFAULT 'new',
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  estimated_value NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (estimated_value >= 0),
  notes TEXT,
  assigned_to BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leads_company_email_unique UNIQUE (email, company)
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT UNIQUE REFERENCES leads(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  phone VARCHAR(30),
  company VARCHAR(160),
  industry VARCHAR(120),
  owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  lifecycle_stage lifecycle_stage_enum NOT NULL DEFAULT 'active',
  total_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_revenue >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deals (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  lead_id BIGINT REFERENCES leads(id) ON DELETE SET NULL,
  owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  stage deal_stage_enum NOT NULL DEFAULT 'discovery',
  status deal_status_enum NOT NULL DEFAULT 'open',
  value NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  probability NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  expected_close_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT deals_source_reference_chk CHECK (
    customer_id IS NOT NULL OR lead_id IS NOT NULL
  ),
  CONSTRAINT deals_stage_status_consistency_chk CHECK (
    (stage = 'won' AND status = 'won') OR
    (stage = 'lost' AND status = 'lost') OR
    (stage IN ('discovery', 'proposal', 'negotiation') AND status = 'open')
  )
);

CREATE TABLE IF NOT EXISTS activities (
  id BIGSERIAL PRIMARY KEY,
  type activity_type_enum NOT NULL,
  subject VARCHAR(180) NOT NULL,
  notes TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  related_lead_id BIGINT REFERENCES leads(id) ON DELETE CASCADE,
  related_customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  related_deal_id BIGINT REFERENCES deals(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT activities_completion_timing_chk CHECK (
    completed_at IS NULL OR due_at IS NULL OR completed_at >= due_at - INTERVAL '365 days'
  ),
  CONSTRAINT activities_related_entity_chk CHECK (
    related_lead_id IS NOT NULL OR
    related_customer_id IS NOT NULL OR
    related_deal_id IS NOT NULL OR
    type IN ('note', 'task')
  )
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type notification_type_enum NOT NULL DEFAULT 'system',
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  remind_at TIMESTAMPTZ,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_last_contacted_at ON leads(last_contacted_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_search ON leads USING GIN (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(email::text, '') || ' ' || coalesce(company, ''))
);

CREATE INDEX IF NOT EXISTS idx_customers_owner_id ON customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_lifecycle_stage ON customers(lifecycle_stage);

CREATE INDEX IF NOT EXISTS idx_deals_owner_stage ON deals(owner_id, stage);
CREATE INDEX IF NOT EXISTS idx_deals_customer_id ON deals(customer_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON deals(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_related_lead_id ON activities(related_lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_related_customer_id ON activities(related_customer_id);
CREATE INDEX IF NOT EXISTS idx_activities_related_deal_id ON activities(related_deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_due_at ON activities(due_at);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_remind_at ON notifications(remind_at) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_metadata ON notifications USING GIN (metadata);

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_leads_set_updated_at ON leads;
CREATE TRIGGER trg_leads_set_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_customers_set_updated_at ON customers;
CREATE TRIGGER trg_customers_set_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_deals_set_updated_at ON deals;
CREATE TRIGGER trg_deals_set_updated_at
BEFORE UPDATE ON deals
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_activities_set_updated_at ON activities;
CREATE TRIGGER trg_activities_set_updated_at
BEFORE UPDATE ON activities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
