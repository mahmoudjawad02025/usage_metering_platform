INSERT INTO plans (id, account_id, scope, name, monthly_allowance, max_per_request, is_predefined)
VALUES
  ('a0000000-0000-4000-8000-000000000001', NULL, 'account', 'Starter', 10000, 100, TRUE),
  ('a0000000-0000-4000-8000-000000000002', NULL, 'account', 'Pro', 100000, 1000, TRUE),
  ('b0000000-0000-4000-8000-000000000001', NULL, 'user', 'Basic', 1000, 20, TRUE),
  ('b0000000-0000-4000-8000-000000000002', NULL, 'user', 'Premium', 10000, 200, TRUE)
ON CONFLICT (id) DO NOTHING;