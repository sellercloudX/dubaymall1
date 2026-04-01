-- 1. Fix existing mismatched data: sync plan_slug to plan_type
UPDATE public.sellercloud_subscriptions
SET plan_slug = plan_type
WHERE plan_slug != plan_type;

-- 2. Create trigger function to auto-sync plan_slug when plan_type changes
CREATE OR REPLACE FUNCTION public.sync_plan_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Always keep plan_slug in sync with plan_type
  IF NEW.plan_type IS DISTINCT FROM OLD.plan_type THEN
    NEW.plan_slug := NEW.plan_type;
  END IF;
  -- Also on INSERT, ensure they match
  IF TG_OP = 'INSERT' THEN
    NEW.plan_slug := COALESCE(NEW.plan_slug, NEW.plan_type);
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Create trigger
DROP TRIGGER IF EXISTS trg_sync_plan_slug ON public.sellercloud_subscriptions;
CREATE TRIGGER trg_sync_plan_slug
  BEFORE INSERT OR UPDATE ON public.sellercloud_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_plan_slug();
