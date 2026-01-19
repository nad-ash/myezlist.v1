/**
 * Subscription Manager Component
 * 
 * Routes to the appropriate subscription UI based on the current platform:
 * - iOS → Apple In-App Purchase (via RevenueCat)
 * - Android → Google Play (via RevenueCat)
 * - Web → Stripe Checkout
 * 
 * This enables a unified codebase with platform-specific payment flows.
 * Apple and Google take 15-30% commission on native app purchases,
 * while Stripe takes ~3% for web purchases.
 */

import React, { useEffect, useState } from 'react';
import { getPaymentPlatform, isNativeApp, getPlatformName } from '@/utils/paymentPlatform';
import NativeSubscription from './NativeSubscription';
import { logger } from '@/utils/logger';

/**
 * SubscriptionManager - Platform-aware subscription component
 * 
 * @param {Object} props
 * @param {Object} props.user - Current user object
 * @param {string} props.currentTier - Current subscription tier ('free', 'premium', etc.)
 * @param {Function} props.onUpgrade - Callback when upgrade is successful
 * @param {React.Component} props.stripeComponent - Stripe subscription component to render on web
 * @param {Object} props.stripeProps - Props to pass to the Stripe component
 */
export default function SubscriptionManager({ 
  user, 
  currentTier, 
  onUpgrade,
  stripeComponent: StripeComponent,
  stripeProps = {}
}) {
  const [platform, setPlatform] = useState('stripe');

  useEffect(() => {
    const detectedPlatform = getPaymentPlatform();
    setPlatform(detectedPlatform);
    logger.info(`📱 Payment platform detected: ${detectedPlatform} (${getPlatformName()})`);
  }, []);

  const handleNativeUpgrade = async (result) => {
    if (result.success) {
      logger.success(`Subscription upgraded via ${result.provider}`);
      
      // Sync the subscription status to your backend
      // This is important for unified subscription tracking
      try {
        await syncNativeSubscription(user?.id, result);
      } catch (error) {
        console.error('Failed to sync subscription to backend:', error);
      }
      
      onUpgrade?.(result);
    }
  };

  // iOS or Android → Use native IAP
  if (platform === 'apple' || platform === 'google') {
    return (
      <NativeSubscription
        user={user}
        currentTier={currentTier}
        onUpgrade={handleNativeUpgrade}
      />
    );
  }

  // Web → Use provided Stripe component
  if (StripeComponent) {
    return <StripeComponent {...stripeProps} />;
  }

  // Fallback if no Stripe component provided
  return (
    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
      <p>Subscription options not available</p>
    </div>
  );
}

/**
 * Sync native subscription to backend
 * This allows your backend to know about subscriptions made via Apple/Google
 * 
 * @param {string} userId - User ID
 * @param {Object} subscriptionData - Subscription info from native purchase
 */
async function syncNativeSubscription(userId, subscriptionData) {
  if (!userId) return;

  try {
    // Import supabase dynamically to avoid circular deps
    const { supabase } = await import('@/api/supabaseClient');
    
    // Call Edge Function to sync the subscription
    const { error } = await supabase.functions.invoke('sync-native-subscription', {
      body: {
        userId,
        provider: subscriptionData.provider,
        expirationDate: subscriptionData.expirationDate,
        restored: subscriptionData.restored || false
      }
    });

    if (error) {
      console.error('Error syncing native subscription:', error);
    }
  } catch (error) {
    console.error('Failed to sync native subscription:', error);
  }
}

/**
 * Hook to get the current payment platform
 * Can be used in other components that need platform-aware logic
 */
export function usePaymentPlatform() {
  const [platform, setPlatform] = useState('stripe');
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setPlatform(getPaymentPlatform());
    setIsNative(isNativeApp());
  }, []);

  return { platform, isNative };
}

