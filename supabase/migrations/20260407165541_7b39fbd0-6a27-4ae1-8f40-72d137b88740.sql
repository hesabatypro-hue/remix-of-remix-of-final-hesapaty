
UPDATE public.organizations
SET 
  plan_type = 'enterprise',
  max_branches = 100,
  max_users = 100,
  rate_limit_per_minute = 1000,
  subscription_status = 'active',
  subscription_ends_at = NOW() + INTERVAL '1 year',
  updated_at = NOW()
WHERE id = '3d07fc23-ef9d-47bc-981d-a9402b8e4939';
