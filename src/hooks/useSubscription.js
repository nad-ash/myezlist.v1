/**
 * useSubscription Hook
 * 
 * Provides unified subscription status checking across all payment providers.
 * Works with Stripe (web), Apple IAP (iOS), and Google Play (Android).
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { isNativeApp, getPaymentPlatform } from '@/utils/paymentPlatform';
import { hasPremiumAccess as hasNativePremium, getCustomerInfo } from '@/services/revenueCatService';

/**
 * Hook to check user's subscription status
 * @param {Object} user - Current user object
 * @returns {Object} Subscription status and methods
 */
export function useSubscription(user) {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState({
    isPremium: false,
    tier: 'free',
    provider: null,
    status: 'inactive',
    expiresAt: null
  });

  const checkSubscription = useCallback(async () => {
    if (!user?.id) {
      setSubscription({
        isPremium: false,
        tier: 'free',
        provider: null,
        status: 'inactive',
        expiresAt: null
      });
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // For native apps, check RevenueCat first (source of truth for IAP)
      if (isNativeApp()) {
        try {
          const nativeInfo = await getCustomerInfo();
          if (nativeInfo.isPremium) {
            setSubscription({
              isPremium: true,
              tier: 'premium',
              provider: getPaymentPlatform(),
              status: 'active',
              expiresAt: nativeInfo.latestExpirationDate,
              managementUrl: nativeInfo.managementUrl
            });
            setLoading(false);
            return;
          }
        } catch (nativeError) {
          console.log('RevenueCat check failed, falling back to database:', nativeError);
        }
      }

      // Check database for subscription status (works for all providers)
      const { data, error } = await supabase.rpc('get_user_subscription_status', {
        p_user_id: user.id
      });

      if (error) {
        // Fallback to checking profile directly
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier, stripe_subscription_status, subscription_end_date')
          .eq('id', user.id)
          .single();

        if (profile) {
          const isPremium = profile.subscription_tier !== 'free';
          setSubscription({
            isPremium,
            tier: profile.subscription_tier || 'free',
            provider: isPremium ? 'stripe' : null,
            status: profile.stripe_subscription_status || 'inactive',
            expiresAt: profile.subscription_end_date
          });
        }
      } else if (data) {
        setSubscription({
          isPremium: data.is_premium || false,
          tier: data.tier || 'free',
          provider: data.provider,
          status: data.status || 'inactive',
          expiresAt: data.expires_at
        });
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  return {
    ...subscription,
    loading,
    refresh: checkSubscription,
    // Helper to check if user has access to premium features
    canUseFeature: (featureTier = 'premium') => {
      const tierOrder = ['free', 'adfree', 'pro', 'premium', 'admin'];
      const userTierIndex = tierOrder.indexOf(subscription.tier);
      const requiredIndex = tierOrder.indexOf(featureTier);
      return userTierIndex >= requiredIndex;
    }
  };
}

export default useSubscription;

