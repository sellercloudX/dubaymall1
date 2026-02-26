
-- =============================================
-- FIX 1: STORAGE_EXPOSURE - Enforce folder-based ownership for INSERT policies
-- =============================================

-- Drop existing permissive INSERT policies on product-images
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;

-- New INSERT policy: users can only upload to their own folder (uid prefix)
CREATE POLICY "Users upload to own folder in product-images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Drop existing permissive INSERT policies on shop-assets
DROP POLICY IF EXISTS "Authenticated users can upload shop assets" ON storage.objects;

-- New INSERT policy: users can only upload to their own folder in shop-assets
CREATE POLICY "Users upload to own folder in shop-assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'shop-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Drop existing DELETE policies if too permissive
DROP POLICY IF EXISTS "Users can delete their own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own shop assets" ON storage.objects;

-- New DELETE policies with folder ownership
CREATE POLICY "Users delete own product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own shop assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'shop-assets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- =============================================
-- FIX 2: PUBLIC_DATA_EXPOSURE - Hide encrypted credentials from user SELECT
-- Create a view that excludes sensitive columns
-- =============================================

-- Create a safe view for marketplace_connections that hides credentials
CREATE OR REPLACE VIEW public.marketplace_connections_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  marketplace,
  shop_id,
  account_info,
  products_count,
  orders_count,
  total_revenue,
  is_active,
  last_sync_at,
  created_at,
  updated_at
  -- deliberately omitting: credentials, encrypted_credentials
FROM public.marketplace_connections;

-- Similarly for wildberries_connections
CREATE OR REPLACE VIEW public.wildberries_connections_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  supplier_id,
  warehouse_id,
  account_info,
  is_active,
  products_count,
  orders_count,
  total_revenue,
  last_sync_at,
  created_at,
  updated_at
  -- deliberately omitting: encrypted_api_key
FROM public.wildberries_connections;
