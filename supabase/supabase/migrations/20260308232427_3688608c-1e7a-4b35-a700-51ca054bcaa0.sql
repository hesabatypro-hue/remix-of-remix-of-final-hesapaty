
-- Drop existing duplicate triggers and re-create remaining ones
DROP TRIGGER IF EXISTS update_transfers_updated_at ON public.transfers;
DROP TRIGGER IF EXISTS update_branches_updated_at ON public.branches;
DROP TRIGGER IF EXISTS update_organizations_updated_at ON public.organizations;
DROP TRIGGER IF EXISTS update_whatsapp_connections_updated_at ON public.whatsapp_connections;

CREATE TRIGGER update_transfers_updated_at
  BEFORE UPDATE ON public.transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_connections_updated_at
  BEFORE UPDATE ON public.whatsapp_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
