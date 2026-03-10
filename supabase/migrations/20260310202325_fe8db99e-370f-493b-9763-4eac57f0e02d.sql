
-- Drop and recreate views with security_invoker to respect underlying table RLS

DROP VIEW IF EXISTS public.marketplace_connections_safe;
CREATE VIEW public.marketplace_connections_safe 
WITH (security_invoker = on)
AS SELECT id, user_id, marketplace, shop_id, account_info,
    products_count, orders_count, total_revenue, is_active,
    last_sync_at, created_at, updated_at
FROM public.marketplace_connections;

DROP VIEW IF EXISTS public.wildberries_connections_safe;
CREATE VIEW public.wildberries_connections_safe
WITH (security_invoker = on)
AS SELECT id, user_id, supplier_id, warehouse_id, account_info,
    is_active, products_count, orders_count, total_revenue,
    last_sync_at, created_at, updated_at
FROM public.wildberries_connections;

DROP VIEW IF EXISTS public.profiles_public;
CREATE VIEW public.profiles_public
WITH (security_invoker = on)
AS SELECT id, user_id, full_name, avatar_url, created_at
FROM public.profiles;

DROP VIEW IF EXISTS public.reviews_public;
CREATE VIEW public.reviews_public
WITH (security_invoker = on)
AS SELECT r.id, r.product_id, r.rating, r.comment,
    r.is_verified_purchase, r.created_at, r.updated_at,
    p.full_name AS reviewer_name, p.avatar_url AS reviewer_avatar
FROM reviews r LEFT JOIN profiles p ON p.user_id = r.user_id;

-- Fix can_add_role privilege escalation
CREATE OR REPLACE FUNCTION public.can_add_role(p_user_id uuid, p_new_role user_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  v_is_admin := public.has_role(p_user_id, 'admin');
  IF v_is_admin THEN RETURN TRUE; END IF;
  IF p_new_role != 'buyer' THEN RETURN FALSE; END IF;
  IF public.has_role(p_user_id, p_new_role) THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$function$;
