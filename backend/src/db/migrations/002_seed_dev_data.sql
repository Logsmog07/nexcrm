BEGIN;

INSERT INTO users (full_name, email, password_hash, role, avatar_url)
VALUES
  (
    'Admin User',
    'admin@crm.local',
    '$2b$10$.RRfkxP36ArfFoy8cEdpHe9aa2y1S77pfAGFZHMXTckhtMNjkBo5i',
    'admin',
    'https://api.dicebear.com/9.x/initials/svg?seed=Admin'
  ),
  (
    'Maya Manager',
    'manager@crm.local',
    '$2b$10$.RRfkxP36ArfFoy8cEdpHe9aa2y1S77pfAGFZHMXTckhtMNjkBo5i',
    'manager',
    'https://api.dicebear.com/9.x/initials/svg?seed=Maya'
  ),
  (
    'Sam Sales',
    'sales@crm.local',
    '$2b$10$.RRfkxP36ArfFoy8cEdpHe9aa2y1S77pfAGFZHMXTckhtMNjkBo5i',
    'sales_rep',
    'https://api.dicebear.com/9.x/initials/svg?seed=Sam'
  )
ON CONFLICT (email) DO NOTHING;

WITH seeded_users AS (
  SELECT
    MAX(id) FILTER (WHERE email = 'admin@crm.local') AS admin_id,
    MAX(id) FILTER (WHERE email = 'manager@crm.local') AS manager_id,
    MAX(id) FILTER (WHERE email = 'sales@crm.local') AS sales_id
  FROM users
),
seeded_leads AS (
  INSERT INTO leads (
    name, email, phone, company, source, status, score, estimated_value, notes,
    assigned_to, created_by, last_contacted_at
  )
  SELECT *
  FROM (
    SELECT
      'Ava Thompson',
      'ava@northstar.io',
      '+1-555-101-2000',
      'Northstar Labs',
      'website',
      'qualified'::lead_status_enum,
      86,
      35000,
      'Requested enterprise analytics demo.',
      seeded_users.sales_id,
      seeded_users.manager_id,
      NOW() - INTERVAL '2 days'
    FROM seeded_users
    UNION ALL
    SELECT
      'Liam Carter',
      'liam@brightcore.com',
      '+1-555-101-2001',
      'Brightcore',
      'referral',
      'contacted'::lead_status_enum,
      62,
      18000,
      'Interested in lead routing automation.',
      seeded_users.sales_id,
      seeded_users.manager_id,
      NOW() - INTERVAL '5 days'
    FROM seeded_users
    UNION ALL
    SELECT
      'Sophia Reed',
      'sophia@deltaforge.ai',
      '+1-555-101-2002',
      'Deltaforge AI',
      'linkedin',
      'new'::lead_status_enum,
      41,
      12000,
      'Inbound trial signup with 12 seats.',
      seeded_users.manager_id,
      seeded_users.admin_id,
      NULL
    FROM seeded_users
  ) AS data (
    name, email, phone, company, source, status, score, estimated_value, notes,
    assigned_to, created_by, last_contacted_at
  )
  ON CONFLICT (email, company) DO NOTHING
  RETURNING id
)
INSERT INTO customers (
  lead_id, name, email, phone, company, industry, owner_id, lifecycle_stage, total_revenue, notes
)
SELECT
  NULL::BIGINT,
  'Noah Bennett',
  'noah@atlasops.com',
  '+1-555-302-1100',
  'AtlasOps',
  'B2B SaaS',
  seeded_users.manager_id,
  'vip',
  48000,
  'Key expansion account with strong renewal potential.'
FROM seeded_users
ON CONFLICT (email) DO NOTHING;

