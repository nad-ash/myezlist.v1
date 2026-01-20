-- Fix race condition in consume_family_credits using SELECT FOR UPDATE
-- 
-- ISSUE: The previous implementation had a check-then-act race condition.
-- It read credits_remaining from get_family_credits_remaining(), checked if 
-- sufficient credits exist, then performed a separate UPDATE. Two concurrent 
-- transactions could both pass the check before either executes the UPDATE,
-- allowing the family pool to be over-consumed beyond zero remaining credits.
--
-- FIX: Use SELECT ... FOR UPDATE to acquire an exclusive row lock before 
-- reading credits. This serializes concurrent transactions on the same 
-- family group or profile row.

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
    v_monthly_credits integer;
    v_credits_used integer;
    v_credits_remaining integer;
    v_is_family_pool boolean;
BEGIN
    -- First, get the user's family group ID
    SELECT family_group_id INTO v_family_group_id
    FROM public.profiles
    WHERE id = p_user_id;
    
    IF v_family_group_id IS NOT NULL THEN
        -- FAMILY POOL: Lock the family_groups row and read current credits atomically
        v_is_family_pool := true;
        
        SELECT 
            st.monthly_credits,
            fg.credits_used_this_month,
            st.monthly_credits - fg.credits_used_this_month
        INTO v_monthly_credits, v_credits_used, v_credits_remaining
        FROM public.family_groups fg
        JOIN public.profiles p ON p.id = fg.owner_id
        JOIN public.subscription_tiers st ON st.tier_name = p.subscription_tier
        WHERE fg.id = v_family_group_id
        FOR UPDATE OF fg;  -- Lock this row to prevent concurrent modifications
        
        -- Check if enough credits (after acquiring lock)
        IF v_credits_remaining < p_credits THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'insufficient_credits',
                'message', 'Not enough credits remaining',
                'is_family_pool', v_is_family_pool,
                'credits_remaining', GREATEST(0, v_credits_remaining)
            );
        END IF;
        
        -- Atomically update - row is already locked
        UPDATE public.family_groups
        SET credits_used_this_month = credits_used_this_month + p_credits,
            updated_date = now()
        WHERE id = v_family_group_id;
        
    ELSE
        -- INDIVIDUAL: Lock the profiles row and read current credits atomically
        v_is_family_pool := false;
        
        SELECT 
            monthly_credits_total,
            credits_used_this_month,
            monthly_credits_total - credits_used_this_month
        INTO v_monthly_credits, v_credits_used, v_credits_remaining
        FROM public.profiles
        WHERE id = p_user_id
        FOR UPDATE;  -- Lock this row to prevent concurrent modifications
        
        -- Check if enough credits (after acquiring lock)
        IF v_credits_remaining < p_credits THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'insufficient_credits',
                'message', 'Not enough credits remaining',
                'is_family_pool', v_is_family_pool,
                'credits_remaining', GREATEST(0, v_credits_remaining)
            );
        END IF;
        
        -- Atomically update - row is already locked
        UPDATE public.profiles
        SET credits_used_this_month = credits_used_this_month + p_credits,
            updated_date = now()
        WHERE id = p_user_id;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'credits_consumed', p_credits,
        'credits_remaining', v_credits_remaining - p_credits,
        'is_family_pool', v_is_family_pool
    );
END;
$$;

COMMENT ON FUNCTION public.consume_family_credits IS 'Atomically consumes credits from family pool or individual. Uses row locking (SELECT FOR UPDATE) to prevent race conditions under concurrent load.';

