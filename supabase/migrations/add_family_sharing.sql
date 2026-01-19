-- ===========================================
-- Migration: Add Family & Friends Sharing
-- Enables subscription sharing, shared recipes, tasks, and lists
-- ===========================================

-- ===========================================
-- TABLE: family_groups
-- Represents a shared subscription group
-- ===========================================
CREATE TABLE IF NOT EXISTS public.family_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL DEFAULT 'My Family',
    share_all_lists boolean DEFAULT false,
    credits_used_this_month integer DEFAULT 0,
    created_date timestamp with time zone DEFAULT now(),
    updated_date timestamp with time zone DEFAULT now(),
    CONSTRAINT family_groups_pkey PRIMARY KEY (id),
    CONSTRAINT family_groups_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT family_groups_owner_unique UNIQUE (owner_id)
);

-- Comments
COMMENT ON TABLE public.family_groups IS 'Represents a family/friends subscription sharing group';
COMMENT ON COLUMN public.family_groups.owner_id IS 'The user who owns the subscription and created the family group';
COMMENT ON COLUMN public.family_groups.share_all_lists IS 'When true, new lists are automatically shared with all family members';
COMMENT ON COLUMN public.family_groups.credits_used_this_month IS 'Aggregated AI credits used by the entire family this billing period';

-- ===========================================
-- TABLE: family_members
-- Membership in a family group
-- ===========================================
CREATE TABLE IF NOT EXISTS public.family_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_date timestamp with time zone DEFAULT now(),
    updated_date timestamp with time zone DEFAULT now(),
    CONSTRAINT family_members_pkey PRIMARY KEY (id),
    CONSTRAINT family_members_family_group_id_fkey FOREIGN KEY (family_group_id) REFERENCES public.family_groups(id) ON DELETE CASCADE,
    CONSTRAINT family_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT family_members_user_unique UNIQUE (user_id),
    CONSTRAINT family_members_status_check CHECK (status IN ('pending', 'approved')),
    CONSTRAINT family_members_role_check CHECK (role IN ('owner', 'member'))
);

-- Comments
COMMENT ON TABLE public.family_members IS 'Tracks membership in family sharing groups';
COMMENT ON COLUMN public.family_members.status IS 'pending = awaiting approval, approved = active member';
COMMENT ON COLUMN public.family_members.role IS 'owner = subscription owner who created group, member = invited user';

-- ===========================================
-- TABLE: family_invites
-- Pending invitations to join a family group
-- ===========================================
CREATE TABLE IF NOT EXISTS public.family_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    family_group_id uuid NOT NULL,
    invitee_email text,
    token text NOT NULL,
    is_active boolean DEFAULT true,
    expires_at timestamp with time zone NOT NULL,
    created_date timestamp with time zone DEFAULT now(),
    updated_date timestamp with time zone DEFAULT now(),
    CONSTRAINT family_invites_pkey PRIMARY KEY (id),
    CONSTRAINT family_invites_family_group_id_fkey FOREIGN KEY (family_group_id) REFERENCES public.family_groups(id) ON DELETE CASCADE,
    CONSTRAINT family_invites_token_unique UNIQUE (token)
);

-- Comments
COMMENT ON TABLE public.family_invites IS 'Pending invitations to join a family sharing group';
COMMENT ON COLUMN public.family_invites.invitee_email IS 'Optional: email of invited user for email-based invites';
COMMENT ON COLUMN public.family_invites.token IS 'Cryptographically random token for secure invite links';
COMMENT ON COLUMN public.family_invites.expires_at IS 'Invitation expires after 7 days by default';

-- ===========================================
-- SCHEMA MODIFICATIONS: subscription_tiers
-- Add max_family_members column
-- ===========================================
ALTER TABLE public.subscription_tiers 
ADD COLUMN IF NOT EXISTS max_family_members integer DEFAULT 0;

-- Set default values for existing tiers
-- free/adfree: 0 family members
-- pro: 1 family member
-- premium: 3 family members
UPDATE public.subscription_tiers SET max_family_members = 0 WHERE tier_name IN ('free', 'adfree');
UPDATE public.subscription_tiers SET max_family_members = 1 WHERE tier_name = 'pro';
UPDATE public.subscription_tiers SET max_family_members = 3 WHERE tier_name = 'premium';

