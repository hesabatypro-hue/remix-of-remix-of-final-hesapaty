-- ============================================================================
-- Hesapaty PRO — Automated Database Security & Integrity Evaluation Suite
-- Self-evaluating PostgreSQL script: Returns PASS / FAIL with clear diagnostics.
-- Safe to run in Supabase SQL Editor or via psql (Read-Only Diagnostics)
-- ============================================================================

WITH
-- 1. Check mark_platform_invoice_paid EXECUTE privileges
check_invoice_privs AS (
    SELECT 
        'CHK-01-INVOICE-EXEC-REVOKE' AS check_id,
        'mark_platform_invoice_paid EXECUTE Revoked from Public/Anon/Authenticated' AS check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Zero grants to PUBLIC, anon, or authenticated' AS expected,
        'Found ' || COUNT(*) || ' unauthorized grants: ' || COALESCE(string_agg(grantee || ' (' || privilege_type || ')', ', '), 'none') AS actual,
        'REVOKE ALL ON FUNCTION public.mark_platform_invoice_paid(uuid, text, text) FROM PUBLIC, anon, authenticated;' AS remediation
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
      AND routine_name = 'mark_platform_invoice_paid'
      AND grantee IN ('PUBLIC', 'anon', 'authenticated')
),

-- 2. Check mark_platform_invoice_paid has EXECUTE for service_role
check_invoice_service_role AS (
    SELECT 
        'CHK-02-INVOICE-SERVICE-ROLE' AS check_id,
        'mark_platform_invoice_paid Granted to service_role' AS check_name,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM information_schema.routine_privileges
                WHERE routine_schema = 'public'
                  AND routine_name = 'mark_platform_invoice_paid'
                  AND grantee = 'service_role'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'service_role has EXECUTE' AS expected,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM information_schema.routine_privileges
                WHERE routine_schema = 'public'
                  AND routine_name = 'mark_platform_invoice_paid'
                  AND grantee = 'service_role'
            ) THEN 'service_role has EXECUTE privilege'
            ELSE 'service_role is missing EXECUTE privilege'
        END AS actual,
        'GRANT EXECUTE ON FUNCTION public.mark_platform_invoice_paid(uuid, text, text) TO service_role;' AS remediation
),

-- 3. Check platform_invoices table has NO direct UPDATE/INSERT policy for authenticated users
check_invoice_rls_write AS (
    SELECT 
        'CHK-03-INVOICE-RLS-WRITE-PROTECTION' AS check_id,
        'platform_invoices Disallows Client-Side UPDATE/INSERT' AS check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Zero write policies for authenticated on platform_invoices' AS expected,
        'Found ' || COUNT(*) || ' client write policies: ' || COALESCE(string_agg(policyname || ' (' || cmd || ')', ', '), 'none') AS actual,
        'DROP POLICY <policy_name> ON public.platform_invoices;' AS remediation
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_invoices'
      AND cmd IN ('UPDATE', 'INSERT', 'ALL')
      AND ('authenticated' = ANY(roles) OR 'public' = ANY(roles))
),

-- 4. Check SECURITY DEFINER and search_path on critical security functions
check_sec_definer_search_path AS (
    SELECT 
        'CHK-04-SECURITY-DEFINER-SEARCH-PATH' AS check_id,
        'Critical Functions Have SECURITY DEFINER and Sanitized search_path' AS check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'All critical functions enforce search_path=public, pg_temp' AS expected,
        CASE 
            WHEN COUNT(*) = 0 THEN 'All critical functions compliant'
            ELSE 'Non-compliant functions: ' || string_agg(proname, ', ')
        END AS actual,
        'ALTER FUNCTION public.<name> SET search_path = public, pg_temp;' AS remediation
    FROM pg_proc
    WHERE proname IN (
        'mark_platform_invoice_paid',
        'soft_delete_all_transfers',
        'check_branch_limit',
        'can_add_branch',
        'prevent_confirmed_transfer_edit',
        'get_organization_dashboard_stats'
    )
    AND (
        prosecdef IS NOT TRUE 
        OR proconfig IS NULL 
        OR NOT (proconfig @> ARRAY['search_path=public, pg_temp'])
    )
),

