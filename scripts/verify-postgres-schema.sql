-- ============================================================================
-- Hesapaty PRO — Database Schema, Permissions & RLS Verification Script
-- Run this script in the Supabase SQL Editor or via psql on your Staging database
-- ============================================================================

-- 1. Check SECURITY DEFINER and search_path on critical functions
SELECT 
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS is_security_definer,
    p.proconfig AS function_settings,
    r.rolname AS function_owner
FROM pg_proc p
JOIN pg_roles r ON p.proowner = r.oid
WHERE p.proname IN (
    'mark_platform_invoice_paid',
    'soft_delete_all_transfers',
    'check_branch_limit',
    'can_add_branch',
    'get_organization_limits',
    'prevent_confirmed_transfer_edit',
    'get_organization_dashboard_stats',
    'post_ledger_entry',
    'verify_ledger_chain'
)
ORDER BY p.proname;

-- 2. Check function EXECUTE privileges (Verify mark_platform_invoice_paid has NO execute for anon/authenticated)
SELECT 
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('mark_platform_invoice_paid', 'soft_delete_all_transfers', 'get_organization_dashboard_stats')
ORDER BY routine_name, grantee;

-- 3. Verify Row-Level Security (RLS) status on sensitive financial tables
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('platform_invoices', 'transfers', 'branches', 'whatsapp_messages', 'ledger_entries', 'organizations')
ORDER BY tablename;

-- 4. Check active RLS Policies on platform_invoices and transfers
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('platform_invoices', 'transfers', 'branches', 'ledger_entries')
ORDER BY tablename, policyname;

-- 5. Verify UNIQUE constraints protecting idempotency (message_id and ledger hash chain)
SELECT 
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('whatsapp_messages', 'ledger_entries')
  AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.table_name, tc.constraint_name;
