-- ===========================================
-- Migration: Fix get_user_subscription_status authorization
-- 
-- Security Fix: The function was accepting any p_user_id without
-- validating that the caller (auth.uid()) matches the requested user.
-- This allowed any authenticated user to query any other user's
-- subscription details.
--
-- Fix: Added authorization check that:
-- 1. Requires authentication (auth.uid() IS NOT NULL)
-- 2. Only allows users to query their own subscription
-- 3. Allows admin users to query any subscription (for User Management)
-- ===========================================

CREATE OR REPLACE FUNCTION public.get_user_subscription_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_subscription record;
    v_result jsonb;
BEGIN
    -- Security check: only allow users to query their own subscription (admins can query any)
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    
    IF auth.uid() != p_user_id AND NOT is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: cannot access another user''s subscription';
    END IF;
    
    -- Get subscription record
    SELECT * INTO v_subscription
    FROM public.user_subscriptions
    WHERE user_id = p_user_id;
    
    -- If no subscription record, check profiles table (for legacy Stripe data)
    IF v_subscription IS NULL THEN
        SELECT jsonb_build_object(
            'has_subscription', COALESCE(stripe_subscription_id IS NOT NULL, false),
            'provider', 'stripe',
            'status', COALESCE(stripe_subscription_status, 'inactive'),
            'tier', COALESCE(subscription_tier, 'free'),
            'is_premium', subscription_tier IN ('premium', 'pro'),
            'expires_at', subscription_end_date
        ) INTO v_result
        FROM public.profiles
        WHERE id = p_user_id;
        
        RETURN COALESCE(v_result, jsonb_build_object(
            'has_subscription', false,
            'provider', null,
            'status', 'inactive',
            'tier', 'free',
            'is_premium', false,
            'expires_at', null
        ));
    END IF;
    
    -- Return subscription info
    RETURN jsonb_build_object(
        'has_subscription', v_subscription.status IN ('active', 'trialing'),
        'provider', v_subscription.payment_provider,
        'status', v_subscription.status,
        'tier', v_subscription.tier,
        'is_premium', v_subscription.tier IN ('premium', 'pro'),
        'expires_at', v_subscription.current_period_end,
        'cancelled_at', v_subscription.cancelled_at,
        'product_id', v_subscription.product_id
    );
END;
$$;