WITH seeded_users AS (
  SELECT
    MAX(id) FILTER (WHERE email = 'manager@crm.local') AS manager_id,
    MAX(id) FILTER (WHERE email = 'sales@crm.local') AS sales_id
  FROM users
),
customer_ref AS (
  SELECT id FROM customers WHERE email = 'noah@atlasops.com' LIMIT 1
),
lead_refs AS (
  SELECT
    MAX(id) FILTER (WHERE email = 'ava@northstar.io') AS ava_lead_id,
    MAX(id) FILTER (WHERE email = 'liam@brightcore.com') AS liam_lead_id
  FROM leads
)
INSERT INTO deals (
  title, customer_id, lead_id, owner_id, stage, status, value, probability, expected_close_date
)
SELECT *
FROM (
  SELECT
    'AtlasOps Renewal Expansion',
    customer_ref.id,
    NULL::BIGINT,
    seeded_users.manager_id,
    'proposal'::deal_stage_enum,
    'open'::deal_status_enum,
    22000,
    72,
    CURRENT_DATE + INTERVAL '18 days'
  FROM seeded_users, customer_ref
  UNION ALL
  SELECT
    'Northstar Enterprise Pilot',
    NULL::BIGINT,
    lead_refs.ava_lead_id,
    seeded_users.sales_id,
    'negotiation'::deal_stage_enum,
    'open'::deal_status_enum,
    35000,
    80,
    CURRENT_DATE + INTERVAL '10 days'
  FROM seeded_users, lead_refs
  UNION ALL
  SELECT
    'Brightcore Starter Rollout',
    NULL::BIGINT,
    lead_refs.liam_lead_id,
    seeded_users.sales_id,
    'discovery'::deal_stage_enum,
    'open'::deal_status_enum,
    18000,
    45,
    CURRENT_DATE + INTERVAL '28 days'
  FROM seeded_users, lead_refs
) AS data (
  title, customer_id, lead_id, owner_id, stage, status, value, probability, expected_close_date
)
WHERE NOT EXISTS (
  SELECT 1
  FROM deals d
  WHERE d.title = data.title
);

WITH seeded_users AS (
  SELECT MAX(id) FILTER (WHERE email = 'sales@crm.local') AS sales_id
  FROM users
),
lead_ref AS (
  SELECT id FROM leads WHERE email = 'ava@northstar.io' LIMIT 1
),
deal_ref AS (
  SELECT id FROM deals WHERE title = 'Northstar Enterprise Pilot' LIMIT 1
)
INSERT INTO activities (
  type, subject, notes, due_at, related_lead_id, related_deal_id, user_id
)
SELECT *
FROM (
  SELECT
    'call'::activity_type_enum,
    'Schedule procurement review',
    'Confirm security questionnaire and stakeholder list.',
    NOW() + INTERVAL '1 day',
    lead_ref.id,
    deal_ref.id,
    seeded_users.sales_id
  FROM seeded_users, lead_ref, deal_ref
  UNION ALL
  SELECT
    'email'::activity_type_enum,
    'Send ROI case study',
    'Follow up with usage metrics and expansion examples.',
    NOW() + INTERVAL '2 days',
    lead_ref.id,
    deal_ref.id,
    seeded_users.sales_id
  FROM seeded_users, lead_ref, deal_ref
) AS data (type, subject, notes, due_at, related_lead_id, related_deal_id, user_id)
WHERE NOT EXISTS (
  SELECT 1
  FROM activities a
  WHERE a.subject = data.subject
);

WITH seeded_users AS (
  SELECT MAX(id) FILTER (WHERE email = 'sales@crm.local') AS sales_id
  FROM users
)
INSERT INTO notifications (user_id, type, title, message, remind_at, metadata)
SELECT
  seeded_users.sales_id,
  'reminder',
  'Follow up with Northstar',
  'Procurement review is due tomorrow.',
  NOW() + INTERVAL '16 hours',
  '{"priority":"high","source":"seed"}'::jsonb
FROM seeded_users
WHERE NOT EXISTS (
  SELECT 1
  FROM notifications
  WHERE title = 'Follow up with Northstar'
);

COMMIT;