COMMENT ON COLUMN public.subscription_tiers.max_family_members IS 'Maximum number of family members (excluding owner) allowed for this tier';

-- ===========================================
-- SCHEMA MODIFICATIONS: todos
-- Add shared_with_family column
-- ===========================================
ALTER TABLE public.todos 
ADD COLUMN IF NOT EXISTS shared_with_family boolean DEFAULT false;

COMMENT ON COLUMN public.todos.shared_with_family IS 'When true, this task is visible to all approved family members';

-- ===========================================
-- SCHEMA MODIFICATIONS: profiles
-- Add family_group_id column for quick lookups
-- ===========================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS family_group_id uuid;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_family_group_id_fkey 
FOREIGN KEY (family_group_id) REFERENCES public.family_groups(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.family_group_id IS 'Reference to the family group this user belongs to (for quick lookups)';

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_family_groups_owner_id ON public.family_groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_group_id ON public.family_members(family_group_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON public.family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_status ON public.family_members(status);
CREATE INDEX IF NOT EXISTS idx_family_invites_family_group_id ON public.family_invites(family_group_id);
CREATE INDEX IF NOT EXISTS idx_family_invites_token ON public.family_invites(token);
CREATE INDEX IF NOT EXISTS idx_family_invites_is_active ON public.family_invites(is_active);
CREATE INDEX IF NOT EXISTS idx_todos_shared_with_family ON public.todos(shared_with_family);
CREATE INDEX IF NOT EXISTS idx_profiles_family_group_id ON public.profiles(family_group_id);

-- ===========================================
-- ENABLE ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- RLS POLICIES: family_groups
-- ===========================================
-- Owners can create their own family group
CREATE POLICY "Users can create own family group" ON public.family_groups
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Owners can update their family group
CREATE POLICY "Owners can update own family group" ON public.family_groups
    FOR UPDATE USING (owner_id = auth.uid());

-- Owners can delete their family group
CREATE POLICY "Owners can delete own family group" ON public.family_groups
    FOR DELETE USING (owner_id = auth.uid());

-- Owners and approved members can view the family group
CREATE POLICY "Owners and members can view family group" ON public.family_groups
    FOR SELECT USING (
        owner_id = auth.uid()
        OR id IN (
            SELECT family_group_id FROM public.family_members
            WHERE user_id = auth.uid() AND status = 'approved'
        )
    );

-- ===========================================
-- RLS POLICIES: family_members
-- ===========================================
-- Only group owners can add members (via secure RPC function)
CREATE POLICY "Owners can insert family members" ON public.family_members
    FOR INSERT WITH CHECK (
        family_group_id IN (
            SELECT id FROM public.family_groups WHERE owner_id = auth.uid()
        )
    );

-- Owners can update member status
CREATE POLICY "Owners can update family members" ON public.family_members
    FOR UPDATE USING (
        family_group_id IN (
            SELECT id FROM public.family_groups WHERE owner_id = auth.uid()
        )
    );

-- Owners can remove members, members can remove themselves
CREATE POLICY "Owners can remove members or members can leave" ON public.family_members
    FOR DELETE USING (
        family_group_id IN (
            SELECT id FROM public.family_groups WHERE owner_id = auth.uid()
        )
        OR user_id = auth.uid()
    );

-- Owners can view all members, members can view approved members
CREATE POLICY "View family members" ON public.family_members
    FOR SELECT USING (
        family_group_id IN (
            SELECT id FROM public.family_groups WHERE owner_id = auth.uid()
        )
        OR (
            user_id = auth.uid()
        )
        OR (
            status = 'approved' AND family_group_id IN (
                SELECT family_group_id FROM public.family_members
                WHERE user_id = auth.uid() AND status = 'approved'
            )
        )
    );

-- ===========================================
-- RLS POLICIES: family_invites
-- ===========================================
-- Only group owners can create invites
CREATE POLICY "Owners can create invites" ON public.family_invites
    FOR INSERT WITH CHECK (
        family_group_id IN (
            SELECT id FROM public.family_groups WHERE owner_id = auth.uid()
        )
    );

-- Owners can update invites (e.g., deactivate)
CREATE POLICY "Owners can update invites" ON public.family_invites
    FOR UPDATE USING (
        family_group_id IN (
            SELECT id FROM public.family_groups WHERE owner_id = auth.uid()
        )
    );

-- Owners can delete invites
CREATE POLICY "Owners can delete invites" ON public.family_invites
    FOR DELETE USING (
        family_group_id IN (
            SELECT id FROM public.family_groups WHERE owner_id = auth.uid()
        )
    );

-- Owners can view invites for management
CREATE POLICY "Owners can view invites" ON public.family_invites
    FOR SELECT USING (
        family_group_id IN (
            SELECT id FROM public.family_groups WHERE owner_id = auth.uid()
        )
    );

-- ===========================================
-- RLS POLICIES: todos (updated for family sharing)
-- ===========================================
-- Update the existing SELECT policy to include family-shared todos
DROP POLICY IF EXISTS "Users can view own todos" ON public.todos;

CREATE POLICY "Users can view own and family-shared todos" ON public.todos
    FOR SELECT USING (
        -- User's own todos
        created_by = (SELECT email FROM public.profiles WHERE id = auth.uid())
        -- OR family-shared todos from approved family members
        OR (
            shared_with_family = true
            AND created_by IN (
                SELECT p.email 
                FROM public.profiles p
                JOIN public.family_members fm ON fm.user_id = p.id
                WHERE fm.family_group_id = (
                    SELECT family_group_id FROM public.profiles WHERE id = auth.uid()
                )
                AND fm.status = 'approved'
            )
        )
    );

-- ===========================================
-- FUNCTION: Get Family Member User IDs
-- Helper function to get all approved family member user IDs
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_family_member_ids(p_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_family_group_id uuid;
    v_member_ids uuid[];
BEGIN
    -- Get the user's family group
    SELECT family_group_id INTO v_family_group_id
    FROM public.profiles
    WHERE id = p_user_id;
    
    IF v_family_group_id IS NULL THEN
        RETURN ARRAY[]::uuid[];
    END IF;
    
    -- Get all approved member IDs in the family group
    SELECT ARRAY_AGG(user_id) INTO v_member_ids
    FROM public.family_members
    WHERE family_group_id = v_family_group_id
    AND status = 'approved';
    
    RETURN COALESCE(v_member_ids, ARRAY[]::uuid[]);
END;
$$;

COMMENT ON FUNCTION public.get_family_member_ids IS 'Returns array of user IDs for all approved members in the same family group';
GRANT EXECUTE ON FUNCTION public.get_family_member_ids(uuid) TO authenticated;

-- ===========================================
-- FUNCTION: Get Family Credits Remaining
-- Returns the remaining credits for a family pool
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_family_credits_remaining(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_family_group_id uuid;
    v_owner_id uuid;
    v_monthly_credits integer;
    v_credits_used integer;
    v_remaining integer;
BEGIN
    -- Get the user's family group
    SELECT family_group_id INTO v_family_group_id
    FROM public.profiles
    WHERE id = p_user_id;
    
    -- If not in a family group, return individual credits
    IF v_family_group_id IS NULL THEN
        SELECT 
            monthly_credits_total - credits_used_this_month,
            monthly_credits_total,
            credits_used_this_month
        INTO v_remaining, v_monthly_credits, v_credits_used
        FROM public.profiles
        WHERE id = p_user_id;
        
        RETURN jsonb_build_object(
            'is_family_pool', false,
            'monthly_credits', v_monthly_credits,
            'credits_used', v_credits_used,
            'credits_remaining', GREATEST(0, v_remaining)
        );
    END IF;
    
    -- Get family group owner and their tier credits
    SELECT fg.owner_id, fg.credits_used_this_month, st.monthly_credits
    INTO v_owner_id, v_credits_used, v_monthly_credits
    FROM public.family_groups fg
    JOIN public.profiles p ON p.id = fg.owner_id
    JOIN public.subscription_tiers st ON st.tier_name = p.subscription_tier
    WHERE fg.id = v_family_group_id;
    
    v_remaining := GREATEST(0, v_monthly_credits - v_credits_used);
    
    RETURN jsonb_build_object(
        'is_family_pool', true,
        'family_group_id', v_family_group_id,
        'owner_id', v_owner_id,
        'monthly_credits', v_monthly_credits,
        'credits_used', v_credits_used,
        'credits_remaining', v_remaining
    );
END;
$$;

COMMENT ON FUNCTION public.get_family_credits_remaining IS 'Returns remaining credits - uses family pool if user is in a family group';
GRANT EXECUTE ON FUNCTION public.get_family_credits_remaining(uuid) TO authenticated;

-- ===========================================
-- FUNCTION: Consume Family Credits
-- Consumes credits from the family pool
-- ===========================================
CREATE OR REPLACE FUNCTION public.consume_family_credits(
    p_user_id uuid,
    p_credits integer,
    p_feature_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_family_group_id uuid;
    v_credits_info jsonb;
BEGIN
    -- Get current credits info
    v_credits_info := public.get_family_credits_remaining(p_user_id);
    
    -- Check if enough credits
    IF (v_credits_info->>'credits_remaining')::integer < p_credits THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'insufficient_credits',
            'message', 'Not enough credits remaining'
        );
    END IF;
    
    -- Get family group ID
    SELECT family_group_id INTO v_family_group_id
    FROM public.profiles
    WHERE id = p_user_id;
    
    IF v_family_group_id IS NOT NULL THEN
        -- Update family group credits
        UPDATE public.family_groups
        SET credits_used_this_month = credits_used_this_month + p_credits,
            updated_date = now()
        WHERE id = v_family_group_id;
    ELSE
        -- Update individual profile credits
        UPDATE public.profiles
        SET credits_used_this_month = credits_used_this_month + p_credits,
            updated_date = now()
        WHERE id = p_user_id;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'credits_consumed', p_credits,
        'credits_remaining', (v_credits_info->>'credits_remaining')::integer - p_credits
    );
END;
$$;

COMMENT ON FUNCTION public.consume_family_credits IS 'Consumes credits from family pool or individual credits';
GRANT EXECUTE ON FUNCTION public.consume_family_credits(uuid, integer, text) TO authenticated;

-- ===========================================
-- FUNCTION: Validate Family Invite Token (Public, read-only)
-- Allows checking if a family invite token is valid
-- ===========================================
CREATE OR REPLACE FUNCTION public.validate_family_invite_token(invite_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invite RECORD;
BEGIN
    -- Check if token exists and is active
    SELECT fi.*, fg.name as family_name, p.full_name as owner_name, p.email as owner_email
    INTO v_invite
    FROM public.family_invites fi
    JOIN public.family_groups fg ON fg.id = fi.family_group_id
    JOIN public.profiles p ON p.id = fg.owner_id
    WHERE fi.token = invite_token
    AND fi.is_active = true
    AND fi.expires_at > now();
    
    IF v_invite IS NULL THEN
        RETURN jsonb_build_object(
            'valid', false,
            'message', 'This invite link is invalid or has expired'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'valid', true,
        'family_name', v_invite.family_name,
        'owner_name', v_invite.owner_name
    );
END;
$$;

COMMENT ON FUNCTION public.validate_family_invite_token IS 'Validates a family invite token and returns family info';
GRANT EXECUTE ON FUNCTION public.validate_family_invite_token(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_family_invite_token(text) TO authenticated;

-- ===========================================
-- FUNCTION: Join Family via Token
-- Validates token and adds user as pending member
-- ===========================================
CREATE OR REPLACE FUNCTION public.join_family_via_token(invite_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_user_email text;
    v_invite RECORD;
    v_family_group RECORD;
    v_existing_membership RECORD;
    v_owner_tier RECORD;
    v_current_member_count integer;
BEGIN
    -- Get the authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_authenticated',
            'message', 'You must be logged in to join a family'
        );
    END IF;
    
    -- Get user email
    SELECT email INTO v_user_email
    FROM public.profiles
    WHERE id = v_user_id;
    
    -- Validate the invite token
    SELECT fi.*, fg.id as group_id, fg.name as family_name, fg.owner_id
    INTO v_invite
    FROM public.family_invites fi
    JOIN public.family_groups fg ON fg.id = fi.family_group_id
    WHERE fi.token = invite_token
    AND fi.is_active = true
    AND fi.expires_at > now();
    
    IF v_invite IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'invalid_token',
            'message', 'This invite link is invalid or has expired'
        );
    END IF;
    
    -- Check if user is the owner (can't join own family)
    IF v_invite.owner_id = v_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'is_owner',
            'message', 'You are the owner of this family group'
        );
    END IF;
    
    -- Check if user is already in a family group
    SELECT * INTO v_existing_membership
    FROM public.family_members
    WHERE user_id = v_user_id;
    
    IF v_existing_membership IS NOT NULL THEN
        IF v_existing_membership.family_group_id = v_invite.group_id THEN
            IF v_existing_membership.status = 'approved' THEN
                RETURN jsonb_build_object(
                    'success', true,
                    'status', 'already_approved',
                    'family_group_id', v_invite.group_id,
                    'family_name', v_invite.family_name,
                    'message', 'You are already a member of this family'
                );
            ELSE
                RETURN jsonb_build_object(
                    'success', true,
                    'status', 'already_pending',
                    'family_group_id', v_invite.group_id,
                    'family_name', v_invite.family_name,
                    'message', 'Your request is pending approval'
                );
            END IF;
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error', 'already_in_family',
                'message', 'You are already in another family group. Leave your current family to join a new one.'
            );
        END IF;
    END IF;
    
    -- Check if family has room for more members
    SELECT st.max_family_members
    INTO v_owner_tier
    FROM public.profiles p
    JOIN public.subscription_tiers st ON st.tier_name = p.subscription_tier
    WHERE p.id = v_invite.owner_id;
    
    SELECT COUNT(*) INTO v_current_member_count
    FROM public.family_members
    WHERE family_group_id = v_invite.group_id
    AND role = 'member';
    
    IF v_current_member_count >= v_owner_tier.max_family_members THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'family_full',
            'message', 'This family group has reached its member limit'
        );
    END IF;
    
    -- Create membership request (pending approval)
    INSERT INTO public.family_members (family_group_id, user_id, status, role)
    VALUES (v_invite.group_id, v_user_id, 'pending', 'member');
    
    -- Update user's profile with family group reference
    UPDATE public.profiles
    SET family_group_id = v_invite.group_id,
        updated_date = now()
    WHERE id = v_user_id;
    
    -- If invite was email-specific, deactivate it
    IF v_invite.invitee_email IS NOT NULL AND v_invite.invitee_email = v_user_email THEN
        UPDATE public.family_invites
        SET is_active = false, updated_date = now()
        WHERE id = v_invite.id;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'status', 'pending',
        'family_group_id', v_invite.group_id,
        'family_name', v_invite.family_name,
        'message', 'Request sent! The family owner will review your request.'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'server_error',
        'message', 'An error occurred. Please try again.'
    );
END;
$$;

COMMENT ON FUNCTION public.join_family_via_token IS 'Validates token and creates pending family membership';
GRANT EXECUTE ON FUNCTION public.join_family_via_token(text) TO authenticated;

-- ===========================================
-- FUNCTION: Leave Family Group
-- Allows a member to leave their family group
-- ===========================================
CREATE OR REPLACE FUNCTION public.leave_family_group()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_family_group_id uuid;
    v_membership RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_authenticated',
            'message', 'You must be logged in'
        );
    END IF;
    
    -- Get user's family membership
    SELECT fm.*, fg.owner_id
    INTO v_membership
    FROM public.family_members fm
    JOIN public.family_groups fg ON fg.id = fm.family_group_id
    WHERE fm.user_id = v_user_id;
    
    IF v_membership IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_member',
            'message', 'You are not in a family group'
        );
    END IF;
    
    -- Owners cannot leave - they must delete the group
    IF v_membership.role = 'owner' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'is_owner',
            'message', 'As the owner, you cannot leave. Delete the family group instead.'
        );
    END IF;
    
    -- Remove membership
    DELETE FROM public.family_members WHERE id = v_membership.id;
    
    -- Update profile
    UPDATE public.profiles
    SET family_group_id = NULL,
        updated_date = now()
    WHERE id = v_user_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'You have left the family group'
    );
