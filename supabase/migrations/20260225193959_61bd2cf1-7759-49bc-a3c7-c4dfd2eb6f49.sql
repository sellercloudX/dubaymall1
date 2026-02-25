-- Drop overly permissive UPDATE and DELETE policies on storage buckets
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update shop assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete shop assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create owner-scoped UPDATE policies
CREATE POLICY "Users can update their own product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND auth.uid() = owner);

CREATE POLICY "Users can update their own shop assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'shop-assets' AND auth.uid() = owner);

-- Create owner-scoped DELETE policies
CREATE POLICY "Users can delete their own product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND auth.uid() = owner);

CREATE POLICY "Users can delete their own shop assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'shop-assets' AND auth.uid() = owner);