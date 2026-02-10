
CREATE OR REPLACE FUNCTION public.increment_view_count(product_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.products 
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