END;
$$;

COMMENT ON FUNCTION public.leave_family_group IS 'Allows a member to leave their family group';
GRANT EXECUTE ON FUNCTION public.leave_family_group() TO authenticated;

-- ===========================================
-- FUNCTION: Approve Family Member
-- Owner approves a pending member
-- ===========================================
CREATE OR REPLACE FUNCTION public.approve_family_member(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_membership RECORD;
    v_family_group RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_authenticated',
            'message', 'You must be logged in'
        );
    END IF;
    
    -- Get the membership record
    SELECT fm.*, p.email as member_email, p.full_name as member_name
    INTO v_membership
    FROM public.family_members fm
    JOIN public.profiles p ON p.id = fm.user_id
    WHERE fm.id = p_member_id;
    
    IF v_membership IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_found',
            'message', 'Member not found'
        );
    END IF;
    
    -- Check if current user is the owner
    SELECT * INTO v_family_group
    FROM public.family_groups
    WHERE id = v_membership.family_group_id
    AND owner_id = v_user_id;
    
    IF v_family_group IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_owner',
            'message', 'Only the family owner can approve members'
        );
    END IF;
    
    -- Update member status
    UPDATE public.family_members
    SET status = 'approved',
        updated_date = now()
    WHERE id = p_member_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'member_id', p_member_id,
        'member_name', v_membership.member_name,
        'message', 'Member approved successfully'
    );
