-- Drop and recreate the UPDATE policy with explicit WITH CHECK
DROP POLICY IF EXISTS "Members can update transfers" ON public.transfers;

CREATE POLICY "Members can update transfers"
ON public.transfers
FOR UPDATE
TO authenticated
USING (organization_id IN (SELECT get_user_organization_ids(auth.uid())))
WITH CHECK (organization_id IN (SELECT get_user_organization_ids(auth.uid())));