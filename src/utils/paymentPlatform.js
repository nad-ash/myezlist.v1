/**
 * Payment Platform Detection Utility
 * 
 * Detects which platform the app is running on and returns the appropriate
 * payment provider to use:
 * - iOS App Store → Apple IAP (via RevenueCat)
 * - Android App Store → Google Play (via RevenueCat) or Stripe
 * - Web Browser → Stripe
 * 
 * This enables a unified codebase with platform-specific payment flows.
 */

/**
 * Get the payment platform based on the current runtime environment
 * @returns {'apple' | 'google' | 'stripe'} The payment platform to use
 */
export const getPaymentPlatform = () => {
  // Check if running in Capacitor native shell
  if (typeof window !== 'undefined' && window.Capacitor) {
    const platform = window.Capacitor.getPlatform();
    if (platform === 'ios') return 'apple';
    if (platform === 'android') return 'google'; // Can also return 'stripe' if you prefer
  }
  // Default to Stripe for web browsers
  return 'stripe';
};

/**
 * Check if the app is running as a native app (iOS or Android)
 * @returns {boolean} True if running in Capacitor native shell
 */
export const isNativeApp = () => {
  return typeof window !== 'undefined' && 
         window.Capacitor && 
         window.Capacitor.isNativePlatform();
};

/**
 * Check if the app is running on iOS
 * @returns {boolean} True if running on iOS
 */
export const isIOS = () => {
  return typeof window !== 'undefined' && 
         window.Capacitor && 
         window.Capacitor.getPlatform() === 'ios';
};

/**
 * Check if the app is running on Android
 * @returns {boolean} True if running on Android
 */
export const isAndroid = () => {
  return typeof window !== 'undefined' && 
         window.Capacitor && 
         window.Capacitor.getPlatform() === 'android';
};

/**
 * Check if the app is running in a web browser
 * @returns {boolean} True if running in web browser (not native)
 */
export const isWeb = () => {
  return !isNativeApp();
};

/**
 * Get descriptive name for current platform
 * @returns {string} Human-readable platform name
 */
export const getPlatformName = () => {
  if (isIOS()) return 'iOS';
  if (isAndroid()) return 'Android';
  return 'Web';
};

/**
 * Check if native in-app purchases are available
 * @returns {boolean} True if RevenueCat/IAP can be used
 */
export const hasNativeIAP = () => {
  return isIOS() || isAndroid();
};

export default {
  getPaymentPlatform,
  isNativeApp,
  isIOS,
  isAndroid,
  isWeb,
  getPlatformName,
  hasNativeIAP
};