END;
$$;

COMMENT ON FUNCTION public.approve_family_member IS 'Allows family owner to approve pending members';
GRANT EXECUTE ON FUNCTION public.approve_family_member(uuid) TO authenticated;

-- ===========================================
-- FUNCTION: Remove Family Member
-- Owner removes a member from the family
-- ===========================================
CREATE OR REPLACE FUNCTION public.remove_family_member(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_membership RECORD;
    v_family_group RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_authenticated',
            'message', 'You must be logged in'
        );
    END IF;
    
    -- Get the membership record
    SELECT fm.*, p.full_name as member_name
    INTO v_membership
    FROM public.family_members fm
    JOIN public.profiles p ON p.id = fm.user_id
    WHERE fm.id = p_member_id;
    
    IF v_membership IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_found',
            'message', 'Member not found'
        );
    END IF;
    
    -- Can't remove the owner
    IF v_membership.role = 'owner' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'is_owner',
            'message', 'Cannot remove the family owner'
        );
    END IF;
    
    -- Check if current user is the owner
    SELECT * INTO v_family_group
    FROM public.family_groups
    WHERE id = v_membership.family_group_id
    AND owner_id = v_user_id;
    
    IF v_family_group IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_owner',
            'message', 'Only the family owner can remove members'
        );
    END IF;
    
    -- Remove membership
    DELETE FROM public.family_members WHERE id = p_member_id;
    
    -- Update the removed member's profile
    UPDATE public.profiles
    SET family_group_id = NULL,
        updated_date = now()
    WHERE id = v_membership.user_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'member_name', v_membership.member_name,
        'message', 'Member removed from family'
    );
