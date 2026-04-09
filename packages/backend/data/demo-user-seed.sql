-- Demo user seed for MoneyMatters
-- User: demo@moneymatters.app / demo1234
-- Profile: 28yo Indian software engineer, ₹1.5L/mo salary, started investing 2023
-- Run against Supabase Postgres:
--   psql <SUPABASE_URL> -f demo-user-seed.sql

BEGIN;

-- ============================================================
-- 1. DEMO USER
-- ============================================================
INSERT INTO users (id, email, name, password_hash, created_at)
VALUES (
  'user_demo',
  'demo@moneymatters.app',
  'Ron Richards',
  '$2b$10$Aj8WY0b1Wr..d057xlMET.l3vwVGCblzFknbdCPmWR2WPrP1p8vxG',
  '2024-01-15T10:00:00Z'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. APP SETTINGS
-- ============================================================
INSERT INTO app_settings (key, user_id, value) VALUES
  ('cycleStartDay', 'user_demo', '1'),
  ('dob', 'user_demo', '1997-08-15')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. TAGS
-- ============================================================
INSERT INTO tags (id, user_id, name, color, description, created_at) VALUES
  ('tag_demo_longterm',  'user_demo', 'Long Term',     '#10b981', 'Buy and hold >3 years',     '2024-01-15T10:00:00Z'),
  ('tag_demo_sip',       'user_demo', 'SIP',           '#6366f1', 'Monthly SIP investments',    '2024-01-15T10:00:00Z'),
  ('tag_demo_high_risk', 'user_demo', 'High Risk',     '#ef4444', 'Volatile / speculative',     '2024-01-15T10:00:00Z'),
  ('tag_demo_dividend',  'user_demo', 'Dividend',      '#f59e0b', 'Dividend income focused',    '2024-01-15T10:00:00Z'),
  ('tag_demo_retirement','user_demo', 'Retirement',    '#8b5cf6', 'Retirement corpus',          '2024-01-15T10:00:00Z'),
  ('tag_demo_emergency', 'user_demo', 'Emergency Fund','#06b6d4', 'Liquid emergency reserves',  '2024-01-15T10:00:00Z')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. ASSETS — Diversified Indian + US portfolio
-- ============================================================

-- Indian Stocks (yahoo_finance, INR)
INSERT INTO assets (id, user_id, symbol, name, asset_class, provider, currency, created_at) VALUES
  ('demo_reliance',    'user_demo', 'RELIANCE.NS',    'Reliance Industries Ltd',     'stocks', 'yahoo_finance', 'INR', '2024-02-01T10:00:00Z'),
  ('demo_tcs',         'user_demo', 'TCS.NS',         'Tata Consultancy Services',   'stocks', 'yahoo_finance', 'INR', '2024-02-01T10:00:00Z'),
  ('demo_hdfcbank',    'user_demo', 'HDFCBANK.NS',    'HDFC Bank Ltd',               'stocks', 'yahoo_finance', 'INR', '2024-02-01T10:00:00Z'),
  ('demo_infy',        'user_demo', 'INFY.NS',        'Infosys Ltd',                 'stocks', 'yahoo_finance', 'INR', '2024-03-15T10:00:00Z'),
  ('demo_bhartiartl',  'user_demo', 'BHARTIARTL.NS',  'Bharti Airtel Ltd',           'stocks', 'yahoo_finance', 'INR', '2024-04-10T10:00:00Z'),
  ('demo_icicibank',   'user_demo', 'ICICIBANK.NS',   'ICICI Bank Ltd',              'stocks', 'yahoo_finance', 'INR', '2024-05-20T10:00:00Z'),
  ('demo_wipro',       'user_demo', 'WIPRO.NS',       'Wipro Ltd',                   'stocks', 'yahoo_finance', 'INR', '2024-06-10T10:00:00Z'),
  ('demo_tatamotors',  'user_demo', 'TATAMOTORS.NS',  'Tata Motors Ltd',             'stocks', 'yahoo_finance', 'INR', '2024-03-01T10:00:00Z'),
  ('demo_ltim',        'user_demo', 'LTIM.NS',        'LTIMindtree Ltd',             'stocks', 'yahoo_finance', 'INR', '2024-07-15T10:00:00Z'),
  ('demo_dixon',       'user_demo', 'DIXON.NS',       'Dixon Technologies Ltd',      'stocks', 'yahoo_finance', 'INR', '2024-09-01T10:00:00Z');

-- US Stocks (yahoo_finance, USD)
INSERT INTO assets (id, user_id, symbol, name, asset_class, provider, currency, created_at) VALUES
  ('demo_aapl',  'user_demo', 'AAPL',  'Apple Inc.',          'stocks', 'yahoo_finance', 'USD', '2024-02-10T10:00:00Z'),
  ('demo_msft',  'user_demo', 'MSFT',  'Microsoft Corp.',     'stocks', 'yahoo_finance', 'USD', '2024-02-10T10:00:00Z'),
  ('demo_googl', 'user_demo', 'GOOGL', 'Alphabet Inc.',       'stocks', 'yahoo_finance', 'USD', '2024-04-01T10:00:00Z'),
  ('demo_nvda',  'user_demo', 'NVDA',  'NVIDIA Corp.',        'stocks', 'yahoo_finance', 'USD', '2024-03-20T10:00:00Z'),
  ('demo_amzn',  'user_demo', 'AMZN',  'Amazon.com Inc.',     'stocks', 'yahoo_finance', 'USD', '2024-06-01T10:00:00Z');

-- ETFs
INSERT INTO assets (id, user_id, symbol, name, asset_class, provider, currency, created_at) VALUES
  ('demo_niftybees', 'user_demo', 'NIFTYBEES.NS', 'Nippon India Nifty BeES',  'etf', 'yahoo_finance', 'INR', '2024-02-01T10:00:00Z'),
  ('demo_goldbees',  'user_demo', 'GOLDBEES.NS',  'Nippon India Gold BeES',   'etf', 'yahoo_finance', 'INR', '2024-05-01T10:00:00Z'),
  ('demo_voo',       'user_demo', 'VOO',          'Vanguard S&P 500 ETF',     'etf', 'yahoo_finance', 'USD', '2024-03-01T10:00:00Z');

-- Mutual Funds (manual, INR)
INSERT INTO assets (id, user_id, symbol, isin, name, asset_class, provider, currency, created_at) VALUES
  ('demo_mf_parag_flexi',  'user_demo', 'PARAG PARIKH FLEXI CAP FUND - DIRECT PLAN.NS',      'INF879O01027', 'Parag Parikh Flexi Cap Fund - Direct',     'mutual_fund_equity', 'manual', 'INR', '2024-01-20T10:00:00Z'),
  ('demo_mf_mirae_large',  'user_demo', 'MIRAE ASSET LARGE CAP FUND - DIRECT PLAN.NS',       'INF769K01EF3', 'Mirae Asset Large Cap Fund - Direct',      'mutual_fund_equity', 'manual', 'INR', '2024-01-20T10:00:00Z'),
  ('demo_mf_axis_small',   'user_demo', 'AXIS SMALL CAP FUND - DIRECT PLAN.NS',              'INF846K01EW2', 'Axis Small Cap Fund - Direct',             'mutual_fund_equity', 'manual', 'INR', '2024-03-01T10:00:00Z'),
  ('demo_mf_hdfc_mid',     'user_demo', 'HDFC MID-CAP OPPORTUNITIES FUND - DIRECT PLAN.NS',  'INF179K01BB8', 'HDFC Mid-Cap Opportunities Fund - Direct', 'mutual_fund_equity', 'manual', 'INR', '2024-04-01T10:00:00Z'),
  ('demo_mf_sbi_debt',     'user_demo', 'SBI MAGNUM MEDIUM DURATION FUND - DIRECT PLAN.NS',  'INF200K01RJ1', 'SBI Magnum Medium Duration Fund - Direct', 'mutual_fund_debt',   'manual', 'INR', '2024-02-01T10:00:00Z');

-- Crypto
INSERT INTO assets (id, user_id, symbol, name, asset_class, provider, currency, created_at) VALUES
  ('demo_btc',  'user_demo', 'BTC-USD', 'Bitcoin',  'crypto', 'yahoo_finance', 'USD', '2024-03-01T10:00:00Z'),
  ('demo_eth',  'user_demo', 'ETH-USD', 'Ethereum', 'crypto', 'yahoo_finance', 'USD', '2024-03-01T10:00:00Z');

-- Gold Physical
INSERT INTO assets (id, user_id, symbol, name, asset_class, provider, currency, created_at) VALUES
  ('demo_gold_physical', 'user_demo', 'GOLD-PHYSICAL-24K', 'Gold 24K (Physical)', 'gold_physical', 'manual', 'INR', '2024-01-15T10:00:00Z');

-- PPF & EPF
INSERT INTO assets (id, user_id, symbol, name, asset_class, provider, currency, created_at, interest_rate, institution) VALUES
  ('demo_ppf', 'user_demo', 'PPF-SBI',  'PPF - SBI',         'ppf', 'manual', 'INR', '2024-01-15T10:00:00Z', 7.1, 'SBI'),
  ('demo_epf', 'user_demo', 'EPF-EPFO', 'Employee PF - EPFO','epf', 'manual', 'INR', '2024-01-15T10:00:00Z', 8.25, 'EPFO');

-- Fixed Deposits
INSERT INTO assets (id, user_id, symbol, name, asset_class, provider, currency, created_at, interest_rate, maturity_date, institution) VALUES
  ('demo_fd_sbi',   'user_demo', 'FD-SBI-2025',    'SBI FD @7.1%',    'fixed_deposit', 'manual', 'INR', '2024-06-01T10:00:00Z', 7.1,  '2026-06-01', 'SBI'),
  ('demo_fd_kotak', 'user_demo', 'FD-KOTAK-2025',  'Kotak FD @7.4%',  'fixed_deposit', 'manual', 'INR', '2024-09-01T10:00:00Z', 7.4,  '2026-09-01', 'Kotak');

-- Cash Balances
INSERT INTO assets (id, user_id, symbol, name, asset_class, provider, currency, created_at, institution) VALUES
  ('demo_cash_sbi',    'user_demo', 'CASH-SBI-SAVINGS',      'SBI Savings Account',     'cash', 'manual', 'INR', '2024-01-15T10:00:00Z', 'SBI'),
  ('demo_cash_zerodha','user_demo', 'CASH-ZERODHA-WALLET',   'Zerodha Trading Wallet',  'cash', 'manual', 'INR', '2024-01-15T10:00:00Z', 'Zerodha'),
  ('demo_cash_ind',    'user_demo', 'CASH-INDMONEY-WALLET',  'INDmoney Wallet',         'cash', 'manual', 'USD', '2024-02-10T10:00:00Z', 'INDmoney');

-- Lended
INSERT INTO assets (id, user_id, symbol, name, asset_class, provider, currency, created_at, institution) VALUES
  ('demo_lend_friend', 'user_demo', 'LEND-FRIEND-VIKRAM', 'Lent to Vikram', 'lended', 'manual', 'INR', '2024-08-01T10:00:00Z', NULL);


-- ============================================================
-- 5. ASSET TAGS
-- ============================================================
INSERT INTO asset_tags (asset_id, tag_id) VALUES
  -- Long Term
  ('demo_reliance',   'tag_demo_longterm'),
  ('demo_tcs',        'tag_demo_longterm'),
  ('demo_hdfcbank',   'tag_demo_longterm'),
  ('demo_aapl',       'tag_demo_longterm'),
  ('demo_msft',       'tag_demo_longterm'),
  ('demo_niftybees',  'tag_demo_longterm'),
  -- SIP
  ('demo_mf_parag_flexi', 'tag_demo_sip'),
  ('demo_mf_mirae_large', 'tag_demo_sip'),
  ('demo_mf_axis_small',  'tag_demo_sip'),
  ('demo_mf_hdfc_mid',    'tag_demo_sip'),
  ('demo_mf_sbi_debt',    'tag_demo_sip'),
  ('demo_niftybees',      'tag_demo_sip'),
  -- High Risk
  ('demo_nvda',       'tag_demo_high_risk'),
  ('demo_btc',        'tag_demo_high_risk'),
  ('demo_eth',        'tag_demo_high_risk'),
  ('demo_dixon',      'tag_demo_high_risk'),
  ('demo_tatamotors', 'tag_demo_high_risk'),
  -- Dividend
  ('demo_hdfcbank',   'tag_demo_dividend'),
  ('demo_tcs',        'tag_demo_dividend'),
  ('demo_icicibank',  'tag_demo_dividend'),
  ('demo_infy',       'tag_demo_dividend'),
  ('demo_wipro',      'tag_demo_dividend'),
  -- Retirement
  ('demo_ppf',        'tag_demo_retirement'),
  ('demo_epf',        'tag_demo_retirement'),
  ('demo_mf_parag_flexi', 'tag_demo_retirement'),
  -- Emergency Fund
  ('demo_cash_sbi',   'tag_demo_emergency'),
  ('demo_fd_sbi',     'tag_demo_emergency'),
  ('demo_mf_sbi_debt','tag_demo_emergency')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. TRANSACTIONS — realistic buy history across 2024-2026
-- ============================================================

-- Indian Stocks - accumulated over time with realistic prices
-- RELIANCE.NS (bought in batches)
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_001', 'demo_reliance', 'buy', 5,  2480.50, 12.40, '2024-02-05', 'First buy', '2024-02-05T10:00:00Z'),
  ('tx_demo_002', 'demo_reliance', 'buy', 3,  2550.00, 7.65,  '2024-06-12', 'Dip buy',   '2024-06-12T10:00:00Z'),
  ('tx_demo_003', 'demo_reliance', 'buy', 4,  2715.30, 10.86, '2024-11-20', 'Added more', '2024-11-20T10:00:00Z'),
  ('tx_demo_004', 'demo_reliance', 'buy', 3,  2620.00, 7.86,  '2025-03-10', 'Budget dip', '2025-03-10T10:00:00Z');

-- TCS.NS
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_005', 'demo_tcs', 'buy', 3,  3850.00, 11.55, '2024-02-08', NULL, '2024-02-08T10:00:00Z'),
  ('tx_demo_006', 'demo_tcs', 'buy', 2,  4020.50, 8.04,  '2024-08-22', NULL, '2024-08-22T10:00:00Z'),
  ('tx_demo_007', 'demo_tcs', 'buy', 2,  3920.00, 7.84,  '2025-01-15', NULL, '2025-01-15T10:00:00Z');

-- HDFCBANK.NS
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_008', 'demo_hdfcbank', 'buy', 8,  1520.00, 12.16, '2024-02-12', NULL, '2024-02-12T10:00:00Z'),
  ('tx_demo_009', 'demo_hdfcbank', 'buy', 5,  1585.40, 7.93,  '2024-07-18', NULL, '2024-07-18T10:00:00Z'),
  ('tx_demo_010', 'demo_hdfcbank', 'buy', 5,  1720.00, 8.60,  '2025-02-05', NULL, '2025-02-05T10:00:00Z');

-- INFY.NS
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_011', 'demo_infy', 'buy', 6,  1485.00, 8.91, '2024-03-18', NULL, '2024-03-18T10:00:00Z'),
  ('tx_demo_012', 'demo_infy', 'buy', 4,  1540.80, 6.16, '2024-10-05', NULL, '2024-10-05T10:00:00Z');

-- BHARTIARTL.NS
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_013', 'demo_bhartiartl', 'buy', 8,  1180.00, 9.44, '2024-04-15', NULL, '2024-04-15T10:00:00Z'),
  ('tx_demo_014', 'demo_bhartiartl', 'buy', 4,  1450.50, 5.80, '2024-12-10', NULL, '2024-12-10T10:00:00Z');

-- ICICIBANK.NS
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_015', 'demo_icicibank', 'buy', 10, 1085.00, 10.85, '2024-05-22', NULL, '2024-05-22T10:00:00Z'),
  ('tx_demo_016', 'demo_icicibank', 'buy', 5,  1220.40, 6.10,  '2025-01-08', NULL, '2025-01-08T10:00:00Z');

-- WIPRO.NS
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_017', 'demo_wipro', 'buy', 15, 480.50, 7.21, '2024-06-15', NULL, '2024-06-15T10:00:00Z'),
  ('tx_demo_018', 'demo_wipro', 'buy', 10, 520.00, 5.20, '2024-12-20', NULL, '2024-12-20T10:00:00Z');

-- TATAMOTORS.NS
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_019', 'demo_tatamotors', 'buy', 10, 980.00, 9.80, '2024-03-05', NULL, '2024-03-05T10:00:00Z'),
  ('tx_demo_020', 'demo_tatamotors', 'buy', 5,  720.50, 3.60, '2025-02-18', 'Dip buy after correction', '2025-02-18T10:00:00Z');

-- LTIM.NS
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_021', 'demo_ltim', 'buy', 3, 5520.00, 16.56, '2024-07-18', NULL, '2024-07-18T10:00:00Z');

-- DIXON.NS
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_022', 'demo_dixon', 'buy', 2, 11250.00, 22.50, '2024-09-05', 'High conviction', '2024-09-05T10:00:00Z');

-- US Stocks
-- AAPL
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_023', 'demo_aapl', 'buy', 3, 185.50, 0.50, '2024-02-12', NULL, '2024-02-12T10:00:00Z'),
  ('tx_demo_024', 'demo_aapl', 'buy', 2, 172.30, 0.35, '2024-08-05', 'Bought the dip', '2024-08-05T10:00:00Z');

-- MSFT
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_025', 'demo_msft', 'buy', 2, 405.00, 0.40, '2024-02-15', NULL, '2024-02-15T10:00:00Z'),
  ('tx_demo_026', 'demo_msft', 'buy', 1, 420.80, 0.20, '2024-09-10', NULL, '2024-09-10T10:00:00Z');

-- GOOGL
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_027', 'demo_googl', 'buy', 3, 155.20, 0.30, '2024-04-05', NULL, '2024-04-05T10:00:00Z'),
  ('tx_demo_028', 'demo_googl', 'buy', 2, 170.50, 0.20, '2024-11-12', NULL, '2024-11-12T10:00:00Z');

-- NVDA
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_029', 'demo_nvda', 'buy', 2, 875.00, 0.50, '2024-03-22', 'Pre-split', '2024-03-22T10:00:00Z'),
  ('tx_demo_030', 'demo_nvda', 'buy', 5, 120.50, 0.30, '2024-07-15', 'Post-split add', '2024-07-15T10:00:00Z'),
  ('tx_demo_031', 'demo_nvda', 'buy', 3, 135.20, 0.20, '2025-01-20', NULL, '2025-01-20T10:00:00Z');

-- AMZN
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_032', 'demo_amzn', 'buy', 3, 182.50, 0.30, '2024-06-05', NULL, '2024-06-05T10:00:00Z');

-- ETFs
-- NIFTYBEES.NS (SIP-style monthly buys)
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_033', 'demo_niftybees', 'buy', 40, 248.50, 9.94,  '2024-02-05', 'SIP', '2024-02-05T10:00:00Z'),
  ('tx_demo_034', 'demo_niftybees', 'buy', 38, 255.20, 9.70,  '2024-03-05', 'SIP', '2024-03-05T10:00:00Z'),
  ('tx_demo_035', 'demo_niftybees', 'buy', 37, 262.80, 9.72,  '2024-04-05', 'SIP', '2024-04-05T10:00:00Z'),
  ('tx_demo_036', 'demo_niftybees', 'buy', 36, 270.50, 9.74,  '2024-05-06', 'SIP', '2024-05-06T10:00:00Z'),
  ('tx_demo_037', 'demo_niftybees', 'buy', 35, 278.00, 9.73,  '2024-06-05', 'SIP', '2024-06-05T10:00:00Z'),
  ('tx_demo_038', 'demo_niftybees', 'buy', 34, 285.40, 9.70,  '2024-07-05', 'SIP', '2024-07-05T10:00:00Z'),
  ('tx_demo_039', 'demo_niftybees', 'buy', 34, 280.10, 9.52,  '2024-08-05', 'SIP', '2024-08-05T10:00:00Z'),
  ('tx_demo_040', 'demo_niftybees', 'buy', 33, 292.60, 9.66,  '2024-09-05', 'SIP', '2024-09-05T10:00:00Z'),
  ('tx_demo_041', 'demo_niftybees', 'buy', 32, 298.40, 9.55,  '2024-10-07', 'SIP', '2024-10-07T10:00:00Z'),
  ('tx_demo_042', 'demo_niftybees', 'buy', 33, 288.50, 9.52,  '2024-11-05', 'SIP', '2024-11-05T10:00:00Z'),
  ('tx_demo_043', 'demo_niftybees', 'buy', 32, 295.00, 9.44,  '2024-12-05', 'SIP', '2024-12-05T10:00:00Z'),
  ('tx_demo_044', 'demo_niftybees', 'buy', 31, 302.50, 9.38,  '2025-01-06', 'SIP', '2025-01-06T10:00:00Z'),
  ('tx_demo_045', 'demo_niftybees', 'buy', 32, 298.80, 9.56,  '2025-02-05', 'SIP', '2025-02-05T10:00:00Z'),
  ('tx_demo_046', 'demo_niftybees', 'buy', 33, 290.20, 9.58,  '2025-03-05', 'SIP', '2025-03-05T10:00:00Z');

-- GOLDBEES.NS
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_047', 'demo_goldbees', 'buy', 20, 55.80, 1.12, '2024-05-08', NULL, '2024-05-08T10:00:00Z'),
  ('tx_demo_048', 'demo_goldbees', 'buy', 20, 62.50, 1.25, '2024-10-15', NULL, '2024-10-15T10:00:00Z'),
  ('tx_demo_049', 'demo_goldbees', 'buy', 15, 68.20, 1.02, '2025-02-12', NULL, '2025-02-12T10:00:00Z');

-- VOO
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_050', 'demo_voo', 'buy', 1, 495.20, 0.25, '2024-03-05', NULL, '2024-03-05T10:00:00Z'),
  ('tx_demo_051', 'demo_voo', 'buy', 1, 510.80, 0.25, '2024-09-10', NULL, '2024-09-10T10:00:00Z');

-- Mutual Funds (SIP — monthly purchases at NAV)
-- Parag Parikh Flexi Cap
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_052', 'demo_mf_parag_flexi', 'buy', 110.25, 68.05, 0, '2024-02-07', 'SIP ₹7500', '2024-02-07T10:00:00Z'),
  ('tx_demo_053', 'demo_mf_parag_flexi', 'buy', 107.80, 69.57, 0, '2024-03-07', 'SIP ₹7500', '2024-03-07T10:00:00Z'),
  ('tx_demo_054', 'demo_mf_parag_flexi', 'buy', 105.42, 71.14, 0, '2024-04-07', 'SIP ₹7500', '2024-04-07T10:00:00Z'),
  ('tx_demo_055', 'demo_mf_parag_flexi', 'buy', 103.10, 72.75, 0, '2024-05-07', 'SIP ₹7500', '2024-05-07T10:00:00Z'),
  ('tx_demo_056', 'demo_mf_parag_flexi', 'buy', 101.49, 73.90, 0, '2024-06-07', 'SIP ₹7500', '2024-06-07T10:00:00Z'),
  ('tx_demo_057', 'demo_mf_parag_flexi', 'buy', 100.00, 75.00, 0, '2024-07-05', 'SIP ₹7500', '2024-07-05T10:00:00Z'),
  ('tx_demo_058', 'demo_mf_parag_flexi', 'buy', 98.68,  76.01, 0, '2024-08-07', 'SIP ₹7500', '2024-08-07T10:00:00Z'),
  ('tx_demo_059', 'demo_mf_parag_flexi', 'buy', 96.77,  77.50, 0, '2024-09-05', 'SIP ₹7500', '2024-09-05T10:00:00Z'),
  ('tx_demo_060', 'demo_mf_parag_flexi', 'buy', 97.40,  77.00, 0, '2024-10-07', 'SIP ₹7500', '2024-10-07T10:00:00Z'),
  ('tx_demo_061', 'demo_mf_parag_flexi', 'buy', 98.04,  76.50, 0, '2024-11-07', 'SIP ₹7500', '2024-11-07T10:00:00Z'),
  ('tx_demo_062', 'demo_mf_parag_flexi', 'buy', 96.15,  78.00, 0, '2024-12-05', 'SIP ₹7500', '2024-12-05T10:00:00Z'),
  ('tx_demo_063', 'demo_mf_parag_flexi', 'buy', 94.94,  79.00, 0, '2025-01-07', 'SIP ₹7500', '2025-01-07T10:00:00Z'),
  ('tx_demo_064', 'demo_mf_parag_flexi', 'buy', 96.15,  78.00, 0, '2025-02-07', 'SIP ₹7500', '2025-02-07T10:00:00Z'),
  ('tx_demo_065', 'demo_mf_parag_flexi', 'buy', 97.40,  77.00, 0, '2025-03-07', 'SIP ₹7500', '2025-03-07T10:00:00Z');

-- Mirae Asset Large Cap
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_066', 'demo_mf_mirae_large', 'buy', 50.25, 99.50,  0, '2024-02-10', 'SIP ₹5000', '2024-02-10T10:00:00Z'),
  ('tx_demo_067', 'demo_mf_mirae_large', 'buy', 49.02, 101.99, 0, '2024-04-10', 'SIP ₹5000', '2024-04-10T10:00:00Z'),
  ('tx_demo_068', 'demo_mf_mirae_large', 'buy', 47.85, 104.49, 0, '2024-06-10', 'SIP ₹5000', '2024-06-10T10:00:00Z'),
  ('tx_demo_069', 'demo_mf_mirae_large', 'buy', 46.73, 107.00, 0, '2024-08-12', 'SIP ₹5000', '2024-08-12T10:00:00Z'),
  ('tx_demo_070', 'demo_mf_mirae_large', 'buy', 45.66, 109.50, 0, '2024-10-10', 'SIP ₹5000', '2024-10-10T10:00:00Z'),
  ('tx_demo_071', 'demo_mf_mirae_large', 'buy', 44.64, 112.00, 0, '2024-12-10', 'SIP ₹5000', '2024-12-10T10:00:00Z'),
  ('tx_demo_072', 'demo_mf_mirae_large', 'buy', 45.25, 110.50, 0, '2025-02-10', 'SIP ₹5000', '2025-02-10T10:00:00Z');

-- Axis Small Cap
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_073', 'demo_mf_axis_small', 'buy', 280.11, 17.85, 0, '2024-03-07', 'SIP ₹5000', '2024-03-07T10:00:00Z'),
  ('tx_demo_074', 'demo_mf_axis_small', 'buy', 270.27, 18.50, 0, '2024-05-07', 'SIP ₹5000', '2024-05-07T10:00:00Z'),
  ('tx_demo_075', 'demo_mf_axis_small', 'buy', 260.42, 19.20, 0, '2024-07-07', 'SIP ₹5000', '2024-07-07T10:00:00Z'),
  ('tx_demo_076', 'demo_mf_axis_small', 'buy', 265.96, 18.80, 0, '2024-09-09', 'SIP ₹5000', '2024-09-09T10:00:00Z'),
  ('tx_demo_077', 'demo_mf_axis_small', 'buy', 271.74, 18.40, 0, '2024-11-07', 'SIP ₹5000', '2024-11-07T10:00:00Z'),
  ('tx_demo_078', 'demo_mf_axis_small', 'buy', 263.16, 19.00, 0, '2025-01-07', 'SIP ₹5000', '2025-01-07T10:00:00Z'),
  ('tx_demo_079', 'demo_mf_axis_small', 'buy', 268.82, 18.60, 0, '2025-03-07', 'SIP ₹5000', '2025-03-07T10:00:00Z');

-- HDFC Mid Cap Opportunities
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_080', 'demo_mf_hdfc_mid', 'buy', 78.74, 63.50, 0, '2024-04-07', 'SIP ₹5000', '2024-04-07T10:00:00Z'),
  ('tx_demo_081', 'demo_mf_hdfc_mid', 'buy', 76.34, 65.50, 0, '2024-06-07', 'SIP ₹5000', '2024-06-07T10:00:00Z'),
  ('tx_demo_082', 'demo_mf_hdfc_mid', 'buy', 74.07, 67.50, 0, '2024-08-07', 'SIP ₹5000', '2024-08-07T10:00:00Z'),
  ('tx_demo_083', 'demo_mf_hdfc_mid', 'buy', 72.46, 69.00, 0, '2024-10-07', 'SIP ₹5000', '2024-10-07T10:00:00Z'),
  ('tx_demo_084', 'demo_mf_hdfc_mid', 'buy', 73.53, 68.00, 0, '2024-12-09', 'SIP ₹5000', '2024-12-09T10:00:00Z'),
  ('tx_demo_085', 'demo_mf_hdfc_mid', 'buy', 71.43, 70.00, 0, '2025-02-07', 'SIP ₹5000', '2025-02-07T10:00:00Z');

-- SBI Medium Duration (debt - lumpsum)
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_086', 'demo_mf_sbi_debt', 'buy', 1100.00, 45.45, 0, '2024-02-15', 'Lumpsum ₹50K', '2024-02-15T10:00:00Z'),
  ('tx_demo_087', 'demo_mf_sbi_debt', 'buy', 520.83,  48.00, 0, '2024-09-20', 'Top up ₹25K',  '2024-09-20T10:00:00Z');

-- Crypto
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_088', 'demo_btc', 'buy', 0.0045, 62500.00, 2.50, '2024-03-10', 'Small allocation', '2024-03-10T10:00:00Z'),
  ('tx_demo_089', 'demo_btc', 'buy', 0.0035, 58200.00, 2.00, '2024-08-15', 'DCA',              '2024-08-15T10:00:00Z'),
  ('tx_demo_090', 'demo_eth', 'buy', 0.05,   3200.00,  1.50, '2024-03-12', NULL,                '2024-03-12T10:00:00Z'),
  ('tx_demo_091', 'demo_eth', 'buy', 0.04,   2800.00,  1.20, '2024-09-20', 'Added',             '2024-09-20T10:00:00Z');

-- Gold Physical (10g @ ₹6,200/g purchased at jeweller)
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_092', 'demo_gold_physical', 'buy', 10, 6200.00, 186.00, '2024-01-26', 'Republic Day purchase - 10g', '2024-01-26T10:00:00Z');

-- PPF (annual deposits)
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_093', 'demo_ppf', 'buy', 150000, 1, 0, '2024-04-05', 'FY24-25 deposit',  '2024-04-05T10:00:00Z'),
  ('tx_demo_094', 'demo_ppf', 'buy', 150000, 1, 0, '2025-04-03', 'FY25-26 deposit',  '2025-04-03T10:00:00Z');

-- EPF (monthly employer+employee)
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_095', 'demo_epf', 'buy', 15600, 1, 0, '2024-02-28', 'Feb contribution',  '2024-02-28T10:00:00Z'),
  ('tx_demo_096', 'demo_epf', 'buy', 15600, 1, 0, '2024-03-31', 'Mar contribution',  '2024-03-31T10:00:00Z'),
  ('tx_demo_097', 'demo_epf', 'buy', 15600, 1, 0, '2024-04-30', 'Apr contribution',  '2024-04-30T10:00:00Z'),
  ('tx_demo_098', 'demo_epf', 'buy', 15600, 1, 0, '2024-05-31', 'May contribution',  '2024-05-31T10:00:00Z'),
  ('tx_demo_099', 'demo_epf', 'buy', 15600, 1, 0, '2024-06-30', 'Jun contribution',  '2024-06-30T10:00:00Z'),
  ('tx_demo_100', 'demo_epf', 'buy', 15600, 1, 0, '2024-07-31', 'Jul contribution',  '2024-07-31T10:00:00Z'),
  ('tx_demo_101', 'demo_epf', 'buy', 15600, 1, 0, '2024-08-31', 'Aug contribution',  '2024-08-31T10:00:00Z'),
  ('tx_demo_102', 'demo_epf', 'buy', 15600, 1, 0, '2024-09-30', 'Sep contribution',  '2024-09-30T10:00:00Z'),
  ('tx_demo_103', 'demo_epf', 'buy', 15600, 1, 0, '2024-10-31', 'Oct contribution',  '2024-10-31T10:00:00Z'),
  ('tx_demo_104', 'demo_epf', 'buy', 15600, 1, 0, '2024-11-30', 'Nov contribution',  '2024-11-30T10:00:00Z'),
  ('tx_demo_105', 'demo_epf', 'buy', 15600, 1, 0, '2024-12-31', 'Dec contribution',  '2024-12-31T10:00:00Z'),
  ('tx_demo_106', 'demo_epf', 'buy', 15600, 1, 0, '2025-01-31', 'Jan contribution',  '2025-01-31T10:00:00Z'),
  ('tx_demo_107', 'demo_epf', 'buy', 15600, 1, 0, '2025-02-28', 'Feb contribution',  '2025-02-28T10:00:00Z'),
  ('tx_demo_108', 'demo_epf', 'buy', 15600, 1, 0, '2025-03-31', 'Mar contribution',  '2025-03-31T10:00:00Z');

-- Fixed Deposits
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_109', 'demo_fd_sbi',   'buy', 100000, 1, 0, '2024-06-05', '2-year FD', '2024-06-05T10:00:00Z'),
  ('tx_demo_110', 'demo_fd_kotak', 'buy', 75000,  1, 0, '2024-09-05', '2-year FD', '2024-09-05T10:00:00Z');

-- Cash Balances
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_111', 'demo_cash_sbi',     'buy', 85000,  1, 0, '2024-01-15', 'Opening balance',  '2024-01-15T10:00:00Z'),
  ('tx_demo_112', 'demo_cash_sbi',     'buy', 45000,  1, 0, '2025-03-31', 'Salary surplus',   '2025-03-31T10:00:00Z'),
  ('tx_demo_113', 'demo_cash_zerodha', 'buy', 12000,  1, 0, '2024-02-01', 'Trading fund',     '2024-02-01T10:00:00Z'),
  ('tx_demo_114', 'demo_cash_ind',     'buy', 150.00, 1, 0, '2024-02-10', 'US invest wallet', '2024-02-10T10:00:00Z');

-- Lended
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_115', 'demo_lend_friend', 'buy', 30000, 1, 0, '2024-08-05', 'Lent for medical emergency', '2024-08-05T10:00:00Z');

-- A sell transaction (partial book profit on NVDA)
INSERT INTO transactions (id, asset_id, type, quantity, price, fees, transaction_date, notes, created_at) VALUES
  ('tx_demo_116', 'demo_nvda', 'sell', 2, 140.50, 0.30, '2025-02-10', 'Partial profit booking', '2025-02-10T10:00:00Z');

-- Realized gain from NVDA sell
INSERT INTO realized_gains (id, asset_id, sell_transaction_id, buy_transaction_id, quantity, cost_basis, sale_proceeds, gain, gain_percent, realized_date, created_at) VALUES
  ('rg_demo_001', 'demo_nvda', 'tx_demo_116', 'tx_demo_029', 2, 1750.00, 281.00, -1469.00, -83.94, '2025-02-10', '2025-02-10T10:00:00Z');


-- ============================================================
-- 7. CASH FLOW CATEGORIES
-- ============================================================
INSERT INTO cash_flow_categories (id, user_id, name, type, tag, default_budget, sort_order, created_at) VALUES
  ('cfc_demo_salary',     'user_demo', 'Salary',             'income',  NULL,    150000, 1,  '2024-01-15T10:00:00Z'),
  ('cfc_demo_freelance',  'user_demo', 'Freelance',          'income',  NULL,    0,      2,  '2024-01-15T10:00:00Z'),
  ('cfc_demo_rent',       'user_demo', 'Rent',               'expense', 'need',  18000,  1,  '2024-01-15T10:00:00Z'),
  ('cfc_demo_groceries',  'user_demo', 'Groceries',          'expense', 'need',  8000,   2,  '2024-01-15T10:00:00Z'),
  ('cfc_demo_utilities',  'user_demo', 'Utilities & Bills',  'expense', 'need',  5000,   3,  '2024-01-15T10:00:00Z'),
  ('cfc_demo_transport',  'user_demo', 'Transport',          'expense', 'need',  4000,   4,  '2024-01-15T10:00:00Z'),
  ('cfc_demo_food_out',   'user_demo', 'Eating Out',         'expense', 'luxury',6000,   5,  '2024-01-15T10:00:00Z'),
  ('cfc_demo_shopping',   'user_demo', 'Shopping',           'expense', 'luxury',5000,   6,  '2024-01-15T10:00:00Z'),
  ('cfc_demo_subscriptions','user_demo','Subscriptions',     'expense', 'luxury',2000,   7,  '2024-01-15T10:00:00Z'),
  ('cfc_demo_health',     'user_demo', 'Health & Fitness',   'expense', 'need',  3000,   8,  '2024-01-15T10:00:00Z'),
  ('cfc_demo_travel',     'user_demo', 'Travel',             'expense', 'luxury',5000,   9,  '2024-01-15T10:00:00Z'),
  ('cfc_demo_insurance',  'user_demo', 'Insurance',          'expense', 'need',  3500,   10, '2024-01-15T10:00:00Z'),
  ('cfc_demo_misc',       'user_demo', 'Miscellaneous',      'expense', 'need',  3000,   11, '2024-01-15T10:00:00Z')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. PAYMENT METHODS
-- ============================================================
INSERT INTO payment_methods (id, user_id, name, type, is_active, created_at) VALUES
  ('pm_demo_sbi_debit',   'user_demo', 'SBI Debit Card',        'debit_card',    true, '2024-01-15T10:00:00Z'),
  ('pm_demo_hdfc_credit', 'user_demo', 'HDFC Credit Card',      'credit_card',   true, '2024-01-15T10:00:00Z'),
  ('pm_demo_gpay',        'user_demo', 'Google Pay (UPI)',       'upi',           true, '2024-01-15T10:00:00Z'),
  ('pm_demo_cash',        'user_demo', 'Cash',                   'cash',          true, '2024-01-15T10:00:00Z'),
  ('pm_demo_bank_tf',     'user_demo', 'Bank Transfer (NEFT)',   'bank_transfer', true, '2024-01-15T10:00:00Z')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. MONTHLY INCOME (recent months)
-- ============================================================
INSERT INTO monthly_income (id, user_id, entry_month, salary, other_income, opening_balance, expense_limit, investment_target, savings_target, created_at) VALUES
  ('mi_demo_202501', 'user_demo', '2025-01', 150000, 5000,  45000, 65000, 50000, 40000, '2025-01-01T10:00:00Z'),
  ('mi_demo_202502', 'user_demo', '2025-02', 150000, 0,     52000, 65000, 50000, 35000, '2025-02-01T10:00:00Z'),
  ('mi_demo_202503', 'user_demo', '2025-03', 150000, 12000, 48000, 65000, 55000, 42000, '2025-03-01T10:00:00Z'),
  ('mi_demo_202504', 'user_demo', '2025-04', 155000, 0,     55000, 65000, 55000, 35000, '2025-04-01T10:00:00Z')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. CASH FLOW ENTRIES (budgets for recent months)
-- ============================================================
INSERT INTO cash_flow_entries (id, category_id, entry_month, budget, actual, created_at) VALUES
  -- Jan 2025
  ('cfe_d_01', 'cfc_demo_rent',       '2025-01', 18000, 18000, '2025-01-01T10:00:00Z'),
  ('cfe_d_02', 'cfc_demo_groceries',  '2025-01', 8000,  7200,  '2025-01-01T10:00:00Z'),
  ('cfe_d_03', 'cfc_demo_utilities',  '2025-01', 5000,  4800,  '2025-01-01T10:00:00Z'),
  ('cfe_d_04', 'cfc_demo_transport',  '2025-01', 4000,  3500,  '2025-01-01T10:00:00Z'),
  ('cfe_d_05', 'cfc_demo_food_out',   '2025-01', 6000,  7500,  '2025-01-01T10:00:00Z'),
  ('cfe_d_06', 'cfc_demo_shopping',   '2025-01', 5000,  3200,  '2025-01-01T10:00:00Z'),
  ('cfe_d_07', 'cfc_demo_subscriptions','2025-01',2000, 1800,  '2025-01-01T10:00:00Z'),
  ('cfe_d_08', 'cfc_demo_health',     '2025-01', 3000,  2500,  '2025-01-01T10:00:00Z'),
  ('cfe_d_09', 'cfc_demo_insurance',  '2025-01', 3500,  3500,  '2025-01-01T10:00:00Z'),
  ('cfe_d_10', 'cfc_demo_misc',       '2025-01', 3000,  2200,  '2025-01-01T10:00:00Z'),
  -- Feb 2025
  ('cfe_d_11', 'cfc_demo_rent',       '2025-02', 18000, 18000, '2025-02-01T10:00:00Z'),
  ('cfe_d_12', 'cfc_demo_groceries',  '2025-02', 8000,  8500,  '2025-02-01T10:00:00Z'),
  ('cfe_d_13', 'cfc_demo_utilities',  '2025-02', 5000,  4200,  '2025-02-01T10:00:00Z'),
  ('cfe_d_14', 'cfc_demo_transport',  '2025-02', 4000,  4100,  '2025-02-01T10:00:00Z'),
  ('cfe_d_15', 'cfc_demo_food_out',   '2025-02', 6000,  5800,  '2025-02-01T10:00:00Z'),
  ('cfe_d_16', 'cfc_demo_shopping',   '2025-02', 5000,  8500,  '2025-02-01T10:00:00Z'),
  ('cfe_d_17', 'cfc_demo_subscriptions','2025-02',2000, 1800,  '2025-02-01T10:00:00Z'),
  ('cfe_d_18', 'cfc_demo_health',     '2025-02', 3000,  3200,  '2025-02-01T10:00:00Z'),
  ('cfe_d_19', 'cfc_demo_insurance',  '2025-02', 3500,  3500,  '2025-02-01T10:00:00Z'),
  ('cfe_d_20', 'cfc_demo_misc',       '2025-02', 3000,  1800,  '2025-02-01T10:00:00Z'),
  -- Mar 2025
  ('cfe_d_21', 'cfc_demo_rent',       '2025-03', 18000, 18000, '2025-03-01T10:00:00Z'),
  ('cfe_d_22', 'cfc_demo_groceries',  '2025-03', 8000,  7800,  '2025-03-01T10:00:00Z'),
  ('cfe_d_23', 'cfc_demo_utilities',  '2025-03', 5000,  5500,  '2025-03-01T10:00:00Z'),
  ('cfe_d_24', 'cfc_demo_transport',  '2025-03', 4000,  3800,  '2025-03-01T10:00:00Z'),
  ('cfe_d_25', 'cfc_demo_food_out',   '2025-03', 6000,  6200,  '2025-03-01T10:00:00Z'),
  ('cfe_d_26', 'cfc_demo_shopping',   '2025-03', 5000,  4500,  '2025-03-01T10:00:00Z'),
  ('cfe_d_27', 'cfc_demo_subscriptions','2025-03',2000, 2200,  '2025-03-01T10:00:00Z'),
  ('cfe_d_28', 'cfc_demo_health',     '2025-03', 3000,  2800,  '2025-03-01T10:00:00Z'),
  ('cfe_d_29', 'cfc_demo_travel',     '2025-03', 5000,  15000, '2025-03-01T10:00:00Z'),
  ('cfe_d_30', 'cfc_demo_insurance',  '2025-03', 3500,  3500,  '2025-03-01T10:00:00Z'),
  ('cfe_d_31', 'cfc_demo_misc',       '2025-03', 3000,  2800,  '2025-03-01T10:00:00Z')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 11. CASH FLOW SPENDS (detailed spending entries for March 2025)
-- ============================================================
INSERT INTO cash_flow_spends (id, user_id, category_id, payment_method_id, amount, description, spend_date, entry_month, type, created_at) VALUES
  ('sp_d_01', 'user_demo', 'cfc_demo_rent',       'pm_demo_bank_tf',     18000, 'March rent',                    '2025-03-01', '2025-03', 'expense', '2025-03-01T10:00:00Z'),
  ('sp_d_02', 'user_demo', 'cfc_demo_groceries',  'pm_demo_gpay',        2800,  'BigBasket weekly',              '2025-03-02', '2025-03', 'expense', '2025-03-02T10:00:00Z'),
  ('sp_d_03', 'user_demo', 'cfc_demo_groceries',  'pm_demo_gpay',        2500,  'Zepto + vegetables',            '2025-03-09', '2025-03', 'expense', '2025-03-09T10:00:00Z'),
  ('sp_d_04', 'user_demo', 'cfc_demo_groceries',  'pm_demo_cash',        2500,  'Local market',                  '2025-03-20', '2025-03', 'expense', '2025-03-20T10:00:00Z'),
  ('sp_d_05', 'user_demo', 'cfc_demo_utilities',  'pm_demo_gpay',        1800,  'Electricity bill',              '2025-03-05', '2025-03', 'expense', '2025-03-05T10:00:00Z'),
  ('sp_d_06', 'user_demo', 'cfc_demo_utilities',  'pm_demo_gpay',        800,   'WiFi bill',                     '2025-03-05', '2025-03', 'expense', '2025-03-05T10:00:00Z'),
  ('sp_d_07', 'user_demo', 'cfc_demo_utilities',  'pm_demo_gpay',        599,   'Airtel postpaid',               '2025-03-08', '2025-03', 'expense', '2025-03-08T10:00:00Z'),
  ('sp_d_08', 'user_demo', 'cfc_demo_utilities',  'pm_demo_gpay',        2301,  'Gas + water + maintenance',     '2025-03-10', '2025-03', 'expense', '2025-03-10T10:00:00Z'),
  ('sp_d_09', 'user_demo', 'cfc_demo_transport',  'pm_demo_gpay',        1200,  'Uber rides',                    '2025-03-07', '2025-03', 'expense', '2025-03-07T10:00:00Z'),
  ('sp_d_10', 'user_demo', 'cfc_demo_transport',  'pm_demo_gpay',        1500,  'Petrol',                        '2025-03-15', '2025-03', 'expense', '2025-03-15T10:00:00Z'),
  ('sp_d_11', 'user_demo', 'cfc_demo_transport',  'pm_demo_gpay',        1100,  'Metro pass',                    '2025-03-01', '2025-03', 'expense', '2025-03-01T10:00:00Z'),
  ('sp_d_12', 'user_demo', 'cfc_demo_food_out',   'pm_demo_hdfc_credit', 1800,  'Team dinner at Barbeque Nation','2025-03-08', '2025-03', 'expense', '2025-03-08T10:00:00Z'),
  ('sp_d_13', 'user_demo', 'cfc_demo_food_out',   'pm_demo_gpay',        850,   'Swiggy orders',                 '2025-03-12', '2025-03', 'expense', '2025-03-12T10:00:00Z'),
  ('sp_d_14', 'user_demo', 'cfc_demo_food_out',   'pm_demo_gpay',        1200,  'Coffee + lunch dates',          '2025-03-18', '2025-03', 'expense', '2025-03-18T10:00:00Z'),
  ('sp_d_15', 'user_demo', 'cfc_demo_food_out',   'pm_demo_hdfc_credit', 2350,  'Zomato + restaurant',           '2025-03-25', '2025-03', 'expense', '2025-03-25T10:00:00Z'),
  ('sp_d_16', 'user_demo', 'cfc_demo_shopping',   'pm_demo_hdfc_credit', 3500,  'Myntra sale - summer clothes',  '2025-03-15', '2025-03', 'expense', '2025-03-15T10:00:00Z'),
  ('sp_d_17', 'user_demo', 'cfc_demo_shopping',   'pm_demo_gpay',        1000,  'Amazon essentials',             '2025-03-22', '2025-03', 'expense', '2025-03-22T10:00:00Z'),
  ('sp_d_18', 'user_demo', 'cfc_demo_subscriptions','pm_demo_hdfc_credit',199,  'Netflix',                       '2025-03-03', '2025-03', 'expense', '2025-03-03T10:00:00Z'),
  ('sp_d_19', 'user_demo', 'cfc_demo_subscriptions','pm_demo_hdfc_credit',299,  'Spotify',                       '2025-03-05', '2025-03', 'expense', '2025-03-05T10:00:00Z'),
  ('sp_d_20', 'user_demo', 'cfc_demo_subscriptions','pm_demo_gpay',       1702, 'YouTube Premium + iCloud',      '2025-03-10', '2025-03', 'expense', '2025-03-10T10:00:00Z'),
  ('sp_d_21', 'user_demo', 'cfc_demo_health',     'pm_demo_gpay',        1500,  'Gym membership',                '2025-03-01', '2025-03', 'expense', '2025-03-01T10:00:00Z'),
  ('sp_d_22', 'user_demo', 'cfc_demo_health',     'pm_demo_gpay',        1300,  'Medicines + supplements',       '2025-03-14', '2025-03', 'expense', '2025-03-14T10:00:00Z'),
  ('sp_d_23', 'user_demo', 'cfc_demo_travel',     'pm_demo_hdfc_credit', 8500,  'Goa flight tickets',            '2025-03-10', '2025-03', 'expense', '2025-03-10T10:00:00Z'),
  ('sp_d_24', 'user_demo', 'cfc_demo_travel',     'pm_demo_hdfc_credit', 6500,  'Goa hotel + food',              '2025-03-22', '2025-03', 'expense', '2025-03-22T10:00:00Z'),
  ('sp_d_25', 'user_demo', 'cfc_demo_insurance',  'pm_demo_bank_tf',     3500,  'Term life insurance premium',   '2025-03-15', '2025-03', 'expense', '2025-03-15T10:00:00Z'),
  ('sp_d_26', 'user_demo', 'cfc_demo_misc',       'pm_demo_gpay',        1500,  'Birthday gift for friend',      '2025-03-20', '2025-03', 'expense', '2025-03-20T10:00:00Z'),
  ('sp_d_27', 'user_demo', 'cfc_demo_misc',       'pm_demo_cash',        1300,  'Misc cash expenses',            '2025-03-28', '2025-03', 'expense', '2025-03-28T10:00:00Z'),
  -- Income entries
  ('sp_d_28', 'user_demo', 'cfc_demo_salary',     'pm_demo_bank_tf',     150000,'March salary',                  '2025-03-01', '2025-03', 'income',  '2025-03-01T10:00:00Z'),
  ('sp_d_29', 'user_demo', 'cfc_demo_freelance',  'pm_demo_bank_tf',     12000, 'UI design project',             '2025-03-18', '2025-03', 'income',  '2025-03-18T10:00:00Z')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 12. NET WORTH TARGET
-- ============================================================
INSERT INTO net_worth_targets (id, user_id, name, starting_value, monthly_investment, yearly_return_rate, stretch_monthly_investment, start_date, end_date, is_active, created_at) VALUES
  ('nwt_demo_1', 'user_demo', '1 Crore by 35', 2500000, 55000, 12.5, 70000, '2025-04-01', '2032-08-15', true, '2025-01-15T10:00:00Z')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 13. FIRE SIMULATION
-- ============================================================
-- NOTE: Percentage fields use DECIMAL fractions (0.12 = 12%, not 12)
INSERT INTO fire_simulations (id, user_id, name, current_age, retirement_age, life_expectancy, current_savings, monthly_saving, annual_savings_increase, return_on_investment, capital_gain_tax, post_retirement_monthly_expense, inflation_rate, start_year, is_active, created_at) VALUES
  ('fire_demo_1', 'user_demo', 'Early Retirement @ 42', 28, 42, 85, 2500000, 55000, 0.10, 0.12, 0.10, 80000, 0.06, 2025, true, '2025-01-15T10:00:00Z')
ON CONFLICT DO NOTHING;

COMMIT;
