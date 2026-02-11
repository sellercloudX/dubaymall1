
-- Fix 1: Create reviews_public view to hide user_id
CREATE VIEW public.reviews_public
WITH (security_invoker = on) AS
SELECT id, product_id, rating, comment, is_verified_purchase, created_at, updated_at
FROM public.reviews;

-- Fix 2: Restrict direct SELECT on reviews to owner only (view handles public access)
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;

CREATE POLICY "Users can view own reviews"
ON public.reviews FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reviews"
ON public.reviews FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Fix 3: Fix storage policies to check ownership via folder path
DROP POLICY IF EXISTS "Users can update their own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their shop assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their shop assets" ON storage.objects;

CREATE POLICY "Users can update own product images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own product images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own shop assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'shop-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own shop assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'shop-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