END;
$$;

COMMENT ON FUNCTION public.remove_family_member IS 'Allows family owner to remove members';
GRANT EXECUTE ON FUNCTION public.remove_family_member(uuid) TO authenticated;

-- ===========================================
-- FUNCTION: Create Family Group
-- Creates a new family group for the current user
-- ===========================================
CREATE OR REPLACE FUNCTION public.create_family_group(p_name text DEFAULT 'My Family')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_tier RECORD;
    v_existing_group RECORD;
    v_new_group_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_authenticated',
            'message', 'You must be logged in'
        );
    END IF;
    
    -- Check if user already has a family group
    SELECT * INTO v_existing_group
    FROM public.family_groups
    WHERE owner_id = v_user_id;
    
    IF v_existing_group IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'already_exists',
            'family_group_id', v_existing_group.id,
            'message', 'You already have a family group'
        );
    END IF;
    
    -- Check if user's tier allows family sharing
    SELECT st.max_family_members
    INTO v_tier
    FROM public.profiles p
    JOIN public.subscription_tiers st ON st.tier_name = p.subscription_tier
    WHERE p.id = v_user_id;
    
    IF v_tier.max_family_members = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'tier_not_allowed',
            'message', 'Upgrade to Pro or Premium to create a family group'
        );
    END IF;
    
    -- Create family group
    INSERT INTO public.family_groups (owner_id, name)
    VALUES (v_user_id, p_name)
    RETURNING id INTO v_new_group_id;
    
    -- Add owner as first member
    INSERT INTO public.family_members (family_group_id, user_id, status, role)
    VALUES (v_new_group_id, v_user_id, 'approved', 'owner');
    
    -- Update owner's profile
    UPDATE public.profiles
    SET family_group_id = v_new_group_id,
        updated_date = now()
    WHERE id = v_user_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'family_group_id', v_new_group_id,
        'name', p_name,
        'message', 'Family group created successfully'
    );
