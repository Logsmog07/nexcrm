BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_role_enum') THEN
    CREATE TYPE platform_role_enum AS ENUM ('platform_admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_role_enum') THEN
    CREATE TYPE company_role_enum AS ENUM ('company_admin', 'manager', 'sales_rep');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_status_enum') THEN
    CREATE TYPE company_status_enum AS ENUM ('trial', 'active', 'suspended');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  phone VARCHAR(40),
  industry VARCHAR(120),
  company_size VARCHAR(60),
  address TEXT,
  subscription_plan VARCHAR(60) NOT NULL DEFAULT 'starter',
  status company_status_enum NOT NULL DEFAULT 'trial',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS platform_role platform_role_enum,
  ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_role company_role_enum,
  ADD COLUMN IF NOT EXISTS manager_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES companies(id) ON DELETE CASCADE;

INSERT INTO companies (name, email, phone, industry, company_size, address, subscription_plan, status)
VALUES (
  'Sample Workspace',
  'workspace@crm.local',
  '0000000000',
  'General',
  '50-100',
  'Imported workspace',
  'starter',
  'active'
)
ON CONFLICT (email) DO NOTHING;

WITH default_company AS (
  SELECT id FROM companies WHERE email = 'workspace@crm.local' LIMIT 1
)
UPDATE users
SET
  platform_role = CASE WHEN email = 'admin@crm.local' THEN 'platform_admin'::platform_role_enum ELSE platform_role END,
  company_id = CASE WHEN email = 'admin@crm.local' THEN NULL ELSE COALESCE(company_id, (SELECT id FROM default_company)) END,
  company_role = CASE
    WHEN email = 'admin@crm.local' THEN NULL
    WHEN role = 'admin' THEN 'company_admin'::company_role_enum
    WHEN role = 'manager' THEN 'manager'::company_role_enum
    WHEN role = 'sales_rep' THEN 'sales_rep'::company_role_enum
    ELSE company_role
  END
WHERE platform_role IS NULL OR company_role IS NULL OR company_id IS NULL;

UPDATE leads l
SET company_id = COALESCE(
  l.company_id,
  (SELECT company_id FROM users WHERE id = l.assigned_to),
  (SELECT company_id FROM users WHERE id = l.created_by)
);

UPDATE customers c
SET company_id = COALESCE(
  c.company_id,
  (SELECT company_id FROM users WHERE id = c.owner_id),
  (SELECT company_id FROM leads WHERE id = c.lead_id)
);

UPDATE deals d
SET company_id = COALESCE(
  d.company_id,
  (SELECT company_id FROM users WHERE id = d.owner_id),
  (SELECT company_id FROM customers WHERE id = d.customer_id),
  (SELECT company_id FROM leads WHERE id = d.lead_id)
);

UPDATE activities a
SET company_id = COALESCE(
  a.company_id,
  (SELECT company_id FROM users WHERE id = a.user_id),
  (SELECT company_id FROM customers WHERE id = a.related_customer_id),
  (SELECT company_id FROM leads WHERE id = a.related_lead_id),
  (SELECT company_id FROM deals WHERE id = a.related_deal_id)
);

UPDATE notifications n
SET company_id = COALESCE(n.company_id, u.company_id)
FROM users u
WHERE u.id = n.user_id;

CREATE INDEX IF NOT EXISTS idx_users_platform_role ON users(platform_role);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_company_role ON users(company_role);
CREATE INDEX IF NOT EXISTS idx_users_manager_id ON users(manager_id);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_activities_company_id ON activities(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);

DROP TRIGGER IF EXISTS trg_companies_set_updated_at ON companies;
CREATE TRIGGER trg_companies_set_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
