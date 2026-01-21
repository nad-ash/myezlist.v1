-- Fix consume_family_credits to return is_family_pool in response
-- This fixes a bug where users not in a family group would see 
-- "Your family has X credits remaining" instead of "You have X credits remaining"

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
    v_is_family_pool boolean;
BEGIN
    -- Get current credits info (includes is_family_pool)
    v_credits_info := public.get_family_credits_remaining(p_user_id);
    v_is_family_pool := (v_credits_info->>'is_family_pool')::boolean;
    
    -- Check if enough credits
    IF (v_credits_info->>'credits_remaining')::integer < p_credits THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'insufficient_credits',
            'message', 'Not enough credits remaining',
            'is_family_pool', v_is_family_pool
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
        'credits_remaining', (v_credits_info->>'credits_remaining')::integer - p_credits,
        'is_family_pool', v_is_family_pool
    );
END;
$$;

COMMENT ON FUNCTION public.consume_family_credits IS 'Consumes credits from family pool or individual credits. Returns is_family_pool to indicate credit source.';