END;
$$;

COMMENT ON FUNCTION public.create_family_group IS 'Creates a new family group for Pro/Premium users';
GRANT EXECUTE ON FUNCTION public.create_family_group(text) TO authenticated;

-- ===========================================
-- FUNCTION: Generate Family Invite Link
-- Creates a new invite token
-- ===========================================
CREATE OR REPLACE FUNCTION public.generate_family_invite(p_invitee_email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_family_group RECORD;
    v_new_token text;
    v_expires_at timestamp with time zone;
    v_invite_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_authenticated',
            'message', 'You must be logged in'
        );
    END IF;
    
    -- Get user's family group (must be owner)
    SELECT * INTO v_family_group
    FROM public.family_groups
    WHERE owner_id = v_user_id;
    
    IF v_family_group IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'no_family_group',
            'message', 'Create a family group first'
        );
    END IF;
    
    -- Generate cryptographically random token
    v_new_token := encode(gen_random_bytes(32), 'hex');
    v_expires_at := now() + interval '7 days';
    
    -- Create invite
    INSERT INTO public.family_invites (family_group_id, invitee_email, token, expires_at)
    VALUES (v_family_group.id, p_invitee_email, v_new_token, v_expires_at)
    RETURNING id INTO v_invite_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'invite_id', v_invite_id,
        'token', v_new_token,
        'expires_at', v_expires_at,
        'message', 'Invite created successfully'
    );
