BEGIN;

WITH default_company AS (
  SELECT id
  FROM companies
  WHERE email = 'workspace@crm.local'
  LIMIT 1
)
INSERT INTO users (
  full_name,
  email,
  password_hash,
  avatar_url,
  company_role,
  company_id,
  is_active
)
SELECT
  'Casey Company Admin',
  'companyadmin@crm.local',
  '$2b$10$.RRfkxP36ArfFoy8cEdpHe9aa2y1S77pfAGFZHMXTckhtMNjkBo5i',
  'https://api.dicebear.com/9.x/initials/svg?seed=Casey',
  'company_admin'::company_role_enum,
  default_company.id,
  TRUE
FROM default_company
ON CONFLICT (email) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash,
  avatar_url = EXCLUDED.avatar_url,
  company_role = EXCLUDED.company_role,
  company_id = EXCLUDED.company_id,
  is_active = TRUE;

WITH manager_user AS (
  SELECT id, company_id
  FROM users
  WHERE email = 'manager@crm.local'
  LIMIT 1
)
UPDATE users
SET
  manager_id = (SELECT id FROM manager_user),
  company_id = COALESCE(users.company_id, (SELECT company_id FROM manager_user))
WHERE email = 'sales@crm.local';

COMMIT;
