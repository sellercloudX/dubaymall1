
-- Repricing rules table
CREATE TABLE public.repricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  marketplace TEXT NOT NULL,
  strategy TEXT NOT NULL DEFAULT 'match_lowest',
  min_price_percent NUMERIC NOT NULL DEFAULT 5,
  max_undercut NUMERIC NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own repricing rules"
  ON public.repricing_rules FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Repricing execution log
CREATE TABLE public.repricing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  rule_id UUID REFERENCES public.repricing_rules(id) ON DELETE SET NULL,
  marketplace TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  product_name TEXT,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  strategy TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repricing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own repricing log"
  ON public.repricing_log FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
