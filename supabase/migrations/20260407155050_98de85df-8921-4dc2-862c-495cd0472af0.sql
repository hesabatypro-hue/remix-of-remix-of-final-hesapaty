-- Enum types
CREATE TYPE public.whatsapp_connection_status AS ENUM ('connected', 'pending', 'disconnected');
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'manager', 'viewer');

-- Utility function
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'starter', 'professional', 'enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing')),
  subscription_ends_at TIMESTAMPTZ,
  max_branches INTEGER NOT NULL DEFAULT 2,
  max_users INTEGER NOT NULL DEFAULT 3,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  branch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Branches
CREATE TABLE public.branches (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  whatsapp_chat_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Transfers
CREATE TABLE public.transfers (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  whatsapp_connection_id UUID,
  amount NUMERIC(15,2) NOT NULL,
  transfer_date DATE DEFAULT CURRENT_DATE NOT NULL,
  sender_name TEXT,
  sender_phone TEXT,
  image_url TEXT,
  image_hash TEXT,
  extracted_data JSONB,
  is_confirmed BOOLEAN DEFAULT false NOT NULL,
  confirmed_at TIMESTAMPTZ,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  ai_confidence INTEGER DEFAULT NULL,
  fraud_score INTEGER DEFAULT 0,
  fraud_flags JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  transaction_id TEXT,
  client_memo TEXT,
  is_manual_memo BOOLEAN NOT NULL DEFAULT false,
  receiver_account TEXT,
  sender_account TEXT,
  bank_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- WhatsApp Connections
CREATE TABLE public.whatsapp_connections (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  whatsapp_business_id TEXT,
  access_token TEXT,
  webhook_verify_token TEXT,
  status public.whatsapp_connection_status DEFAULT 'pending' NOT NULL,
  last_sync_at TIMESTAMPTZ,
  verification_code TEXT,
  verification_expires_at TIMESTAMPTZ,
  connection_type TEXT DEFAULT 'meta' NOT NULL,
  green_api_instance_id TEXT,
  green_api_token TEXT,
  meta_phone_number_id TEXT,
  monitored_chat_id TEXT,
  monitored_chat_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT check_connection_type CHECK (connection_type = ANY (ARRAY['meta', 'green_api', 'manual'])),
  CONSTRAINT whatsapp_connections_branch_id_key UNIQUE (branch_id),
  CONSTRAINT whatsapp_connections_phone_number_key UNIQUE (phone_number)
);
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

-- WhatsApp Messages
CREATE TABLE public.whatsapp_messages (
  id UUID DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id UUID,
  whatsapp_connection_id UUID NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL UNIQUE,
  from_number TEXT NOT NULL,
  message_type TEXT NOT NULL,
  content TEXT,
  media_url TEXT,
  processed BOOLEAN DEFAULT false NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- User Preferences
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  email_alerts_enabled BOOLEAN NOT NULL DEFAULT true,
  dark_mode BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Failed Jobs
CREATE TABLE public.failed_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pending',
  next_retry_at TIMESTAMPTZ DEFAULT now(),
  organization_id UUID REFERENCES public.organizations(id),
  whatsapp_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  last_attempted_at TIMESTAMPTZ
);
ALTER TABLE public.failed_jobs ENABLE ROW LEVEL SECURITY;

-- System Logs
CREATE TABLE public.system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL DEFAULT 'error',
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  organization_id UUID,
  connection_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Audit Logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Webhook Rate Limits
CREATE TABLE public.webhook_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL UNIQUE,
  organization_id UUID REFERENCES public.organizations(id),
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 1
);
ALTER TABLE public.webhook_rate_limits ENABLE ROW LEVEL SECURITY;

-- FK for transfers -> whatsapp_connections
ALTER TABLE public.transfers ADD CONSTRAINT transfers_whatsapp_connection_id_fkey FOREIGN KEY (whatsapp_connection_id) REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;
-- FK for user_roles -> branches
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;

-- ============ INDEXES ============
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_organization_id ON public.user_roles(organization_id);
CREATE INDEX idx_user_roles_branch_id ON public.user_roles(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX idx_user_roles_user_org ON public.user_roles(user_id, organization_id);
CREATE INDEX idx_branches_organization_id ON public.branches(organization_id);
CREATE INDEX idx_branches_not_deleted ON public.branches(organization_id) WHERE is_deleted = false;
CREATE INDEX idx_branches_whatsapp_chat_id ON public.branches(whatsapp_chat_id) WHERE whatsapp_chat_id IS NOT NULL;
CREATE INDEX idx_transfers_organization_id ON public.transfers(organization_id);
CREATE INDEX idx_transfers_org_created ON public.transfers(organization_id, created_at DESC);
CREATE INDEX idx_transfers_org_confirmed ON public.transfers(organization_id, is_confirmed);
CREATE INDEX idx_transfers_branch_date ON public.transfers(branch_id, transfer_date);
CREATE INDEX idx_transfers_not_deleted ON public.transfers(organization_id, created_at DESC) WHERE is_deleted = false;
CREATE INDEX idx_transfers_image_hash ON public.transfers(image_hash) WHERE image_hash IS NOT NULL AND is_deleted = false;
CREATE INDEX idx_transfers_needs_review ON public.transfers(needs_review) WHERE needs_review = true AND is_deleted = false;
CREATE INDEX idx_transfers_transaction_id_unique ON public.transfers(organization_id, transaction_id) WHERE transaction_id IS NOT NULL AND is_deleted = false;
CREATE INDEX idx_transfers_transaction_id ON public.transfers(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX idx_transfers_receiver_account ON public.transfers(receiver_account) WHERE receiver_account IS NOT NULL;
CREATE INDEX idx_whatsapp_connections_organization_id ON public.whatsapp_connections(organization_id);
CREATE INDEX idx_whatsapp_connections_meta_phone_number_id ON public.whatsapp_connections(meta_phone_number_id) WHERE meta_phone_number_id IS NOT NULL;
CREATE INDEX idx_whatsapp_connections_green_instance ON public.whatsapp_connections(green_api_instance_id) WHERE green_api_instance_id IS NOT NULL;
CREATE INDEX idx_whatsapp_messages_organization_id ON public.whatsapp_messages(organization_id);
CREATE INDEX idx_whatsapp_messages_org_created ON public.whatsapp_messages(organization_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_user_org_read ON public.notifications(user_id, organization_id, is_read);
CREATE INDEX idx_failed_jobs_retry ON public.failed_jobs(status, next_retry_at) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_failed_jobs_org ON public.failed_jobs(organization_id, status);
CREATE INDEX idx_system_logs_org_created ON public.system_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_org_created ON public.audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);

-- ============ SECURITY DEFINER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.get_user_organization_ids(_user_id UUID)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.user_roles WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.has_organization_role(_user_id UUID, _organization_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND organization_id = _organization_id AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.is_organization_member(_user_id UUID, _organization_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND organization_id = _organization_id);
$$;

CREATE OR REPLACE FUNCTION public.get_user_branch_id(_user_id UUID, _organization_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.user_roles WHERE user_id = _user_id AND organization_id = _organization_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_has_full_access(_organization_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND organization_id = _organization_id AND (branch_id IS NULL OR role = ANY(ARRAY['owner'::app_role, 'admin'::app_role])));
$$;

CREATE OR REPLACE FUNCTION public.find_branch_by_chat_id(_organization_id UUID, _chat_id TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.branches WHERE organization_id = _organization_id AND whatsapp_chat_id = _chat_id AND is_deleted = false AND is_active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_add_branch(_organization_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT COUNT(*)::int FROM public.branches WHERE organization_id = _organization_id) < (SELECT max_branches FROM public.organizations WHERE id = _organization_id);
$$;

CREATE OR REPLACE FUNCTION public.can_add_user(_organization_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT COUNT(*)::int FROM public.user_roles WHERE organization_id = _organization_id) < (SELECT max_users FROM public.organizations WHERE id = _organization_id);
$$;

CREATE OR REPLACE FUNCTION public.get_organization_limits(_organization_id UUID)
RETURNS TABLE(max_branches int, current_branches bigint, max_users int, current_users bigint, plan_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.max_branches, (SELECT COUNT(*) FROM public.branches WHERE organization_id = _organization_id), o.max_users, (SELECT COUNT(*) FROM public.user_roles WHERE organization_id = _organization_id), o.plan_type FROM public.organizations o WHERE o.id = _organization_id;
$$;

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(_name text, _slug text)
RETURNS public.organizations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  INSERT INTO public.organizations (name, slug, plan_type, subscription_status, max_branches, max_users) VALUES (_name, _slug, 'free', 'active', 2, 3) RETURNING * INTO _org;
  INSERT INTO public.user_roles (user_id, organization_id, role) VALUES (auth.uid(), _org.id, 'owner');
  RETURN _org;
END;
$$;
REVOKE ALL ON FUNCTION public.create_organization_with_owner(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.soft_delete_all_transfers(_organization_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count integer;
BEGIN
  IF NOT is_organization_member(auth.uid(), _organization_id) THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  UPDATE public.transfers SET is_deleted = true, deleted_at = now(), deleted_by = auth.uid(), updated_at = now() WHERE organization_id = _organization_id AND is_deleted = false;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- ============ TRIGGER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.check_branch_limit() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_count int; max_allowed int;
BEGIN
  SELECT COUNT(*)::int INTO current_count FROM public.branches WHERE organization_id = NEW.organization_id;
  SELECT max_branches INTO max_allowed FROM public.organizations WHERE id = NEW.organization_id;
  IF current_count >= max_allowed THEN RAISE EXCEPTION 'BRANCH_LIMIT_EXCEEDED'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_user_limit() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_count int; max_allowed int;
BEGIN
  SELECT COUNT(*)::int INTO current_count FROM public.user_roles WHERE organization_id = NEW.organization_id;
  SELECT max_users INTO max_allowed FROM public.organizations WHERE id = NEW.organization_id;
  IF current_count >= max_allowed THEN RAISE EXCEPTION 'USER_LIMIT_EXCEEDED'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_confirmed_transfer_edit() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.is_confirmed = true AND NOT (NEW.is_deleted = true AND OLD.is_deleted = false) THEN RAISE EXCEPTION 'CONFIRMED_TRANSFER'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_transfer_amount() RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.amount <= 0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_transfer() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _user_record RECORD; _branch_name TEXT; _amount_text TEXT;
BEGIN
  IF NEW.whatsapp_connection_id IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO _branch_name FROM public.branches WHERE id = NEW.branch_id;
  _amount_text := TO_CHAR(NEW.amount, 'FM999,999,999.00');
  FOR _user_record IN SELECT user_id FROM public.user_roles WHERE organization_id = NEW.organization_id LOOP
    INSERT INTO public.notifications (user_id, organization_id, title, message, type, link) VALUES (_user_record.user_id, NEW.organization_id, 'تحويل جديد عبر WhatsApp', 'تم استلام تحويل بقيمة ' || _amount_text || ' ر.س في فرع ' || COALESCE(_branch_name, 'غير محدد'), 'transfer', '/transfers');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_log_trigger() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _org_id uuid; _action text; _record_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _action := 'delete'; _org_id := OLD.organization_id; _record_id := OLD.id::text;
    INSERT INTO public.audit_logs (organization_id, action, table_name, record_id, old_data) VALUES (_org_id, _action, TG_TABLE_NAME, _record_id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'update'; _org_id := NEW.organization_id; _record_id := NEW.id::text;
    INSERT INTO public.audit_logs (organization_id, action, table_name, record_id, old_data, new_data) VALUES (_org_id, _action, TG_TABLE_NAME, _record_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    _action := 'create'; _org_id := NEW.organization_id; _record_id := NEW.id::text;
    INSERT INTO public.audit_logs (organization_id, action, table_name, record_id, new_data) VALUES (_org_id, _action, TG_TABLE_NAME, _record_id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  RETURN NEW;
END;
$$;

-- ============ TRIGGERS ============
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transfers_updated_at BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_whatsapp_connections_updated_at BEFORE UPDATE ON public.whatsapp_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER enforce_branch_limit BEFORE INSERT ON public.branches FOR EACH ROW EXECUTE FUNCTION public.check_branch_limit();
CREATE TRIGGER enforce_user_limit BEFORE INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.check_user_limit();
CREATE TRIGGER prevent_confirmed_transfer_edit_trigger BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.prevent_confirmed_transfer_edit();
CREATE TRIGGER validate_transfer_amount_trigger BEFORE INSERT OR UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.validate_transfer_amount();
CREATE TRIGGER notify_on_new_transfer AFTER INSERT ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.notify_new_transfer();
CREATE TRIGGER audit_transfers AFTER INSERT OR UPDATE OR DELETE ON public.transfers FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_branches AFTER INSERT OR UPDATE OR DELETE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER audit_whatsapp_connections AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_connections FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- Organizations
CREATE POLICY "Users can view organizations they belong to" ON public.organizations FOR SELECT TO authenticated USING (id IN (SELECT public.get_user_organization_ids(auth.uid())));
CREATE POLICY "Owners and admins can update their organizations" ON public.organizations FOR UPDATE TO authenticated USING (public.has_organization_role(auth.uid(), id, ARRAY['owner', 'admin']::public.app_role[]));
CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- User Roles
CREATE POLICY "Users can view roles in their organizations" ON public.user_roles FOR SELECT TO authenticated USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));
CREATE POLICY "Owners and admins can manage roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::public.app_role[]));
CREATE POLICY "Owners and admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::public.app_role[]));
CREATE POLICY "Owners can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner']::public.app_role[]));

-- Branches
CREATE POLICY "Users can view their organization branches" ON public.branches FOR SELECT TO authenticated USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())) AND is_deleted = false);
CREATE POLICY "Admins can create branches" ON public.branches FOR INSERT TO authenticated WITH CHECK (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin', 'manager']::public.app_role[]));
CREATE POLICY "Admins can update branches" ON public.branches FOR UPDATE TO authenticated USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin', 'manager']::public.app_role[]));
CREATE POLICY "Owners and admins can delete branches" ON public.branches FOR DELETE TO authenticated USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::public.app_role[]));

-- Transfers
CREATE POLICY "Users can view their organization transfers" ON public.transfers FOR SELECT TO authenticated USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())) AND is_deleted = false);
CREATE POLICY "Members can create transfers" ON public.transfers FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update transfers" ON public.transfers FOR UPDATE TO authenticated USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))) WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));
CREATE POLICY "Admins can delete transfers" ON public.transfers FOR DELETE TO authenticated USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::public.app_role[]));

-- WhatsApp Connections
CREATE POLICY "Users can view their organization whatsapp connections" ON public.whatsapp_connections FOR SELECT TO authenticated USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));
CREATE POLICY "Admins can create whatsapp connections" ON public.whatsapp_connections FOR INSERT TO authenticated WITH CHECK (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::public.app_role[]));
CREATE POLICY "Admins can update whatsapp connections" ON public.whatsapp_connections FOR UPDATE TO authenticated USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::public.app_role[]));
CREATE POLICY "Owners can delete whatsapp connections" ON public.whatsapp_connections FOR DELETE TO authenticated USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner']::public.app_role[]));

