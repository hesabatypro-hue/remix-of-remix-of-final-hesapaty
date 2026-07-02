-- =====================================================
-- المرحلة الأولى: بنية Multi-Tenancy
-- =====================================================

-- 1. إنشاء جدول المؤسسات (Organizations)
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. إنشاء جدول البروفايل (Profiles)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. إنشاء نوع الأدوار (Roles Enum)
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'manager', 'viewer');

-- 4. إنشاء جدول أدوار المستخدمين (User Roles) - منفصل للأمان
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- 5. إضافة organization_id للجداول الحالية
ALTER TABLE public.branches ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.transfers ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_connections ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.whatsapp_messages ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 6. إنشاء فهارس للأداء
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_organization_id ON public.user_roles(organization_id);
CREATE INDEX idx_branches_organization_id ON public.branches(organization_id);
CREATE INDEX idx_transfers_organization_id ON public.transfers(organization_id);
CREATE INDEX idx_whatsapp_connections_organization_id ON public.whatsapp_connections(organization_id);
CREATE INDEX idx_whatsapp_messages_organization_id ON public.whatsapp_messages(organization_id);
CREATE INDEX idx_organizations_slug ON public.organizations(slug);

-- 7. إنشاء Trigger لتحديث updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. تفعيل RLS على الجداول الجديدة
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 9. إنشاء دالة للتحقق من الصلاحيات (Security Definer لتجنب التكرار اللانهائي)
CREATE OR REPLACE FUNCTION public.get_user_organization_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.user_roles WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.has_organization_role(_user_id UUID, _organization_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _organization_id
      AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_organization_member(_user_id UUID, _organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND organization_id = _organization_id
  );
$$;

-- 10. سياسات RLS للمؤسسات
CREATE POLICY "Users can view organizations they belong to"
ON public.organizations FOR SELECT
TO authenticated
USING (id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Owners and admins can update their organizations"
ON public.organizations FOR UPDATE
TO authenticated
USING (public.has_organization_role(auth.uid(), id, ARRAY['owner', 'admin']::public.app_role[]));

CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- 11. سياسات RLS للبروفايل
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- 12. سياسات RLS لأدوار المستخدمين
CREATE POLICY "Users can view roles in their organizations"
ON public.user_roles FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Owners and admins can manage roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::public.app_role[]));

CREATE POLICY "Owners and admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::public.app_role[]));

CREATE POLICY "Owners can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner']::public.app_role[]));

-- 13. تحديث سياسات RLS للجداول الحالية (حذف القديمة وإضافة الجديدة)
DROP POLICY IF EXISTS "Allow public read access to branches" ON public.branches;
DROP POLICY IF EXISTS "Allow public insert to branches" ON public.branches;
DROP POLICY IF EXISTS "Allow public update to branches" ON public.branches;
DROP POLICY IF EXISTS "Allow public delete to branches" ON public.branches;

CREATE POLICY "Users can view their organization branches"
ON public.branches FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Admins can create branches"
ON public.branches FOR INSERT
TO authenticated
WITH CHECK (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin', 'manager']::public.app_role[]));

CREATE POLICY "Admins can update branches"
ON public.branches FOR UPDATE
TO authenticated
USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin', 'manager']::public.app_role[]));

CREATE POLICY "Owners and admins can delete branches"
ON public.branches FOR DELETE
TO authenticated
USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::public.app_role[]));

-- 14. تحديث سياسات transfers
DROP POLICY IF EXISTS "Allow public read access to transfers" ON public.transfers;
DROP POLICY IF EXISTS "Allow public insert to transfers" ON public.transfers;
DROP POLICY IF EXISTS "Allow public update to transfers" ON public.transfers;
DROP POLICY IF EXISTS "Allow public delete to transfers" ON public.transfers;

CREATE POLICY "Users can view their organization transfers"
ON public.transfers FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can create transfers"
ON public.transfers FOR INSERT
TO authenticated
WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can update transfers"
ON public.transfers FOR UPDATE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Admins can delete transfers"
ON public.transfers FOR DELETE
TO authenticated
USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::public.app_role[]));

-- 15. تحديث سياسات whatsapp_connections
DROP POLICY IF EXISTS "Allow public read access to whatsapp_connections" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "Allow public insert to whatsapp_connections" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "Allow public update to whatsapp_connections" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "Allow public delete to whatsapp_connections" ON public.whatsapp_connections;

CREATE POLICY "Users can view their organization whatsapp connections"
ON public.whatsapp_connections FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Admins can create whatsapp connections"
ON public.whatsapp_connections FOR INSERT
TO authenticated
WITH CHECK (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::public.app_role[]));

CREATE POLICY "Admins can update whatsapp connections"
ON public.whatsapp_connections FOR UPDATE
TO authenticated
USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner', 'admin']::public.app_role[]));

CREATE POLICY "Owners can delete whatsapp connections"
ON public.whatsapp_connections FOR DELETE
TO authenticated
USING (public.has_organization_role(auth.uid(), organization_id, ARRAY['owner']::public.app_role[]));

-- 16. تحديث سياسات whatsapp_messages
DROP POLICY IF EXISTS "Allow public read access to whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Allow public insert to whatsapp_messages" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "Allow public update to whatsapp_messages" ON public.whatsapp_messages;

CREATE POLICY "Users can view their organization whatsapp messages"
ON public.whatsapp_messages FOR SELECT
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "System can insert whatsapp messages"
ON public.whatsapp_messages FOR INSERT
TO authenticated
WITH CHECK (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

CREATE POLICY "Members can update whatsapp messages"
ON public.whatsapp_messages FOR UPDATE
TO authenticated
USING (organization_id IN (SELECT public.get_user_organization_ids(auth.uid())));

-- 17. إنشاء Trigger لإنشاء profile تلقائياً عند تسجيل مستخدم جديد
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();