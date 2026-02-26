
-- Table to link Supabase users with Telegram chat IDs
CREATE TABLE public.telegram_chat_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  telegram_chat_id bigint NOT NULL,
  telegram_username text,
  telegram_first_name text,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(telegram_chat_id)
);

ALTER TABLE public.telegram_chat_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own link" ON public.telegram_chat_links
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own link" ON public.telegram_chat_links
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own link" ON public.telegram_chat_links
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all links" ON public.telegram_chat_links
  FOR SELECT TO authenticated USING (has_admin_permission(auth.uid(), 'can_manage_users'));

-- Support messages table
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('partner_to_admin', 'admin_to_partner', 'system', 'broadcast')),
  is_read boolean NOT NULL DEFAULT false,
  admin_user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.support_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND direction = 'partner_to_admin');

CREATE POLICY "Admins can view all messages" ON public.support_messages
  FOR SELECT TO authenticated USING (has_admin_permission(auth.uid(), 'can_manage_users'));

CREATE POLICY "Admins can insert messages" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (has_admin_permission(auth.uid(), 'can_manage_users'));

CREATE POLICY "Admins can update messages" ON public.support_messages
  FOR UPDATE TO authenticated USING (has_admin_permission(auth.uid(), 'can_manage_users'));

-- Enable realtime for support messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

-- Index for fast queries
CREATE INDEX idx_support_messages_user_id ON public.support_messages(user_id, created_at DESC);
CREATE INDEX idx_support_messages_unread ON public.support_messages(user_id, is_read) WHERE is_read = false;
