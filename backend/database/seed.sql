-- ============================================
-- NexCRM VIPS SAMPLE DATABASE SEED
-- Run after migrations are applied.
-- Command example:
--   psql -U postgres -d crm_db -f backend/database/seed.sql
-- ============================================

BEGIN;

DO $$
DECLARE
  vips_company_id BIGINT;
  company_admin_id BIGINT;
  manager_id BIGINT;
  sales_rep_1_id BIGINT;
  sales_rep_2_id BIGINT;
  sales_rep_3_id BIGINT;
  password_hash_constant TEXT := '$2b$10$.RRfkxP36ArfFoy8cEdpHe9aa2y1S77pfAGFZHMXTckhtMNjkBo5i';
BEGIN
  -- 1) Ensure VIPS company exists.
  INSERT INTO companies (
    name,
    email,
    phone,
    industry,
    company_size,
    address,
    subscription_plan,
    status
  )
  VALUES (
    'VIPS',
    'ops@vipscrm.com',
    '+91-9000000000',
    'Technology',
    '51-200',
    'VIPS Business Park, Bengaluru',
    'growth',
    'active'
  )
  ON CONFLICT (email) DO UPDATE
  SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    industry = EXCLUDED.industry,
    company_size = EXCLUDED.company_size,
    address = EXCLUDED.address,
    subscription_plan = EXCLUDED.subscription_plan,
    status = EXCLUDED.status,
    updated_at = NOW();

  SELECT id
  INTO vips_company_id
  FROM companies
  WHERE email = 'ops@vipscrm.com'
  LIMIT 1;

  IF vips_company_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve VIPS company id';
  END IF;

  -- 2) Reset VIPS-scoped data only.
  DELETE FROM notifications WHERE company_id = vips_company_id;
  DELETE FROM activities WHERE company_id = vips_company_id;
  DELETE FROM deals WHERE company_id = vips_company_id;
  DELETE FROM customers WHERE company_id = vips_company_id;
  DELETE FROM leads WHERE company_id = vips_company_id;
  DELETE FROM users WHERE company_id = vips_company_id;

  -- 3) Users.
  INSERT INTO users (
    full_name,
    email,
    password_hash,
    role,
    company_role,
    company_id,
    avatar_url,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    'Param Aggarwal',
    'param@vipscrm.com',
    password_hash_constant,
    'admin',
    'company_admin',
    vips_company_id,
    'https://api.dicebear.com/9.x/initials/svg?seed=Param',
    TRUE,
    NOW() - INTERVAL '90 days',
    NOW() - INTERVAL '90 days'
  )
  RETURNING id INTO company_admin_id;

  INSERT INTO users (
    full_name,
    email,
    password_hash,
    role,
    company_role,
    company_id,
    manager_id,
    avatar_url,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    'Hridhay Chaudhary',
    'hridhay@vipscrm.com',
    password_hash_constant,
    'manager',
    'manager',
    vips_company_id,
    company_admin_id,
    'https://api.dicebear.com/9.x/initials/svg?seed=Hridhay',
    TRUE,
    NOW() - INTERVAL '85 days',
    NOW() - INTERVAL '85 days'
  )
  RETURNING id INTO manager_id;

  INSERT INTO users (
    full_name,
    email,
    password_hash,
    role,
    company_role,
    company_id,
    manager_id,
    avatar_url,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    'Priya Sharma',
    'priya@vipscrm.com',
    password_hash_constant,
    'sales_rep',
    'sales_rep',
    vips_company_id,
    manager_id,
    'https://api.dicebear.com/9.x/initials/svg?seed=Priya',
    TRUE,
    NOW() - INTERVAL '80 days',
    NOW() - INTERVAL '80 days'
  )
  RETURNING id INTO sales_rep_1_id;

  INSERT INTO users (
    full_name,
    email,
    password_hash,
    role,
    company_role,
    company_id,
    manager_id,
    avatar_url,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    'Arjun Mehta',
    'arjun@vipscrm.com',
    password_hash_constant,
    'sales_rep',
    'sales_rep',
    vips_company_id,
    manager_id,
    'https://api.dicebear.com/9.x/initials/svg?seed=Arjun',
    TRUE,
    NOW() - INTERVAL '75 days',
    NOW() - INTERVAL '75 days'
  )
  RETURNING id INTO sales_rep_2_id;

  INSERT INTO users (
    full_name,
    email,
    password_hash,
    role,
    company_role,
    company_id,
    manager_id,
    avatar_url,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    'Neha Kapoor',
    'neha@vipscrm.com',
    password_hash_constant,
    'sales_rep',
    'sales_rep',
    vips_company_id,
    manager_id,
    'https://api.dicebear.com/9.x/initials/svg?seed=Neha',
    TRUE,
    NOW() - INTERVAL '70 days',
    NOW() - INTERVAL '70 days'
  )
  RETURNING id INTO sales_rep_3_id;

  -- 4) Leads.
  INSERT INTO leads (
    name,
    email,
    phone,
    company,
    source,
    status,
    score,
    estimated_value,
    notes,
    assigned_to,
    created_by,
    last_contacted_at,
    company_id,
    created_at,
    updated_at
  )
  VALUES
  ('Rahul Verma',     'rahul@techstartup.in', '+91-9811001001', 'TechStartup Pvt Ltd',     'Website',       'new',       68,  45000,  'Interested in dashboard + alerts bundle.',                  sales_rep_1_id, manager_id, NOW() - INTERVAL '30 days', vips_company_id, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('Sneha Patel',     'sneha@cloudnine.com',  '+91-9822002002', 'CloudNine Solutions',     'LinkedIn',      'contacted', 77, 120000,  'Requested pricing for 50 users.',                           sales_rep_2_id, manager_id, NOW() - INTERVAL '27 days', vips_company_id, NOW() - INTERVAL '28 days', NOW() - INTERVAL '27 days'),
  ('Vikram Singh',    'vikram@globaledge.io', '+91-9833003003', 'GlobalEdge Technologies', 'Referral',      'qualified', 84,  85000,  'Strong need for pipeline reporting.',                       sales_rep_1_id, manager_id, NOW() - INTERVAL '25 days', vips_company_id, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
  ('Anjali Nair',     'anjali@softvision.co', '+91-9844004004', 'SoftVision Co',           'Cold Outreach', 'new',       54,  30000,  'Asked for onboarding timeline details.',                    sales_rep_3_id, manager_id, NOW() - INTERVAL '22 days', vips_company_id, NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days'),
  ('Rohit Agarwal',   'rohit@nextgenapp.com', '+91-9855005005', 'NextGen Apps',            'Website',       'contacted', 72,  95000,  'Demo completed, waiting internal review.',                  sales_rep_2_id, manager_id, NOW() - INTERVAL '20 days', vips_company_id, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('Kavya Reddy',     'kavya@pixelcraft.in',  '+91-9866006006', 'PixelCraft Studio',       'LinkedIn',      'qualified', 79,  60000,  'Scope includes analytics and lead routing.',                sales_rep_1_id, manager_id, NOW() - INTERVAL '18 days', vips_company_id, NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days'),
  ('Siddharth Joshi', 'sid@databridge.com',   '+91-9877007007', 'DataBridge Analytics',    'Website',       'new',       66, 200000,  'Enterprise opportunity, needs security docs.',              sales_rep_3_id, manager_id, NOW() - INTERVAL '15 days', vips_company_id, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
  ('Meera Iyer',      'meera@fusiontech.in',  '+91-9888008008', 'FusionTech India',        'Referral',      'contacted', 71,  75000,  'Asked for integration checklist.',                           sales_rep_2_id, manager_id, NOW() - INTERVAL '14 days', vips_company_id, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  ('Aditya Kumar',    'aditya@smartlogic.io', '+91-9899009009', 'SmartLogic Systems',      'Cold Outreach', 'lost',      40,  50000,  'Budget was reallocated this quarter.',                      sales_rep_1_id, manager_id, NOW() - INTERVAL '40 days', vips_company_id, NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),
  ('Pooja Bhatia',    'pooja@vortexsol.com',  '+91-9810010010', 'Vortex Solutions',        'Website',       'lost',      37,  35000,  'Chose incumbent vendor.',                                    sales_rep_3_id, manager_id, NOW() - INTERVAL '45 days', vips_company_id, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  ('Karan Malhotra',  'karan@zenithsys.com',  '+91-9821011011', 'Zenith Systems',          'LinkedIn',      'qualified', 88, 150000,  'Ready for commercial proposal review.',                      sales_rep_2_id, manager_id, NOW() - INTERVAL '10 days', vips_company_id, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  ('Divya Menon',     'divya@horizonit.in',   '+91-9832012012', 'Horizon IT Services',     'Website',       'new',       58,  40000,  'Potential pilot for support team.',                          sales_rep_1_id, manager_id, NOW() - INTERVAL '5 days',  vips_company_id, NOW() - INTERVAL '5 days',  NOW() - INTERVAL '5 days'),
  ('Ravi Teja',       'ravi@alphacode.com',   '+91-9843013013', 'AlphaCode Labs',          'Referral',      'contacted', 76, 180000,  'Needs stakeholder presentation deck.',                       sales_rep_3_id, manager_id, NOW() - INTERVAL '3 days',  vips_company_id, NOW() - INTERVAL '3 days',  NOW() - INTERVAL '3 days'),
  ('Simran Kaur',     'simran@brightmind.in', '+91-9854014014', 'BrightMind Tech',         'LinkedIn',      'new',       64,  55000,  'Inbound form lead, demo pending.',                           sales_rep_2_id, manager_id, NOW() - INTERVAL '1 day',   vips_company_id, NOW() - INTERVAL '1 day',   NOW() - INTERVAL '1 day'),
  ('Nikhil Desai',    'nikhil@corelogic.com', '+91-9865015015', 'CoreLogic India',         'Cold Outreach', 'qualified', 81, 110000,  'Asking for annual + multi-team pricing.',                    sales_rep_1_id, manager_id, NOW() - INTERVAL '7 days',  vips_company_id, NOW() - INTERVAL '7 days',  NOW() - INTERVAL '7 days');

  -- 5) Customers.
  INSERT INTO customers (
    lead_id,
    name,
    email,
    phone,
    company,
    industry,
    owner_id,
    lifecycle_stage,
    total_revenue,
    notes,
    company_id,
    created_at,
    updated_at
  )
  VALUES
  ((SELECT id FROM leads WHERE email = 'vikram@globaledge.io' AND company_id = vips_company_id), 'Amit Sharma',       'amit@techcorp.in',       '+91-9811100001', 'TechCorp India',        'Technology',   sales_rep_1_id, 'vip',      245000, 'Top account with expansion potential.',                 vips_company_id, NOW() - INTERVAL '80 days', NOW() - INTERVAL '80 days'),
  ((SELECT id FROM leads WHERE email = 'sneha@cloudnine.com' AND company_id = vips_company_id), 'Sunita Rao',        'sunita@mediapro.com',    '+91-9822200002', 'MediaPro Solutions',    'Media',        sales_rep_2_id, 'active',   185000, 'Stable retention, good upsell candidate.',              vips_company_id, NOW() - INTERVAL '75 days', NOW() - INTERVAL '75 days'),
  ((SELECT id FROM leads WHERE email = 'rahul@techstartup.in' AND company_id = vips_company_id), 'Deepak Nair',       'deepak@financeplus.in',  '+91-9833300003', 'FinancePlus Ltd',       'Finance',      sales_rep_3_id, 'vip',      320000, 'Excellent product adoption.',                            vips_company_id, NOW() - INTERVAL '70 days', NOW() - INTERVAL '70 days'),
  ((SELECT id FROM leads WHERE email = 'meera@fusiontech.in' AND company_id = vips_company_id),  'Priyanka Gupta',    'priyanka@retailhub.com', '+91-9844400004', 'RetailHub India',       'Retail',       sales_rep_1_id, 'active',    98000, 'Interested in custom reports.',                          vips_company_id, NOW() - INTERVAL '65 days', NOW() - INTERVAL '65 days'),
  ((SELECT id FROM leads WHERE email = 'kavya@pixelcraft.in' AND company_id = vips_company_id),  'Manish Tiwari',     'manish@logisticspro.in', '+91-9855500005', 'LogisticsPro',          'Logistics',    sales_rep_2_id, 'vip',      420000, 'Strong ROI case study from prior quarter.',             vips_company_id, NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'),
  (NULL,                                                                           'Rekha Pillai',      'rekha@healthtech.com',   '+91-9866600006', 'HealthTech Solutions',  'Healthcare',   sales_rep_3_id, 'churned',   75000, 'On hold due to internal restructuring.',                vips_company_id, NOW() - INTERVAL '55 days', NOW() - INTERVAL '55 days'),
  (NULL,                                                                           'Gaurav Bajaj',      'gaurav@edusmart.in',     '+91-9877700007', 'EduSmart Platform',     'Education',    sales_rep_1_id, 'active',   155000, 'Renewal expected this quarter.',                        vips_company_id, NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days'),
  (NULL,                                                                           'Nisha Choudhary',   'nisha@autoworks.com',    '+91-9888800008', 'AutoWorks Pvt Ltd',     'Automotive',   sales_rep_2_id, 'active',   290000, 'Expanding to second business unit.',                    vips_company_id, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  (NULL,                                                                           'Vijay Pandey',      'vijay@constructx.in',    '+91-9899900009', 'ConstructX Builders',   'Construction', sales_rep_3_id, 'at_risk',    60000, 'Needs executive sponsor call.',                         vips_company_id, NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),
  (NULL,                                                                           'Ananya Srivastava', 'ananya@agritech.com',    '+91-9810100010', 'AgriTech Innovations',  'Agriculture',  sales_rep_1_id, 'active',   195000, 'Positive engagement with operations team.',             vips_company_id, NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days');

  -- 6) Deals across all stages.
  INSERT INTO deals (
    title,
    customer_id,
    lead_id,
    owner_id,
    stage,
    status,
    value,
    probability,
    expected_close_date,
    company_id,
    created_at,
    updated_at
  )
  VALUES
  ('TechCorp Annual License',       (SELECT id FROM customers WHERE email = 'amit@techcorp.in'      AND company_id = vips_company_id), NULL, sales_rep_1_id, 'proposal',    'open', 120000,  60, CURRENT_DATE + INTERVAL '15 days', vips_company_id, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('TechCorp Support Package',      (SELECT id FROM customers WHERE email = 'amit@techcorp.in'      AND company_id = vips_company_id), NULL, sales_rep_1_id, 'won',         'won',   85000, 100, CURRENT_DATE - INTERVAL '5 days',  vips_company_id, NOW() - INTERVAL '45 days', NOW() - INTERVAL '45 days'),
  ('MediaPro Campaign Suite',       (SELECT id FROM customers WHERE email = 'sunita@mediapro.com'   AND company_id = vips_company_id), NULL, sales_rep_2_id, 'negotiation', 'open',  95000,  75, CURRENT_DATE + INTERVAL '10 days', vips_company_id, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
  ('FinancePlus Data Analytics',    (SELECT id FROM customers WHERE email = 'deepak@financeplus.in' AND company_id = vips_company_id), NULL, sales_rep_3_id, 'won',         'won',  200000, 100, CURRENT_DATE - INTERVAL '10 days', vips_company_id, NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days'),
  ('FinancePlus CRM Upgrade',       (SELECT id FROM customers WHERE email = 'deepak@financeplus.in' AND company_id = vips_company_id), NULL, sales_rep_3_id, 'discovery',   'open', 150000,  20, CURRENT_DATE + INTERVAL '30 days', vips_company_id, NOW() - INTERVAL '5 days',  NOW() - INTERVAL '5 days'),
  ('RetailHub Inventory Module',    (SELECT id FROM customers WHERE email = 'priyanka@retailhub.com'AND company_id = vips_company_id), NULL, sales_rep_1_id, 'discovery',   'open',  65000,  35, CURRENT_DATE + INTERVAL '20 days', vips_company_id, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
  ('LogisticsPro Fleet Management', (SELECT id FROM customers WHERE email = 'manish@logisticspro.in'AND company_id = vips_company_id), NULL, sales_rep_2_id, 'won',         'won',  280000, 100, CURRENT_DATE - INTERVAL '20 days', vips_company_id, NOW() - INTERVAL '75 days', NOW() - INTERVAL '75 days'),
  ('LogisticsPro Route Optimizer',  (SELECT id FROM customers WHERE email = 'manish@logisticspro.in'AND company_id = vips_company_id), NULL, sales_rep_2_id, 'proposal',    'open', 180000,  55, CURRENT_DATE + INTERVAL '25 days', vips_company_id, NOW() - INTERVAL '8 days',  NOW() - INTERVAL '8 days'),
  ('EduSmart Learning Platform',    (SELECT id FROM customers WHERE email = 'gaurav@edusmart.in'    AND company_id = vips_company_id), NULL, sales_rep_1_id, 'negotiation', 'open', 110000,  80, CURRENT_DATE + INTERVAL '7 days',  vips_company_id, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
  ('AutoWorks Service Module',      (SELECT id FROM customers WHERE email = 'nisha@autoworks.com'   AND company_id = vips_company_id), NULL, sales_rep_2_id, 'won',         'won',  175000, 100, CURRENT_DATE - INTERVAL '15 days', vips_company_id, NOW() - INTERVAL '50 days', NOW() - INTERVAL '50 days'),
  ('AutoWorks Analytics Dashboard', (SELECT id FROM customers WHERE email = 'nisha@autoworks.com'   AND company_id = vips_company_id), NULL, sales_rep_3_id, 'discovery',   'open',  90000,  40, CURRENT_DATE + INTERVAL '35 days', vips_company_id, NOW() - INTERVAL '3 days',  NOW() - INTERVAL '3 days'),
  ('AgriTech Sensor Integration',   (SELECT id FROM customers WHERE email = 'ananya@agritech.com'   AND company_id = vips_company_id), NULL, sales_rep_1_id, 'proposal',    'open', 140000,  65, CURRENT_DATE + INTERVAL '18 days', vips_company_id, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
  ('ConstructX Project Management', (SELECT id FROM customers WHERE email = 'vijay@constructx.in'   AND company_id = vips_company_id), NULL, sales_rep_3_id, 'lost',        'lost',  80000,   0, CURRENT_DATE - INTERVAL '3 days',  vips_company_id, NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days'),
  ('HealthTech Patient Portal',     (SELECT id FROM customers WHERE email = 'rekha@healthtech.com'  AND company_id = vips_company_id), NULL, sales_rep_2_id, 'lost',        'lost',  55000,   0, CURRENT_DATE - INTERVAL '8 days',  vips_company_id, NOW() - INTERVAL '40 days', NOW() - INTERVAL '40 days'),
  ('FinancePlus Mobile App',        (SELECT id FROM customers WHERE email = 'deepak@financeplus.in' AND company_id = vips_company_id), NULL, sales_rep_1_id, 'discovery',   'open',  95000,  15, CURRENT_DATE + INTERVAL '45 days', vips_company_id, NOW() - INTERVAL '2 days',  NOW() - INTERVAL '2 days');

  -- 7) Activities.
  INSERT INTO activities (
    type,
    subject,
    notes,
    due_at,
    completed_at,
    related_lead_id,
    related_customer_id,
    related_deal_id,
    user_id,
    company_id,
    created_at,
    updated_at
  )
  VALUES
  ('call',    'Initial Discovery Call',      'Discussed pain points and current CRM usage.',                                NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days', (SELECT id FROM leads WHERE email = 'rahul@techstartup.in' AND company_id = vips_company_id), NULL, (SELECT id FROM deals WHERE title = 'TechCorp Annual License' AND company_id = vips_company_id), sales_rep_1_id, vips_company_id, NOW() - INTERVAL '19 days', NOW() - INTERVAL '19 days'),
  ('email',   'Sent Proposal PDF',           'Detailed pricing proposal shared with stakeholders.',                          NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', (SELECT id FROM leads WHERE email = 'rahul@techstartup.in' AND company_id = vips_company_id), NULL, (SELECT id FROM deals WHERE title = 'TechCorp Annual License' AND company_id = vips_company_id), sales_rep_1_id, vips_company_id, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
  ('meeting', 'Product Demo - TechCorp',     'Client loved dashboard and automation workflows.',                             NOW() - INTERVAL '8 days',  NOW() - INTERVAL '8 days',  NULL, (SELECT id FROM customers WHERE email = 'amit@techcorp.in' AND company_id = vips_company_id), (SELECT id FROM deals WHERE title = 'TechCorp Annual License' AND company_id = vips_company_id), sales_rep_1_id, vips_company_id, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
  ('call',    'Follow-up Call',              'Client requested a 2-week trial period.',                                     NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', NULL, (SELECT id FROM customers WHERE email = 'sunita@mediapro.com' AND company_id = vips_company_id), (SELECT id FROM deals WHERE title = 'MediaPro Campaign Suite' AND company_id = vips_company_id), sales_rep_2_id, vips_company_id, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
  ('email',   'MediaPro Contract Draft',     'Contract draft sent for legal review.',                                       NOW() - INTERVAL '5 days',  NOW() - INTERVAL '5 days',  NULL, (SELECT id FROM customers WHERE email = 'sunita@mediapro.com' AND company_id = vips_company_id), (SELECT id FROM deals WHERE title = 'MediaPro Campaign Suite' AND company_id = vips_company_id), sales_rep_2_id, vips_company_id, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  ('meeting', 'Negotiation Meeting',         'Discussed annual commitment discount options.',                                NOW() - INTERVAL '2 days',  NOW() - INTERVAL '2 days',  NULL, (SELECT id FROM customers WHERE email = 'sunita@mediapro.com' AND company_id = vips_company_id), (SELECT id FROM deals WHERE title = 'MediaPro Campaign Suite' AND company_id = vips_company_id), sales_rep_2_id, vips_company_id, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('call',    'FinancePlus Kick-off',        'Project kick-off call with implementation team.',                             NOW() - INTERVAL '58 days', NOW() - INTERVAL '58 days', NULL, (SELECT id FROM customers WHERE email = 'deepak@financeplus.in' AND company_id = vips_company_id), (SELECT id FROM deals WHERE title = 'FinancePlus Data Analytics' AND company_id = vips_company_id), sales_rep_3_id, vips_company_id, NOW() - INTERVAL '58 days', NOW() - INTERVAL '58 days'),
  ('meeting', 'Quarterly Business Review',   'QBR prepared. Upsell opportunity identified.',                                NOW() + INTERVAL '1 day',   NULL,                      NULL, (SELECT id FROM customers WHERE email = 'deepak@financeplus.in' AND company_id = vips_company_id), (SELECT id FROM deals WHERE title = 'FinancePlus CRM Upgrade' AND company_id = vips_company_id), sales_rep_3_id, vips_company_id, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
  ('email',   'Sent Feature Update Docs',    'Shared latest release notes and enablement docs.',                           NOW() - INTERVAL '9 days',  NOW() - INTERVAL '9 days', NULL, (SELECT id FROM customers WHERE email = 'priyanka@retailhub.com' AND company_id = vips_company_id), (SELECT id FROM deals WHERE title = 'RetailHub Inventory Module' AND company_id = vips_company_id), sales_rep_1_id, vips_company_id, NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days'),
  ('call',    'LogisticsPro Renewal Call',   'Annual renewal confirmed and expansion discussed.',                           NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days', NULL, (SELECT id FROM customers WHERE email = 'manish@logisticspro.in' AND company_id = vips_company_id), (SELECT id FROM deals WHERE title = 'LogisticsPro Fleet Management' AND company_id = vips_company_id), sales_rep_2_id, vips_company_id, NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days'),
  ('meeting', 'EduSmart Final Negotiation',  'Final pricing discussion scheduled.',                                         NOW() + INTERVAL '2 days',  NULL,                      NULL, (SELECT id FROM customers WHERE email = 'gaurav@edusmart.in' AND company_id = vips_company_id), (SELECT id FROM deals WHERE title = 'EduSmart Learning Platform' AND company_id = vips_company_id), sales_rep_1_id, vips_company_id, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('email',   'AgriTech Proposal Follow-up', 'Follow-up mail sent after proposal review meeting.',                         NOW() - INTERVAL '5 days',  NOW() - INTERVAL '5 days', NULL, (SELECT id FROM customers WHERE email = 'ananya@agritech.com' AND company_id = vips_company_id), (SELECT id FROM deals WHERE title = 'AgriTech Sensor Integration' AND company_id = vips_company_id), sales_rep_1_id, vips_company_id, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
  ('call',    'Lead Qualification - Rahul',  'Qualified lead with confirmed budget and timeline.',                         NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days', (SELECT id FROM leads WHERE email = 'rahul@techstartup.in' AND company_id = vips_company_id), NULL, NULL, sales_rep_1_id, vips_company_id, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days'),
  ('email',   'Intro Email - Sneha Patel',   'Shared introductory deck and use cases.',                                    NOW() - INTERVAL '27 days', NOW() - INTERVAL '27 days', (SELECT id FROM leads WHERE email = 'sneha@cloudnine.com' AND company_id = vips_company_id), NULL, NULL, sales_rep_2_id, vips_company_id, NOW() - INTERVAL '27 days', NOW() - INTERVAL '27 days'),
  ('call',    'Discovery - Vikram Singh',    'Strong fit for analytics module; next demo planned.',                        NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', (SELECT id FROM leads WHERE email = 'vikram@globaledge.io' AND company_id = vips_company_id), NULL, NULL, sales_rep_1_id, vips_company_id, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days'),
  ('meeting', 'Demo - Karan Malhotra',       'Comprehensive product walkthrough completed.',                                NOW() - INTERVAL '6 days',  NOW() - INTERVAL '6 days',  (SELECT id FROM leads WHERE email = 'karan@zenithsys.com' AND company_id = vips_company_id), NULL, NULL, sales_rep_2_id, vips_company_id, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
  ('email',   'Proposal Sent - Nikhil',      'Customized proposal sent after requirement workshop.',                        NOW() - INTERVAL '4 days',  NOW() - INTERVAL '4 days',  (SELECT id FROM leads WHERE email = 'nikhil@corelogic.com' AND company_id = vips_company_id), NULL, NULL, sales_rep_1_id, vips_company_id, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
  ('call',    'AutoWorks Analytics Follow-up','Discussed dashboard requirements for service teams.',                        NOW() + INTERVAL '2 days',  NULL,                      NULL, (SELECT id FROM customers WHERE email = 'nisha@autoworks.com' AND company_id = vips_company_id), (SELECT id FROM deals WHERE title = 'AutoWorks Analytics Dashboard' AND company_id = vips_company_id), sales_rep_3_id, vips_company_id, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
  ('meeting', 'FinancePlus Mobile Review',   'Kickoff for mobile companion app requirements.',                              NOW() + INTERVAL '5 days',  NULL,                      NULL, (SELECT id FROM customers WHERE email = 'deepak@financeplus.in' AND company_id = vips_company_id), (SELECT id FROM deals WHERE title = 'FinancePlus Mobile App' AND company_id = vips_company_id), sales_rep_1_id, vips_company_id, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
  ('call',    'Check-in - Priyanka Gupta',   'Monthly check-in completed; usage guidance provided.',                        NOW() - INTERVAL '7 days',  NOW() - INTERVAL '7 days',  NULL, (SELECT id FROM customers WHERE email = 'priyanka@retailhub.com' AND company_id = vips_company_id), NULL, sales_rep_2_id, vips_company_id, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days');

  -- 8) Notifications.
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    remind_at,
    is_read,
    metadata,
    company_id,
    created_at
  )
  VALUES
  (sales_rep_1_id, 'lead',     'Lead needs follow-up',   'Rahul Verma has been idle for 3 days.', NOW() + INTERVAL '3 hours', FALSE, '{"priority":"high","source":"seed"}'::jsonb, vips_company_id, NOW() - INTERVAL '1 day'),
  (sales_rep_2_id, 'deal',     'Deal in negotiation',    'MediaPro Campaign Suite requires pricing approval.', NOW() + INTERVAL '6 hours', FALSE, '{"priority":"medium","source":"seed"}'::jsonb, vips_company_id, NOW() - INTERVAL '12 hours'),
  (sales_rep_3_id, 'reminder', 'Meeting tomorrow',       'FinancePlus mobile review is scheduled for tomorrow.', NOW() + INTERVAL '18 hours', FALSE, '{"priority":"medium","source":"seed"}'::jsonb, vips_company_id, NOW() - INTERVAL '10 hours'),
  (manager_id,     'system',   'Weekly pipeline digest', 'VIPS pipeline digest is ready for review.', NULL, TRUE, '{"source":"seed"}'::jsonb, vips_company_id, NOW() - INTERVAL '2 days'),
  (company_admin_id,'system',  'Onboarding complete',    'VIPS workspace sample data loaded successfully.', NULL, FALSE, '{"source":"seed"}'::jsonb, vips_company_id, NOW() - INTERVAL '1 hour');

  RAISE NOTICE 'VIPS seed completed: company_id=% users=% leads=% customers=% deals=% activities=%',
    vips_company_id,
    (SELECT COUNT(*) FROM users WHERE company_id = vips_company_id),
    (SELECT COUNT(*) FROM leads WHERE company_id = vips_company_id),
    (SELECT COUNT(*) FROM customers WHERE company_id = vips_company_id),
    (SELECT COUNT(*) FROM deals WHERE company_id = vips_company_id),
    (SELECT COUNT(*) FROM activities WHERE company_id = vips_company_id);
END $$;

COMMIT;
