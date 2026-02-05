-- Create product_variants table for size, color, model options
CREATE TABLE public.product_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_type TEXT NOT NULL CHECK (variant_type IN ('size', 'color', 'model')),
  variant_value TEXT NOT NULL,
  variant_label TEXT, -- Display name (e.g., "Qizil" for red)
  price_adjustment NUMERIC DEFAULT 0, -- Price difference from base price
  stock_quantity INTEGER DEFAULT 0,
  image_url TEXT, -- Only for color variants - each color can have its own image
  hex_color TEXT, -- For color variants - hex code for color swatch display
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_product_variants_product_id ON public.product_variants(product_id);
CREATE INDEX idx_product_variants_type ON public.product_variants(variant_type);

-- Enable RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Everyone can view active variants
CREATE POLICY "Anyone can view active variants"
  ON public.product_variants
  FOR SELECT
  USING (is_active = true);

-- Shop owners can manage their product variants
CREATE POLICY "Shop owners can insert variants"
  ON public.product_variants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.shops s ON p.shop_id = s.id
      WHERE p.id = product_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can update variants"
  ON public.product_variants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.shops s ON p.shop_id = s.id
      WHERE p.id = product_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can delete variants"
  ON public.product_variants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.shops s ON p.shop_id = s.id
      WHERE p.id = product_id AND s.user_id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();