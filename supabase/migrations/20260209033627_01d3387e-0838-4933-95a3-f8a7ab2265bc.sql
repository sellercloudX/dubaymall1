
-- Create storage bucket for product images (bucket may already exist, use ON CONFLICT)
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;
