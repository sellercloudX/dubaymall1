
-- Team members table: allows shop owners to invite team members with role-based permissions
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  member_user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  permissions jsonb NOT NULL DEFAULT '{"view_products": true, "view_orders": true, "view_analytics": true, "edit_products": false, "manage_orders": false, "manage_prices": false, "view_financials": false, "manage_settings": false}'::jsonb,
  invited_email text,
  status text NOT NULL DEFAULT 'pending',
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(owner_user_id, member_user_id)
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Owner can manage their team
CREATE POLICY "Owners manage their team" ON public.team_members
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Members can view their membership
CREATE POLICY "Members view their membership" ON public.team_members
  FOR SELECT TO authenticated
  USING (member_user_id = auth.uid());

-- Members can accept/decline invites
CREATE POLICY "Members update their own membership" ON public.team_members
  FOR UPDATE TO authenticated
  USING (member_user_id = auth.uid())
  WITH CHECK (member_user_id = auth.uid());

-- Team activity log
CREATE TABLE public.team_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.team_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team owners see activity" ON public.team_activity_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = team_member_id AND tm.owner_user_id = auth.uid()
    )
  );

-- Function to check if user has team permission
CREATE OR REPLACE FUNCTION public.check_team_permission(p_user_id uuid, p_owner_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE member_user_id = p_user_id
      AND owner_user_id = p_owner_id
      AND status = 'accepted'
      AND (permissions->>p_permission)::boolean = true
  )
$$;
