-- Enhanced Cash Flow + FIRE data for demo user (Arjun Sharma)
-- Run against Supabase after the main demo-user-seed.sql

BEGIN;

-- ============================================================
-- 1. BACKFILL MONTHLY INCOME (Jun 2024 → Dec 2024)
--    Salary was ₹1.3L until Oct, got hike to ₹1.5L from Nov
-- ============================================================
INSERT INTO monthly_income (id, user_id, entry_month, salary, other_income, opening_balance, expense_limit, investment_target, savings_target, created_at) VALUES
  ('mi_demo_202406', 'user_demo', '2024-06', 130000, 0,     32000, 55000, 40000, 35000, '2024-06-01T10:00:00Z'),
  ('mi_demo_202407', 'user_demo', '2024-07', 130000, 8000,  28000, 55000, 40000, 43000, '2024-07-01T10:00:00Z'),
  ('mi_demo_202408', 'user_demo', '2024-08', 130000, 0,     35000, 55000, 40000, 35000, '2024-08-01T10:00:00Z'),
  ('mi_demo_202409', 'user_demo', '2024-09', 130000, 5000,  30000, 55000, 42000, 38000, '2024-09-01T10:00:00Z'),
  ('mi_demo_202410', 'user_demo', '2024-10', 130000, 0,     33000, 55000, 40000, 35000, '2024-10-01T10:00:00Z'),
  ('mi_demo_202411', 'user_demo', '2024-11', 150000, 0,     29000, 60000, 48000, 42000, '2024-11-01T10:00:00Z'),
  ('mi_demo_202412', 'user_demo', '2024-12', 150000, 15000, 38000, 65000, 50000, 50000, '2024-12-01T10:00:00Z')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. CASH FLOW ENTRIES (budget vs actual per category per month)