-- WhatsApp Messages
CREATE POLICY "Users can view their organization whatsapp messages" ON public.whatsapp_messages FOR SELECT TO authenticated USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));
CREATE POLICY "System can insert whatsapp messages" ON public.whatsapp_messages FOR INSERT TO authenticated WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));
CREATE POLICY "Members can update whatsapp messages" ON public.whatsapp_messages FOR UPDATE TO authenticated USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

-- Notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Service role can insert notifications" ON public.notifications FOR INSERT TO service_role WITH CHECK (true);

-- User Preferences
CREATE POLICY "Users can view their own preferences" ON public.user_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert their own preferences" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own preferences" ON public.user_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Failed Jobs
CREATE POLICY "Org members can view failed jobs" ON public.failed_jobs FOR SELECT TO authenticated USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));
CREATE POLICY "Service role manages failed jobs" ON public.failed_jobs FOR ALL TO service_role USING (true);

-- System Logs
CREATE POLICY "Org members can view system logs" ON public.system_logs FOR SELECT TO authenticated USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));
CREATE POLICY "Service role manages system logs" ON public.system_logs FOR ALL TO service_role USING (true);

-- Audit Logs
CREATE POLICY "Users can view their organization audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));
CREATE POLICY "Service role can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('org-logos', 'org-logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload org logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'org-logos' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.organizations WHERE id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Users can update org logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'org-logos' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.organizations WHERE id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Users can delete org logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'org-logos' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.organizations WHERE id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Public can view org logos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'org-logos');
CREATE POLICY "Org members can upload receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.organizations WHERE id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Org members can view receipts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] IN (SELECT id::text FROM public.organizations WHERE id IN (SELECT get_user_organization_ids(auth.uid()))));
CREATE POLICY "Service role manages receipts" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'receipts');