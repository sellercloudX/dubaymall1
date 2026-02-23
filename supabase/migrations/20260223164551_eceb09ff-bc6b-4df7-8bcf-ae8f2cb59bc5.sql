-- Fix storage INSERT policies to enforce folder-based ownership
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload shop assets" ON storage.objects;

CREATE POLICY "Users can upload to own product-images folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can upload to own shop-assets folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'shop-assets' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);