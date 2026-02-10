
-- Create fuzzy search function for products using pg_trgm (already enabled)
CREATE OR REPLACE FUNCTION public.search_products_fuzzy(
  search_term text,
  category_filter uuid DEFAULT NULL,
  sort_type text DEFAULT 'newest',
  page_offset int DEFAULT 0,
  page_limit int DEFAULT 20
)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  price numeric,
  original_price numeric,
  images text[],
  stock_quantity int,
  category_id uuid,
  shop_id uuid,
  status text,
  created_at timestamptz,
  view_count int,
  free_shipping boolean,
  mxik_code text,
  mxik_name text,
  source text,
  source_url text,
  specifications jsonb,
  preparation_days int,
  shipping_price numeric,
  weight_kg numeric,
  is_affiliate_enabled boolean,
  affiliate_commission_percent numeric,
  updated_at timestamptz,
  shop_name text,
  shop_slug text,
  similarity_score real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.description,
    p.price,
    p.original_price,
    p.images,
    p.stock_quantity,
    p.category_id,
    p.shop_id,
    p.status::text,
    p.created_at,
    p.view_count,
    p.free_shipping,
    p.mxik_code,
    p.mxik_name,
    p.source::text,
    p.source_url,
    p.specifications::jsonb,
    p.preparation_days,
    p.shipping_price,
    p.weight_kg,
    p.is_affiliate_enabled,
    p.affiliate_commission_percent,
    p.updated_at,
    s.name AS shop_name,
    s.slug AS shop_slug,
    CASE 
      WHEN search_term IS NOT NULL AND search_term != '' 
      THEN similarity(lower(p.name), lower(search_term))
      ELSE 1.0::real
    END AS similarity_score
  FROM public.products p
  LEFT JOIN public.shops s ON s.id = p.shop_id
  WHERE p.status = 'active'
    AND (category_filter IS NULL OR p.category_id = category_filter)
    AND (
      search_term IS NULL 
      OR search_term = '' 
      OR lower(p.name) ILIKE '%' || lower(search_term) || '%'
      OR similarity(lower(p.name), lower(search_term)) > 0.15
    )
  ORDER BY
    CASE WHEN search_term IS NOT NULL AND search_term != '' 
      THEN similarity(lower(p.name), lower(search_term)) 
      ELSE 0 
    END DESC,
    CASE WHEN sort_type = 'newest' THEN p.created_at END DESC,
    CASE WHEN sort_type = 'price_low' THEN p.price END ASC,
    CASE WHEN sort_type = 'price_high' THEN p.price END DESC,
    CASE WHEN sort_type = 'popular' THEN p.view_count END DESC
  OFFSET page_offset
  LIMIT page_limit;
END;
$$;
