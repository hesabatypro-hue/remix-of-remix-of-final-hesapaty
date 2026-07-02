
-- Re-create triggers that are missing

-- Audit log triggers on main tables
CREATE OR REPLACE TRIGGER audit_transfers
  AFTER INSERT OR UPDATE OR DELETE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_branches
  AFTER INSERT OR UPDATE OR DELETE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_whatsapp_connections
  AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- Branch limit trigger
CREATE OR REPLACE TRIGGER enforce_branch_limit
  BEFORE INSERT ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.check_branch_limit();

-- User limit trigger
CREATE OR REPLACE TRIGGER enforce_user_limit
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.check_user_limit();

-- Notify on new transfer
CREATE OR REPLACE TRIGGER notify_on_new_transfer
  AFTER INSERT ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_transfer();

-- Update updated_at triggers
CREATE OR REPLACE TRIGGER update_transfers_updated_at
  BEFORE UPDATE ON public.transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_whatsapp_connections_updated_at
  BEFORE UPDATE ON public.whatsapp_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