--    Jun 2024 → Dec 2024 + Apr 2025
-- ============================================================
INSERT INTO cash_flow_entries (id, category_id, entry_month, budget, actual, created_at) VALUES
  -- Jun 2024
  ('cfe_d_j01', 'cfc_demo_rent',        '2024-06', 16000, 16000, '2024-06-01T10:00:00Z'),
  ('cfe_d_j02', 'cfc_demo_groceries',   '2024-06', 6000,  5800,  '2024-06-01T10:00:00Z'),
  ('cfe_d_j03', 'cfc_demo_utilities',   '2024-06', 4000,  3900,  '2024-06-01T10:00:00Z'),
  ('cfe_d_j04', 'cfc_demo_transport',   '2024-06', 3500,  3200,  '2024-06-01T10:00:00Z'),
  ('cfe_d_j05', 'cfc_demo_food_out',    '2024-06', 5000,  5500,  '2024-06-01T10:00:00Z'),
  ('cfe_d_j06', 'cfc_demo_shopping',    '2024-06', 4000,  2800,  '2024-06-01T10:00:00Z'),
  ('cfe_d_j07', 'cfc_demo_subscriptions','2024-06',1500,  1500,  '2024-06-01T10:00:00Z'),
  ('cfe_d_j08', 'cfc_demo_health',      '2024-06', 2500,  2000,  '2024-06-01T10:00:00Z'),
  ('cfe_d_j09', 'cfc_demo_insurance',   '2024-06', 3500,  3500,  '2024-06-01T10:00:00Z'),
  ('cfe_d_j10', 'cfc_demo_misc',        '2024-06', 2500,  1800,  '2024-06-01T10:00:00Z'),

  -- Jul 2024
  ('cfe_d_k01', 'cfc_demo_rent',        '2024-07', 16000, 16000, '2024-07-01T10:00:00Z'),
  ('cfe_d_k02', 'cfc_demo_groceries',   '2024-07', 6000,  6200,  '2024-07-01T10:00:00Z'),
  ('cfe_d_k03', 'cfc_demo_utilities',   '2024-07', 4000,  4500,  '2024-07-01T10:00:00Z'),
  ('cfe_d_k04', 'cfc_demo_transport',   '2024-07', 3500,  3800,  '2024-07-01T10:00:00Z'),
  ('cfe_d_k05', 'cfc_demo_food_out',    '2024-07', 5000,  4200,  '2024-07-01T10:00:00Z'),
  ('cfe_d_k06', 'cfc_demo_shopping',    '2024-07', 4000,  6500,  '2024-07-01T10:00:00Z'),
  ('cfe_d_k07', 'cfc_demo_subscriptions','2024-07',1500,  1500,  '2024-07-01T10:00:00Z'),
  ('cfe_d_k08', 'cfc_demo_health',      '2024-07', 2500,  3500,  '2024-07-01T10:00:00Z'),
  ('cfe_d_k09', 'cfc_demo_insurance',   '2024-07', 3500,  3500,  '2024-07-01T10:00:00Z'),
  ('cfe_d_k10', 'cfc_demo_misc',        '2024-07', 2500,  2200,  '2024-07-01T10:00:00Z'),
  ('cfe_d_k11', 'cfc_demo_travel',      '2024-07', 0,     8000,  '2024-07-01T10:00:00Z'),

  -- Aug 2024
  ('cfe_d_l01', 'cfc_demo_rent',        '2024-08', 16000, 16000, '2024-08-01T10:00:00Z'),
  ('cfe_d_l02', 'cfc_demo_groceries',   '2024-08', 6000,  5500,  '2024-08-01T10:00:00Z'),
  ('cfe_d_l03', 'cfc_demo_utilities',   '2024-08', 4000,  3800,  '2024-08-01T10:00:00Z'),
  ('cfe_d_l04', 'cfc_demo_transport',   '2024-08', 3500,  3000,  '2024-08-01T10:00:00Z'),
  ('cfe_d_l05', 'cfc_demo_food_out',    '2024-08', 5000,  4800,  '2024-08-01T10:00:00Z'),
  ('cfe_d_l06', 'cfc_demo_shopping',    '2024-08', 4000,  3200,  '2024-08-01T10:00:00Z'),
  ('cfe_d_l07', 'cfc_demo_subscriptions','2024-08',1500,  1800,  '2024-08-01T10:00:00Z'),
  ('cfe_d_l08', 'cfc_demo_health',      '2024-08', 2500,  2200,  '2024-08-01T10:00:00Z'),
  ('cfe_d_l09', 'cfc_demo_insurance',   '2024-08', 3500,  3500,  '2024-08-01T10:00:00Z'),
  ('cfe_d_l10', 'cfc_demo_misc',        '2024-08', 2500,  2800,  '2024-08-01T10:00:00Z'),

  -- Sep 2024
  ('cfe_d_m01', 'cfc_demo_rent',        '2024-09', 16000, 16000, '2024-09-01T10:00:00Z'),
  ('cfe_d_m02', 'cfc_demo_groceries',   '2024-09', 6000,  6800,  '2024-09-01T10:00:00Z'),
  ('cfe_d_m03', 'cfc_demo_utilities',   '2024-09', 4000,  4200,  '2024-09-01T10:00:00Z'),
  ('cfe_d_m04', 'cfc_demo_transport',   '2024-09', 3500,  3600,  '2024-09-01T10:00:00Z'),
  ('cfe_d_m05', 'cfc_demo_food_out',    '2024-09', 5000,  7200,  '2024-09-01T10:00:00Z'),
  ('cfe_d_m06', 'cfc_demo_shopping',    '2024-09', 4000,  12000, '2024-09-01T10:00:00Z'),
  ('cfe_d_m07', 'cfc_demo_subscriptions','2024-09',1500,  1500,  '2024-09-01T10:00:00Z'),
  ('cfe_d_m08', 'cfc_demo_health',      '2024-09', 2500,  2500,  '2024-09-01T10:00:00Z'),
  ('cfe_d_m09', 'cfc_demo_insurance',   '2024-09', 3500,  3500,  '2024-09-01T10:00:00Z'),
  ('cfe_d_m10', 'cfc_demo_misc',        '2024-09', 2500,  3000,  '2024-09-01T10:00:00Z'),

  -- Oct 2024
  ('cfe_d_n01', 'cfc_demo_rent',        '2024-10', 16000, 16000, '2024-10-01T10:00:00Z'),
  ('cfe_d_n02', 'cfc_demo_groceries',   '2024-10', 6000,  7500,  '2024-10-01T10:00:00Z'),
  ('cfe_d_n03', 'cfc_demo_utilities',   '2024-10', 4000,  3500,  '2024-10-01T10:00:00Z'),
  ('cfe_d_n04', 'cfc_demo_transport',   '2024-10', 3500,  4200,  '2024-10-01T10:00:00Z'),
  ('cfe_d_n05', 'cfc_demo_food_out',    '2024-10', 5000,  8500,  '2024-10-01T10:00:00Z'),
  ('cfe_d_n06', 'cfc_demo_shopping',    '2024-10', 4000,  15000, '2024-10-01T10:00:00Z'),
  ('cfe_d_n07', 'cfc_demo_subscriptions','2024-10',1500,  1500,  '2024-10-01T10:00:00Z'),
  ('cfe_d_n08', 'cfc_demo_health',      '2024-10', 2500,  1800,  '2024-10-01T10:00:00Z'),
  ('cfe_d_n09', 'cfc_demo_insurance',   '2024-10', 3500,  3500,  '2024-10-01T10:00:00Z'),
  ('cfe_d_n10', 'cfc_demo_misc',        '2024-10', 2500,  4500,  '2024-10-01T10:00:00Z'),
  ('cfe_d_n11', 'cfc_demo_travel',      '2024-10', 5000,  22000, '2024-10-01T10:00:00Z'),

  -- Nov 2024 (salary hike month — slightly celebratory spend)
  ('cfe_d_o01', 'cfc_demo_rent',        '2024-11', 18000, 18000, '2024-11-01T10:00:00Z'),
  ('cfe_d_o02', 'cfc_demo_groceries',   '2024-11', 7000,  7200,  '2024-11-01T10:00:00Z'),
  ('cfe_d_o03', 'cfc_demo_utilities',   '2024-11', 4500,  4800,  '2024-11-01T10:00:00Z'),
  ('cfe_d_o04', 'cfc_demo_transport',   '2024-11', 3500,  3500,  '2024-11-01T10:00:00Z'),
  ('cfe_d_o05', 'cfc_demo_food_out',    '2024-11', 6000,  9500,  '2024-11-01T10:00:00Z'),
  ('cfe_d_o06', 'cfc_demo_shopping',    '2024-11', 5000,  18000, '2024-11-01T10:00:00Z'),
  ('cfe_d_o07', 'cfc_demo_subscriptions','2024-11',2000,  2000,  '2024-11-01T10:00:00Z'),
  ('cfe_d_o08', 'cfc_demo_health',      '2024-11', 3000,  2500,  '2024-11-01T10:00:00Z'),
  ('cfe_d_o09', 'cfc_demo_insurance',   '2024-11', 3500,  3500,  '2024-11-01T10:00:00Z'),
  ('cfe_d_o10', 'cfc_demo_misc',        '2024-11', 3000,  5000,  '2024-11-01T10:00:00Z'),

  -- Dec 2024 (year-end, bonus month, some gift spending)
  ('cfe_d_p01', 'cfc_demo_rent',        '2024-12', 18000, 18000, '2024-12-01T10:00:00Z'),
  ('cfe_d_p02', 'cfc_demo_groceries',   '2024-12', 8000,  9500,  '2024-12-01T10:00:00Z'),
  ('cfe_d_p03', 'cfc_demo_utilities',   '2024-12', 5000,  5200,  '2024-12-01T10:00:00Z'),
  ('cfe_d_p04', 'cfc_demo_transport',   '2024-12', 4000,  4500,  '2024-12-01T10:00:00Z'),
  ('cfe_d_p05', 'cfc_demo_food_out',    '2024-12', 6000,  11000, '2024-12-01T10:00:00Z'),
  ('cfe_d_p06', 'cfc_demo_shopping',    '2024-12', 5000,  25000, '2024-12-01T10:00:00Z'),
  ('cfe_d_p07', 'cfc_demo_subscriptions','2024-12',2000,  2000,  '2024-12-01T10:00:00Z'),
  ('cfe_d_p08', 'cfc_demo_health',      '2024-12', 3000,  2800,  '2024-12-01T10:00:00Z'),
  ('cfe_d_p09', 'cfc_demo_travel',      '2024-12', 5000,  18000, '2024-12-01T10:00:00Z'),
  ('cfe_d_p10', 'cfc_demo_insurance',   '2024-12', 3500,  3500,  '2024-12-01T10:00:00Z'),
  ('cfe_d_p11', 'cfc_demo_misc',        '2024-12', 3000,  8000,  '2024-12-01T10:00:00Z'),

  -- Apr 2025 (current month — partial)
  ('cfe_d_q01', 'cfc_demo_rent',        '2025-04', 18000, 18000, '2025-04-01T10:00:00Z'),
  ('cfe_d_q02', 'cfc_demo_groceries',   '2025-04', 8000,  3200,  '2025-04-01T10:00:00Z'),
  ('cfe_d_q03', 'cfc_demo_utilities',   '2025-04', 5000,  4800,  '2025-04-01T10:00:00Z'),
  ('cfe_d_q04', 'cfc_demo_transport',   '2025-04', 4000,  1200,  '2025-04-01T10:00:00Z'),
  ('cfe_d_q05', 'cfc_demo_food_out',    '2025-04', 6000,  2100,  '2025-04-01T10:00:00Z'),
  ('cfe_d_q06', 'cfc_demo_subscriptions','2025-04',2000,  498,   '2025-04-01T10:00:00Z'),
  ('cfe_d_q07', 'cfc_demo_health',      '2025-04', 3000,  1500,  '2025-04-01T10:00:00Z'),
  ('cfe_d_q08', 'cfc_demo_insurance',   '2025-04', 3500,  0,     '2025-04-01T10:00:00Z')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 3. CASH FLOW SPENDS (detailed line items)