-- 5. Check RLS enabled on all sensitive financial tables
check_rls_enabled AS (
    SELECT 
        'CHK-05-RLS-ENABLED-SENSITIVE-TABLES' AS check_id,
        'Row Level Security Enabled on Financial & Tenant Tables' AS check_name,
        CASE 
            WHEN COUNT(*) = 0 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'RLS enabled on organizations, platform_invoices, transfers, branches, whatsapp_messages, ledger_entries' AS expected,
        CASE 
            WHEN COUNT(*) = 0 THEN 'All sensitive tables have RLS enabled'
            ELSE 'Tables with RLS DISABLED: ' || string_agg(tablename, ', ')
        END AS actual,
        'ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;' AS remediation
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('organizations', 'platform_invoices', 'transfers', 'branches', 'whatsapp_messages', 'ledger_entries')
      AND rowsecurity IS NOT TRUE
),

-- 6. Check unique constraint on whatsapp_messages(message_id) for Idempotency
check_whatsapp_idempotency AS (
    SELECT 
        'CHK-06-WHATSAPP-IDEMPOTENCY' AS check_id,
        'UNIQUE constraint on whatsapp_messages(message_id)' AS check_name,
        CASE 
            WHEN EXISTS (
                SELECT 1 
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                WHERE tc.table_schema = 'public' 
                  AND tc.table_name = 'whatsapp_messages' 
                  AND tc.constraint_type = 'UNIQUE'
                  AND kcu.column_name = 'message_id'
            ) OR EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'whatsapp_messages'
                  AND indexdef LIKE '%UNIQUE%message_id%'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'UNIQUE constraint/index exists on message_id' AS expected,
        CASE 
            WHEN EXISTS (
                SELECT 1 
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                WHERE tc.table_schema = 'public' 
                  AND tc.table_name = 'whatsapp_messages' 
                  AND tc.constraint_type = 'UNIQUE'
                  AND kcu.column_name = 'message_id'
            ) OR EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename = 'whatsapp_messages'
                  AND indexdef LIKE '%UNIQUE%message_id%'
            ) THEN 'UNIQUE constraint confirmed on message_id'
            ELSE 'Missing UNIQUE constraint on message_id'
        END AS actual,
        'ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_message_id_key UNIQUE (message_id);' AS remediation
),

-- 7. Check immutable ledger triggers
check_ledger_immutable AS (
    SELECT 
        'CHK-07-LEDGER-IMMUTABLE-TRIGGERS' AS check_id,
        'Immutable Ledger Triggers Prevent UPDATE and DELETE' AS check_name,
        CASE 
            WHEN (
                SELECT COUNT(*) FROM pg_trigger t
                JOIN pg_class c ON t.tgrelid = c.oid
                WHERE c.relname = 'ledger_entries'
                  AND t.tgname IN ('ledger_no_update', 'ledger_no_delete')
            ) >= 2 THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'ledger_no_update and ledger_no_delete triggers active' AS expected,
        (SELECT COUNT(*) FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE c.relname = 'ledger_entries' AND t.tgname IN ('ledger_no_update', 'ledger_no_delete')) || ' triggers found' AS actual,
        'CREATE TRIGGER ledger_no_update BEFORE UPDATE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.ledger_block_mutation();' AS remediation
),

-- 8. Check get_organization_dashboard_stats function presence
check_dashboard_stats_rpc AS (
    SELECT 
        'CHK-08-DASHBOARD-STATS-RPC' AS check_id,
        'get_organization_dashboard_stats Aggregation RPC Exists' AS check_name,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM pg_proc WHERE proname = 'get_organization_dashboard_stats'
            ) THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        'Function get_organization_dashboard_stats exists' AS expected,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM pg_proc WHERE proname = 'get_organization_dashboard_stats'
            ) THEN 'Function present in public schema'
            ELSE 'Function missing'
        END AS actual,
        'Apply migration 20260806130000_dashboard_performance_optimization.sql' AS remediation
)

-- Combined Evaluation Output
SELECT check_id, check_name, status, expected, actual, remediation FROM check_invoice_privs
UNION ALL
SELECT check_id, check_name, status, expected, actual, remediation FROM check_invoice_service_role
UNION ALL
SELECT check_id, check_name, status, expected, actual, remediation FROM check_invoice_rls_write
UNION ALL
SELECT check_id, check_name, status, expected, actual, remediation FROM check_sec_definer_search_path
UNION ALL
SELECT check_id, check_name, status, expected, actual, remediation FROM check_rls_enabled
UNION ALL
SELECT check_id, check_name, status, expected, actual, remediation FROM check_whatsapp_idempotency
UNION ALL
SELECT check_id, check_name, status, expected, actual, remediation FROM check_ledger_immutable
UNION ALL
SELECT check_id, check_name, status, expected, actual, remediation FROM check_dashboard_stats_rpc
ORDER BY check_id;
