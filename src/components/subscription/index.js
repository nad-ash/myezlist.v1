/**
 * Subscription Components
 * 
 * Platform-aware subscription management for:
 * - iOS (Apple In-App Purchase)
 * - Android (Google Play)
 * - Web (Stripe)
 */

export { default as SubscriptionManager, usePaymentPlatform } from './SubscriptionManager';
export { default as NativeSubscription } from './NativeSubscription';