--    Add spending entries for more months to show history
-- ============================================================
INSERT INTO cash_flow_spends (id, user_id, category_id, payment_method_id, amount, description, spend_date, entry_month, type, created_at) VALUES
  -- Oct 2024 - Diwali month (big spending)
  ('sp_d_o01', 'user_demo', 'cfc_demo_rent',       'pm_demo_bank_tf',     16000, 'October rent',                  '2024-10-01', '2024-10', 'expense', '2024-10-01T10:00:00Z'),
  ('sp_d_o02', 'user_demo', 'cfc_demo_groceries',  'pm_demo_gpay',        3500,  'BigBasket Diwali order',        '2024-10-05', '2024-10', 'expense', '2024-10-05T10:00:00Z'),
  ('sp_d_o03', 'user_demo', 'cfc_demo_groceries',  'pm_demo_gpay',        4000,  'Sweets + dry fruits',           '2024-10-28', '2024-10', 'expense', '2024-10-28T10:00:00Z'),
  ('sp_d_o04', 'user_demo', 'cfc_demo_food_out',   'pm_demo_hdfc_credit', 4500,  'Diwali party dinner',           '2024-10-30', '2024-10', 'expense', '2024-10-30T10:00:00Z'),
  ('sp_d_o05', 'user_demo', 'cfc_demo_food_out',   'pm_demo_gpay',        4000,  'Restaurant visits + Swiggy',    '2024-10-15', '2024-10', 'expense', '2024-10-15T10:00:00Z'),
  ('sp_d_o06', 'user_demo', 'cfc_demo_shopping',   'pm_demo_hdfc_credit', 8000,  'Diwali clothes - Myntra',       '2024-10-22', '2024-10', 'expense', '2024-10-22T10:00:00Z'),
  ('sp_d_o07', 'user_demo', 'cfc_demo_shopping',   'pm_demo_hdfc_credit', 4500,  'Gifts for family',              '2024-10-29', '2024-10', 'expense', '2024-10-29T10:00:00Z'),
  ('sp_d_o08', 'user_demo', 'cfc_demo_shopping',   'pm_demo_gpay',        2500,  'Home decor + lights',           '2024-10-26', '2024-10', 'expense', '2024-10-26T10:00:00Z'),
  ('sp_d_o09', 'user_demo', 'cfc_demo_travel',     'pm_demo_hdfc_credit', 12000, 'Diwali trip home (flights)',     '2024-10-28', '2024-10', 'expense', '2024-10-28T10:00:00Z'),
  ('sp_d_o10', 'user_demo', 'cfc_demo_travel',     'pm_demo_cash',        10000, 'Travel expenses at home',       '2024-10-31', '2024-10', 'expense', '2024-10-31T10:00:00Z'),
  ('sp_d_o11', 'user_demo', 'cfc_demo_misc',       'pm_demo_gpay',        2500,  'Diwali crackers + puja',        '2024-10-30', '2024-10', 'expense', '2024-10-30T10:00:00Z'),
  ('sp_d_o12', 'user_demo', 'cfc_demo_misc',       'pm_demo_cash',        2000,  'Cash gifts to house help',      '2024-10-29', '2024-10', 'expense', '2024-10-29T10:00:00Z'),
  ('sp_d_o13', 'user_demo', 'cfc_demo_salary',     'pm_demo_bank_tf',     130000,'October salary',                '2024-10-01', '2024-10', 'income',  '2024-10-01T10:00:00Z'),

  -- Nov 2024 (hike month)
  ('sp_d_n01', 'user_demo', 'cfc_demo_rent',       'pm_demo_bank_tf',     18000, 'November rent (new flat)',       '2024-11-01', '2024-11', 'expense', '2024-11-01T10:00:00Z'),
  ('sp_d_n02', 'user_demo', 'cfc_demo_groceries',  'pm_demo_gpay',        3800,  'BigBasket weekly',              '2024-11-05', '2024-11', 'expense', '2024-11-05T10:00:00Z'),
  ('sp_d_n03', 'user_demo', 'cfc_demo_groceries',  'pm_demo_gpay',        3400,  'Zepto + market',                '2024-11-18', '2024-11', 'expense', '2024-11-18T10:00:00Z'),
  ('sp_d_n04', 'user_demo', 'cfc_demo_food_out',   'pm_demo_hdfc_credit', 5500,  'Hike celebration dinner',       '2024-11-08', '2024-11', 'expense', '2024-11-08T10:00:00Z'),
  ('sp_d_n05', 'user_demo', 'cfc_demo_food_out',   'pm_demo_gpay',        4000,  'Weekend brunches + Zomato',     '2024-11-20', '2024-11', 'expense', '2024-11-20T10:00:00Z'),
  ('sp_d_n06', 'user_demo', 'cfc_demo_shopping',   'pm_demo_hdfc_credit', 12000, 'New laptop bag + headphones',   '2024-11-15', '2024-11', 'expense', '2024-11-15T10:00:00Z'),
  ('sp_d_n07', 'user_demo', 'cfc_demo_shopping',   'pm_demo_gpay',        6000,  'Winter clothes',                '2024-11-22', '2024-11', 'expense', '2024-11-22T10:00:00Z'),
  ('sp_d_n08', 'user_demo', 'cfc_demo_misc',       'pm_demo_gpay',        3000,  'House-warming gifts',           '2024-11-10', '2024-11', 'expense', '2024-11-10T10:00:00Z'),
  ('sp_d_n09', 'user_demo', 'cfc_demo_misc',       'pm_demo_cash',        2000,  'Misc expenses',                 '2024-11-25', '2024-11', 'expense', '2024-11-25T10:00:00Z'),
  ('sp_d_n10', 'user_demo', 'cfc_demo_salary',     'pm_demo_bank_tf',     150000,'November salary (post hike)',   '2024-11-01', '2024-11', 'income',  '2024-11-01T10:00:00Z'),

  -- Dec 2024 (year-end, bonus)
  ('sp_d_p01', 'user_demo', 'cfc_demo_rent',       'pm_demo_bank_tf',     18000, 'December rent',                 '2024-12-01', '2024-12', 'expense', '2024-12-01T10:00:00Z'),
  ('sp_d_p02', 'user_demo', 'cfc_demo_groceries',  'pm_demo_gpay',        5000,  'Christmas + NY groceries',      '2024-12-20', '2024-12', 'expense', '2024-12-20T10:00:00Z'),
  ('sp_d_p03', 'user_demo', 'cfc_demo_groceries',  'pm_demo_gpay',        4500,  'Regular groceries',             '2024-12-05', '2024-12', 'expense', '2024-12-05T10:00:00Z'),
  ('sp_d_p04', 'user_demo', 'cfc_demo_food_out',   'pm_demo_hdfc_credit', 6000,  'New Year party + restaurants',  '2024-12-28', '2024-12', 'expense', '2024-12-28T10:00:00Z'),
  ('sp_d_p05', 'user_demo', 'cfc_demo_food_out',   'pm_demo_gpay',        5000,  'Christmas dinner + office party','2024-12-25','2024-12', 'expense', '2024-12-25T10:00:00Z'),
  ('sp_d_p06', 'user_demo', 'cfc_demo_shopping',   'pm_demo_hdfc_credit', 15000, 'Year-end sale - electronics',   '2024-12-15', '2024-12', 'expense', '2024-12-15T10:00:00Z'),
  ('sp_d_p07', 'user_demo', 'cfc_demo_shopping',   'pm_demo_hdfc_credit', 10000, 'New Year gifts + clothes',      '2024-12-28', '2024-12', 'expense', '2024-12-28T10:00:00Z'),
  ('sp_d_p08', 'user_demo', 'cfc_demo_travel',     'pm_demo_hdfc_credit', 18000, 'Goa NYE trip',                  '2024-12-29', '2024-12', 'expense', '2024-12-29T10:00:00Z'),
  ('sp_d_p09', 'user_demo', 'cfc_demo_misc',       'pm_demo_gpay',        4000,  'Year-end donations',            '2024-12-30', '2024-12', 'expense', '2024-12-30T10:00:00Z'),
  ('sp_d_p10', 'user_demo', 'cfc_demo_misc',       'pm_demo_cash',        4000,  'Cash gifts + misc',             '2024-12-31', '2024-12', 'expense', '2024-12-31T10:00:00Z'),
  ('sp_d_p11', 'user_demo', 'cfc_demo_salary',     'pm_demo_bank_tf',     150000,'December salary',               '2024-12-01', '2024-12', 'income',  '2024-12-01T10:00:00Z'),
  ('sp_d_p12', 'user_demo', 'cfc_demo_freelance',  'pm_demo_bank_tf',     15000, 'Year-end bonus from freelance', '2024-12-20', '2024-12', 'income',  '2024-12-20T10:00:00Z'),

  -- Jan 2025 spending details
  ('sp_d_r01', 'user_demo', 'cfc_demo_rent',       'pm_demo_bank_tf',     18000, 'January rent',                  '2025-01-01', '2025-01', 'expense', '2025-01-01T10:00:00Z'),
  ('sp_d_r02', 'user_demo', 'cfc_demo_groceries',  'pm_demo_gpay',        3800,  'BigBasket weekly',              '2025-01-05', '2025-01', 'expense', '2025-01-05T10:00:00Z'),
  ('sp_d_r03', 'user_demo', 'cfc_demo_groceries',  'pm_demo_gpay',        3400,  'Zepto + vegetables',            '2025-01-15', '2025-01', 'expense', '2025-01-15T10:00:00Z'),
  ('sp_d_r04', 'user_demo', 'cfc_demo_food_out',   'pm_demo_hdfc_credit', 4000,  'Office team lunch',             '2025-01-10', '2025-01', 'expense', '2025-01-10T10:00:00Z'),
  ('sp_d_r05', 'user_demo', 'cfc_demo_food_out',   'pm_demo_gpay',        3500,  'Weekend outings + Swiggy',      '2025-01-20', '2025-01', 'expense', '2025-01-20T10:00:00Z'),
  ('sp_d_r06', 'user_demo', 'cfc_demo_salary',     'pm_demo_bank_tf',     150000,'January salary',                '2025-01-01', '2025-01', 'income',  '2025-01-01T10:00:00Z'),
  ('sp_d_r07', 'user_demo', 'cfc_demo_freelance',  'pm_demo_bank_tf',     5000,  'Logo design gig',              '2025-01-18', '2025-01', 'income',  '2025-01-18T10:00:00Z'),

  -- Feb 2025 spending details
  ('sp_d_s01', 'user_demo', 'cfc_demo_rent',       'pm_demo_bank_tf',     18000, 'February rent',                 '2025-02-01', '2025-02', 'expense', '2025-02-01T10:00:00Z'),
  ('sp_d_s02', 'user_demo', 'cfc_demo_groceries',  'pm_demo_gpay',        4200,  'Valentine special groceries',   '2025-02-10', '2025-02', 'expense', '2025-02-10T10:00:00Z'),
  ('sp_d_s03', 'user_demo', 'cfc_demo_groceries',  'pm_demo_gpay',        4300,  'Monthly groceries',             '2025-02-22', '2025-02', 'expense', '2025-02-22T10:00:00Z'),
  ('sp_d_s04', 'user_demo', 'cfc_demo_food_out',   'pm_demo_hdfc_credit', 3500,  'Valentine dinner',              '2025-02-14', '2025-02', 'expense', '2025-02-14T10:00:00Z'),
  ('sp_d_s05', 'user_demo', 'cfc_demo_food_out',   'pm_demo_gpay',        2300,  'Zomato + coffee',               '2025-02-20', '2025-02', 'expense', '2025-02-20T10:00:00Z'),
  ('sp_d_s06', 'user_demo', 'cfc_demo_shopping',   'pm_demo_hdfc_credit', 8500,  'Valentine gift + shoes',        '2025-02-13', '2025-02', 'expense', '2025-02-13T10:00:00Z'),
  ('sp_d_s07', 'user_demo', 'cfc_demo_salary',     'pm_demo_bank_tf',     150000,'February salary',               '2025-02-01', '2025-02', 'income',  '2025-02-01T10:00:00Z'),

  -- Apr 2025 (current month - partial)
  ('sp_d_t01', 'user_demo', 'cfc_demo_rent',       'pm_demo_bank_tf',     18000, 'April rent',                    '2025-04-01', '2025-04', 'expense', '2025-04-01T10:00:00Z'),
  ('sp_d_t02', 'user_demo', 'cfc_demo_groceries',  'pm_demo_gpay',        3200,  'BigBasket + Blinkit',           '2025-04-03', '2025-04', 'expense', '2025-04-03T10:00:00Z'),
  ('sp_d_t03', 'user_demo', 'cfc_demo_utilities',  'pm_demo_gpay',        1800,  'Electricity bill',              '2025-04-05', '2025-04', 'expense', '2025-04-05T10:00:00Z'),
  ('sp_d_t04', 'user_demo', 'cfc_demo_utilities',  'pm_demo_gpay',        800,   'WiFi bill',                     '2025-04-05', '2025-04', 'expense', '2025-04-05T10:00:00Z'),
  ('sp_d_t05', 'user_demo', 'cfc_demo_utilities',  'pm_demo_gpay',        2200,  'Gas + water + maint.',          '2025-04-06', '2025-04', 'expense', '2025-04-06T10:00:00Z'),
  ('sp_d_t06', 'user_demo', 'cfc_demo_transport',  'pm_demo_gpay',        1200,  'Uber + metro',                  '2025-04-04', '2025-04', 'expense', '2025-04-04T10:00:00Z'),
  ('sp_d_t07', 'user_demo', 'cfc_demo_food_out',   'pm_demo_gpay',        2100,  'Weekend brunch + Zomato',       '2025-04-06', '2025-04', 'expense', '2025-04-06T10:00:00Z'),
  ('sp_d_t08', 'user_demo', 'cfc_demo_subscriptions','pm_demo_hdfc_credit',498,  'Netflix + Spotify',             '2025-04-03', '2025-04', 'expense', '2025-04-03T10:00:00Z'),
  ('sp_d_t09', 'user_demo', 'cfc_demo_health',     'pm_demo_gpay',        1500,  'Gym April',                     '2025-04-01', '2025-04', 'expense', '2025-04-01T10:00:00Z'),
  ('sp_d_t10', 'user_demo', 'cfc_demo_salary',     'pm_demo_bank_tf',     155000,'April salary',                  '2025-04-01', '2025-04', 'income',  '2025-04-01T10:00:00Z')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 4. UPDATE FIRE SIMULATION — Make it more realistic
