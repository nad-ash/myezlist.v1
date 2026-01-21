-- Fix delete_family_group() to properly reset member subscription tiers
-- 
-- ISSUE: When a family group is deleted, members retained their elevated 
-- premium/pro tier indefinitely because only family_group_id was cleared.
-- This allowed unauthorized access to premium features without a subscription.
--
-- FIX: Reset non-owner members to 'free' tier with default credits,
-- consistent with leave_family_group() and remove_family_member().
-- The owner keeps their own subscription tier (they paid for it).

CREATE OR REPLACE FUNCTION public.delete_family_group()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_family_group RECORD;
    v_member_ids uuid[];
    v_free_tier RECORD;
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
    
    -- Get free tier details for resetting members
    SELECT monthly_credits INTO v_free_tier
    FROM public.subscription_tiers
    WHERE tier_name = 'free';
    
    -- Get all member IDs (excluding owner) to reset their tiers
    SELECT array_agg(user_id) INTO v_member_ids
    FROM public.family_members
    WHERE family_group_id = v_family_group.id
    AND user_id != v_user_id;  -- Exclude owner - they keep their own tier
    
    -- Reset non-owner member profiles to free tier
    IF v_member_ids IS NOT NULL AND array_length(v_member_ids, 1) > 0 THEN
        UPDATE public.profiles
        SET family_group_id = NULL,
            subscription_tier = 'free',
            monthly_credits_total = COALESCE(v_free_tier.monthly_credits, 10),
            credits_used_this_month = 0,
            updated_date = now()
        WHERE id = ANY(v_member_ids);
    END IF;
    
    -- Update owner's profile to clear family_group_id (keep their own tier)
    UPDATE public.profiles
    SET family_group_id = NULL,
        updated_date = now()
    WHERE id = v_user_id;
    
    -- Delete family group (cascades to members and invites)
    DELETE FROM public.family_groups WHERE id = v_family_group.id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Family group deleted successfully'
    );
END;
$$;

COMMENT ON FUNCTION public.delete_family_group IS 'Deletes the family group (owner only). Resets non-owner members to free tier.';

