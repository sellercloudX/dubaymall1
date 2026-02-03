-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true);

-- Storage policies for product images
CREATE POLICY "Product images are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own product images" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own product images" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

-- Create storage bucket for shop logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('shop-assets', 'shop-assets', true);

CREATE POLICY "Shop assets are publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'shop-assets');

CREATE POLICY "Authenticated users can upload shop assets" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'shop-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their shop assets" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'shop-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their shop assets" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'shop-assets' AND auth.uid() IS NOT NULL);