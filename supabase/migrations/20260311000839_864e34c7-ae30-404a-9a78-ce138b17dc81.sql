
-- Drop dependent indexes
DROP INDEX IF EXISTS public.idx_mxik_name_uz_trgm;
DROP INDEX IF EXISTS public.idx_mxik_name_ru_trgm;
DROP INDEX IF EXISTS public.idx_mxik_codes_name_uz_trgm;
DROP INDEX IF EXISTS public.idx_mxik_codes_name_ru_trgm;
DROP INDEX IF EXISTS public.idx_mxik_codes_group_name_trgm;

-- Move pg_trgm from public to extensions schema
DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Recreate indexes using extensions schema operators
CREATE INDEX idx_mxik_codes_name_uz_trgm ON public.mxik_codes USING gin (name_uz extensions.gin_trgm_ops);
CREATE INDEX idx_mxik_codes_name_ru_trgm ON public.mxik_codes USING gin (name_ru extensions.gin_trgm_ops);
CREATE INDEX idx_mxik_codes_group_name_trgm ON public.mxik_codes USING gin (group_name extensions.gin_trgm_ops);
