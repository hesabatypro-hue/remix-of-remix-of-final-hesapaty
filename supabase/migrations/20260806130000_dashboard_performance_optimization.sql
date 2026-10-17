-- Migration: 20260806130000_dashboard_performance_optimization.sql
-- Description: Server-side aggregation RPC for dashboard statistics, avoiding loading thousands of rows to client.

CREATE OR REPLACE FUNCTION public.get_organization_dashboard_stats(
  _organization_id uuid,
  _branch_id uuid DEFAULT NULL,
  _start_time timestamptz DEFAULT NULL,
  _end_time timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _result jsonb;
  _active_branches int := 0;
  _total_branches int := 0;
  _total_revenue numeric := 0;
  _total_transfers int := 0;
  _period_revenue numeric := 0;
  _period_transfers int := 0;
  _pending_transfers int := 0;
  _confirmed_transfers int := 0;
BEGIN
  -- Strict multi-tenant verification
  IF NOT public.has_organization_role(auth.uid(), _organization_id, ARRAY['owner', 'admin', 'manager', 'cashier', 'accountant', 'viewer']) THEN
    RAISE EXCEPTION 'Access denied: caller does not belong to organization';
  END IF;

  -- Active and total branches count (excluding soft deleted)
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true)
  INTO _total_branches, _active_branches
  FROM branches
  WHERE organization_id = _organization_id AND is_deleted = false;

  -- All-time revenue and transfer count
  SELECT 
    COALESCE(SUM(amount), 0),
    COUNT(*)
  INTO _total_revenue, _total_transfers
  FROM transfers
  WHERE organization_id = _organization_id 
    AND is_deleted = false
    AND (_branch_id IS NULL OR branch_id = _branch_id);

  -- Period metrics
  SELECT
    COALESCE(SUM(amount), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE is_confirmed = false),
    COUNT(*) FILTER (WHERE is_confirmed = true)
  INTO _period_revenue, _period_transfers, _pending_transfers, _confirmed_transfers
  FROM transfers
  WHERE organization_id = _organization_id 
    AND is_deleted = false
    AND (_branch_id IS NULL OR branch_id = _branch_id)
    AND (_start_time IS NULL OR created_at >= _start_time)
    AND (_end_time IS NULL OR created_at <= _end_time);

  _result := jsonb_build_object(
    'totalRevenue', _total_revenue,
    'periodRevenue', _period_revenue,
    'activeBranches', _active_branches,
    'totalBranches', _total_branches,
    'totalTransfers', _total_transfers,
    'periodTransfers', _period_transfers,
    'pendingTransfers', _pending_transfers,
    'confirmedTransfers', _confirmed_transfers
  );

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_dashboard_stats(uuid, uuid, timestamptz, timestamptz) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_organization_dashboard_stats(uuid, uuid, timestamptz, timestamptz) FROM anon;
