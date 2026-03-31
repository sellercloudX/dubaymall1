
-- Remove sensitive tables from Realtime (no IF EXISTS for ALTER PUBLICATION)
ALTER PUBLICATION supabase_realtime DROP TABLE public.logistics_orders;
ALTER PUBLICATION supabase_realtime DROP TABLE public.support_messages;

-- Restrict view access
REVOKE ALL ON public.logistics_orders_safe FROM anon;
GRANT SELECT ON public.logistics_orders_safe TO authenticated;

REVOKE ALL ON public.orders_seller_view FROM anon;
GRANT SELECT ON public.orders_seller_view TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'reviews_public') THEN
    ALTER VIEW public.reviews_public SET (security_invoker = on);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'marketplace_connections_safe') THEN
    ALTER VIEW public.marketplace_connections_safe SET (security_invoker = on);
    EXECUTE 'REVOKE ALL ON public.marketplace_connections_safe FROM anon';
    EXECUTE 'GRANT SELECT ON public.marketplace_connections_safe TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'wildberries_connections_safe') THEN
    ALTER VIEW public.wildberries_connections_safe SET (security_invoker = on);
    EXECUTE 'REVOKE ALL ON public.wildberries_connections_safe FROM anon';
    EXECUTE 'GRANT SELECT ON public.wildberries_connections_safe TO authenticated';
  END IF;
END $$;
