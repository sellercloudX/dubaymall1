
-- Platform expenses tracking (AI costs, infrastructure, per-partner)
CREATE TABLE public.platform_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_type TEXT NOT NULL, -- 'ai_usage', 'infrastructure', 'api_call', 'support', 'marketing', 'other'
  category TEXT, -- 'gemini_pro', 'firecrawl', 'replicate', 'server', 'storage', etc.
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  user_id UUID, -- NULL for platform-wide expenses, set for per-partner
  connection_id UUID, -- optional link to marketplace_connections
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_expenses ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write expenses
CREATE POLICY "Admins can manage expenses"
ON public.platform_expenses
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- AI usage log for detailed tracking
CREATE TABLE public.ai_usage_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'product_scan', 'infographic', 'content_generation', 'image_enhance', 'pinterest_search'
  model_used TEXT, -- 'gemini-2.5-pro', 'flux', etc.
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read AI usage"
ON public.ai_usage_log
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own AI usage"
ON public.ai_usage_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_platform_expenses_type ON public.platform_expenses(expense_type);
CREATE INDEX idx_platform_expenses_user ON public.platform_expenses(user_id);
CREATE INDEX idx_platform_expenses_created ON public.platform_expenses(created_at);
CREATE INDEX idx_ai_usage_log_user ON public.ai_usage_log(user_id);
CREATE INDEX idx_ai_usage_log_created ON public.ai_usage_log(created_at);
CREATE INDEX idx_ai_usage_log_action ON public.ai_usage_log(action_type);
