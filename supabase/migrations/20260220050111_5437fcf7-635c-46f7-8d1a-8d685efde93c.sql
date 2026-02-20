
-- Grant execute on search_mxik_fuzzy to authenticated users
GRANT EXECUTE ON FUNCTION public.search_mxik_fuzzy(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_mxik_fuzzy(text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.search_mxik_fuzzy(text, integer) TO service_role;