--    28yo earning ₹1.55L, portfolio ~₹25L
--    Realistic: retire at 42, ₹80K post-retirement expenses today
--    12% pre-tax returns, 10% capital gains tax, 6% inflation
-- ============================================================
-- NOTE: Percentage fields use DECIMAL fractions (0.12 = 12%, not 12)
UPDATE fire_simulations SET
  name = 'Early Retirement @ 42',
  current_age = 28,
  retirement_age = 42,
  life_expectancy = 85,
  current_savings = 2500000,
  monthly_saving = 55000,
  annual_savings_increase = 0.10,
  return_on_investment = 0.12,
  capital_gain_tax = 0.10,
  post_retirement_monthly_expense = 80000,
  inflation_rate = 0.06,
  start_year = 2025
WHERE id = 'fire_demo_1';

-- Add a second FIRE scenario: Lean FIRE (aggressive savings, lower expenses)
INSERT INTO fire_simulations (id, user_id, name, current_age, retirement_age, life_expectancy, current_savings, monthly_saving, annual_savings_increase, return_on_investment, capital_gain_tax, post_retirement_monthly_expense, inflation_rate, start_year, is_active, created_at) VALUES
  ('fire_demo_2', 'user_demo', 'Lean FIRE @ 38', 28, 38, 85, 2500000, 70000, 0.12, 0.12, 0.10, 60000, 0.06, 2025, true, '2025-02-01T10:00:00Z')
ON CONFLICT DO NOTHING;

-- Add a third scenario: Fat FIRE (comfortable retirement)
INSERT INTO fire_simulations (id, user_id, name, current_age, retirement_age, life_expectancy, current_savings, monthly_saving, annual_savings_increase, return_on_investment, capital_gain_tax, post_retirement_monthly_expense, inflation_rate, start_year, is_active, created_at) VALUES
  ('fire_demo_3', 'user_demo', 'Fat FIRE @ 50', 28, 50, 85, 2500000, 45000, 0.08, 0.11, 0.10, 120000, 0.06, 2025, true, '2025-02-01T10:00:00Z')
ON CONFLICT DO NOTHING;

COMMIT;
