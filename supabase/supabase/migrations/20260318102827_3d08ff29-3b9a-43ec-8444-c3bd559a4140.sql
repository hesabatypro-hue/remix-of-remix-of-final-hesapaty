-- Re-create missing triggers safely (idempotent)

-- 1) Prevent editing confirmed transfers
DROP TRIGGER IF EXISTS prevent_confirmed_transfer_edit_trigger ON public.transfers;
CREATE TRIGGER prevent_confirmed_transfer_edit_trigger
BEFORE UPDATE ON public.transfers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_confirmed_transfer_edit();

-- 2) Validate transfer amount on create/update
DROP TRIGGER IF EXISTS validate_transfer_amount_trigger ON public.transfers;
CREATE TRIGGER validate_transfer_amount_trigger
BEFORE INSERT OR UPDATE ON public.transfers
FOR EACH ROW
EXECUTE FUNCTION public.validate_transfer_amount();

-- 3) Enforce branch plan limits
DROP TRIGGER IF EXISTS check_branch_limit_trigger ON public.branches;
CREATE TRIGGER check_branch_limit_trigger
BEFORE INSERT ON public.branches
FOR EACH ROW
EXECUTE FUNCTION public.check_branch_limit();

-- 4) Audit logs for critical business tables
DROP TRIGGER IF EXISTS audit_logs_transfers_trigger ON public.transfers;
CREATE TRIGGER audit_logs_transfers_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transfers
FOR EACH ROW
EXECUTE FUNCTION public.audit_log_trigger();

DROP TRIGGER IF EXISTS audit_logs_branches_trigger ON public.branches;
CREATE TRIGGER audit_logs_branches_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.branches
FOR EACH ROW
EXECUTE FUNCTION public.audit_log_trigger();

DROP TRIGGER IF EXISTS audit_logs_whatsapp_connections_trigger ON public.whatsapp_connections;
CREATE TRIGGER audit_logs_whatsapp_connections_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_connections
FOR EACH ROW
EXECUTE FUNCTION public.audit_log_trigger();

DROP TRIGGER IF EXISTS audit_logs_user_roles_trigger ON public.user_roles;
CREATE TRIGGER audit_logs_user_roles_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.audit_log_trigger();