END;
$$;

COMMENT ON FUNCTION public.generate_family_invite IS 'Generates a new family invite token';
GRANT EXECUTE ON FUNCTION public.generate_family_invite(text) TO authenticated;

-- ===========================================
-- FUNCTION: Get Family Info
-- Returns complete family group info for current user
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_family_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_user_id uuid;
    v_family_group_id uuid;
    v_family_group RECORD;
    v_members jsonb;
    v_invites jsonb;
    v_is_owner boolean;
    v_tier RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_authenticated'
        );
    END IF;
    
    -- Get user's family group
    SELECT family_group_id INTO v_family_group_id
    FROM public.profiles
    WHERE id = v_user_id;
    
    IF v_family_group_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'has_family', false
        );
    END IF;
    
    -- Get family group details
    SELECT * INTO v_family_group
    FROM public.family_groups
    WHERE id = v_family_group_id;
    
    v_is_owner := v_family_group.owner_id = v_user_id;
    
    -- Get tier limits
    SELECT st.max_family_members
    INTO v_tier
    FROM public.profiles p
    JOIN public.subscription_tiers st ON st.tier_name = p.subscription_tier
    WHERE p.id = v_family_group.owner_id;
    
    -- Get members
    SELECT jsonb_agg(jsonb_build_object(
        'id', fm.id,
        'user_id', fm.user_id,
        'email', p.email,
        'full_name', p.full_name,
        'status', fm.status,
        'role', fm.role,
        'joined_date', fm.created_date
    ) ORDER BY fm.role DESC, fm.created_date)
    INTO v_members
    FROM public.family_members fm
    JOIN public.profiles p ON p.id = fm.user_id
    WHERE fm.family_group_id = v_family_group_id;
    
    -- Get active invites (only for owner)
    IF v_is_owner THEN
        SELECT jsonb_agg(jsonb_build_object(
            'id', fi.id,
            'invitee_email', fi.invitee_email,
            'token', fi.token,
            'expires_at', fi.expires_at,
            'created_date', fi.created_date
        ) ORDER BY fi.created_date DESC)
        INTO v_invites
        FROM public.family_invites fi
        WHERE fi.family_group_id = v_family_group_id
        AND fi.is_active = true
        AND fi.expires_at > now();
    ELSE
        v_invites := '[]'::jsonb;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'has_family', true,
        'is_owner', v_is_owner,
        'family_group', jsonb_build_object(
            'id', v_family_group.id,
            'name', v_family_group.name,
            'share_all_lists', v_family_group.share_all_lists,
            'credits_used_this_month', v_family_group.credits_used_this_month,
            'created_date', v_family_group.created_date
        ),
        'members', COALESCE(v_members, '[]'::jsonb),
        'invites', COALESCE(v_invites, '[]'::jsonb),
        'max_family_members', v_tier.max_family_members
    );
