-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload logos for their organizations
CREATE POLICY "Users can upload org logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-logos' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations 
    WHERE id IN (SELECT get_user_organization_ids(auth.uid()))
  )
);

-- Allow authenticated users to update their org logos
CREATE POLICY "Users can update org logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'org-logos' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations 
    WHERE id IN (SELECT get_user_organization_ids(auth.uid()))
  )
);

-- Allow authenticated users to delete their org logos
CREATE POLICY "Users can delete org logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'org-logos' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.organizations 
    WHERE id IN (SELECT get_user_organization_ids(auth.uid()))
  )
);

-- Allow public to view org logos
CREATE POLICY "Public can view org logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'org-logos');