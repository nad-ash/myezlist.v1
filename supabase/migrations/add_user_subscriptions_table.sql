-- ===========================================
-- Migration: Add unified user_subscriptions table
-- Supports multiple payment providers: Stripe, Apple IAP, Google Play
-- ===========================================

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL UNIQUE,
    
    -- Payment provider: 'stripe', 'apple', 'google'
    payment_provider text NOT NULL DEFAULT 'stripe',
    
    -- Subscription status
    status text NOT NULL DEFAULT 'inactive',
    tier text NOT NULL DEFAULT 'free',
    
    -- Provider-specific IDs
    stripe_customer_id text,
    stripe_subscription_id text,
    apple_original_transaction_id text,
    google_purchase_token text,
    
    -- Product/plan info
    product_id text,
    price_id text,
    
    -- Period dates
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    
    -- Cancellation info
    cancelled_at timestamp with time zone,
    cancel_reason text,
    
    -- Trial info
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    -- Constraints
    CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT user_subscriptions_provider_check CHECK (payment_provider IN ('stripe', 'apple', 'google')),
    CONSTRAINT user_subscriptions_status_check CHECK (status IN ('active', 'inactive', 'cancelled', 'expired', 'billing_issue', 'trialing', 'past_due'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_provider_idx ON public.user_subscriptions(payment_provider);
CREATE INDEX IF NOT EXISTS user_subscriptions_status_idx ON public.user_subscriptions(status);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own subscription
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything (for webhooks)
CREATE POLICY "Service role has full access" ON public.user_subscriptions
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comment
COMMENT ON TABLE public.user_subscriptions IS 'Unified subscription tracking for Stripe, Apple IAP, and Google Play';
COMMENT ON COLUMN public.user_subscriptions.payment_provider IS 'Payment provider: stripe, apple, or google';
COMMENT ON COLUMN public.user_subscriptions.status IS 'Subscription status: active, inactive, cancelled, expired, billing_issue, trialing, past_due';

-- ===========================================
-- Function to get user subscription status
-- Returns unified subscription info regardless of provider
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_subscription_status(uuid) TO authenticated;