END;
$$;

COMMENT ON FUNCTION public.get_family_info IS 'Returns complete family group information for current user';
GRANT EXECUTE ON FUNCTION public.get_family_info() TO authenticated;

-- ===========================================
-- FUNCTION: Update Family Settings
-- Update family group settings (name, share_all_lists)
-- ===========================================
CREATE OR REPLACE FUNCTION public.update_family_settings(
    p_name text DEFAULT NULL,
    p_share_all_lists boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_family_group RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_authenticated'
        );
    END IF;
    
    -- Get user's family group (must be owner)
    SELECT * INTO v_family_group
    FROM public.family_groups
    WHERE owner_id = v_user_id;
    
    IF v_family_group IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_owner',
            'message', 'Only the family owner can update settings'
        );
    END IF;
    
    -- Update settings
    UPDATE public.family_groups
    SET name = COALESCE(p_name, name),
        share_all_lists = COALESCE(p_share_all_lists, share_all_lists),
        updated_date = now()
    WHERE id = v_family_group.id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Settings updated successfully'
    );
END;
$$;

COMMENT ON FUNCTION public.update_family_settings IS 'Updates family group settings';
GRANT EXECUTE ON FUNCTION public.update_family_settings(text, boolean) TO authenticated;

-- ===========================================
-- FUNCTION: Delete Family Group
-- Deletes the family group and removes all members
-- ===========================================
CREATE OR REPLACE FUNCTION public.delete_family_group()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_family_group RECORD;
    v_member_ids uuid[];
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_authenticated'
        );
    END IF;
    
    -- Get user's family group (must be owner)
    SELECT * INTO v_family_group
    FROM public.family_groups
    WHERE owner_id = v_user_id;
    
    IF v_family_group IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_owner',
            'message', 'Only the family owner can delete the group'
        );
    END IF;
    
    -- Get all member IDs to update their profiles
    SELECT array_agg(user_id) INTO v_member_ids
    FROM public.family_members
    WHERE family_group_id = v_family_group.id;
    
    -- Update all member profiles to remove family_group_id
    UPDATE public.profiles
    SET family_group_id = NULL,
        updated_date = now()
    WHERE id = ANY(v_member_ids);
    
    -- Delete family group (cascades to members and invites)
    DELETE FROM public.family_groups WHERE id = v_family_group.id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Family group deleted successfully'
    );
END;
$$;

COMMENT ON FUNCTION public.delete_family_group IS 'Deletes the family group (owner only)';
GRANT EXECUTE ON FUNCTION public.delete_family_group() TO authenticated;

-- ===========================================
-- FUNCTION: Reset Family Credits (for billing cycle)
-- Called by webhooks when subscription renews
-- ===========================================
CREATE OR REPLACE FUNCTION public.reset_family_credits(p_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.family_groups
    SET credits_used_this_month = 0,
        updated_date = now()
    WHERE owner_id = p_owner_id;
END;
$$;

COMMENT ON FUNCTION public.reset_family_credits IS 'Resets family credit usage (called by billing webhooks)';
-- Only service role should call this
GRANT EXECUTE ON FUNCTION public.reset_family_credits(uuid) TO service_role;

-- ===========================================
-- FUNCTION: Sync Family Member Tiers
-- Called when owner subscription changes
-- Updates all family members to match owner tier
-- ===========================================
CREATE OR REPLACE FUNCTION public.sync_family_member_tiers(p_owner_id uuid, p_new_tier text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_family_group_id uuid;
BEGIN
    -- Get owner's family group
    SELECT id INTO v_family_group_id
    FROM public.family_groups
    WHERE owner_id = p_owner_id;
    
    IF v_family_group_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Update all approved family members' tiers
    UPDATE public.profiles
    SET subscription_tier = p_new_tier,
        updated_date = now()
    WHERE id IN (
        SELECT user_id FROM public.family_members
        WHERE family_group_id = v_family_group_id
        AND status = 'approved'
    );
END;
$$;

COMMENT ON FUNCTION public.sync_family_member_tiers IS 'Syncs family member tiers when owner subscription changes';
-- Only service role should call this
GRANT EXECUTE ON FUNCTION public.sync_family_member_tiers(uuid, text) TO service_role;

-- ===========================================
-- COMPLETE!
-- ===========================================

