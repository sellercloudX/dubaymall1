-- Fix security: make views use security_invoker so underlying RLS applies
ALTER VIEW public.marketplace_connections_safe SET (security_invoker = true);
ALTER VIEW public.wildberries_connections_safe SET (security_invoker = true);