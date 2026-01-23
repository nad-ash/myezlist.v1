/**
 * RevenueCat Service
 * 
 * Handles in-app purchases for iOS (Apple IAP) and Android (Google Play).
 * RevenueCat provides a unified API for both platforms and handles:
 * - Receipt validation
 * - Subscription management
 * - Entitlement tracking
 * - Webhooks for subscription events
 * 
 * SETUP REQUIRED:
 * 1. Create a RevenueCat account at https://www.revenuecat.com/
 * 2. Add your iOS app in App Store Connect
 * 3. Add your Android app in Google Play Console
 * 4. Configure products in RevenueCat dashboard
 * 5. Add your RevenueCat API keys below
 */

import { isNativeApp, isIOS, isAndroid } from '@/utils/paymentPlatform';

// RevenueCat API keys - Replace with your actual keys from RevenueCat dashboard
// These are public keys and safe to include in client code
const REVENUECAT_API_KEYS = {
  apple: import.meta.env.VITE_REVENUECAT_APPLE_API_KEY || '',
  google: import.meta.env.VITE_REVENUECAT_GOOGLE_API_KEY || ''
};

// Product IDs configured in Google Play Console
// These must match EXACTLY what you've created in Play Console
export const PRODUCT_IDS = {
  ADFREE_MONTHLY: 'myezlist_adfree_monthly',
  PRO_MONTHLY: 'myezlist_pro_monthly',
  PREMIUM_MONTHLY: 'myezlist_premium_monthly'
};

// Entitlement IDs configured in RevenueCat
// These map products to access levels in your app
export const ENTITLEMENTS = {
  ADFREE: 'adfree',
  PRO: 'pro',
  PREMIUM: 'premium'
};

let Purchases = null;
let isInitialized = false;

/**
 * Initialize RevenueCat SDK
 * Should be called once when the app starts
 * @param {string} userId - Optional user ID to identify the customer
 */
export async function initializeRevenueCat(userId = null) {
  if (!isNativeApp()) {
    console.log('📦 RevenueCat: Not initializing - not running in native app');
    return false;
  }

  if (isInitialized) {
    console.log('📦 RevenueCat: Already initialized');
    return true;
  }

  try {
    // Dynamic import for native-only functionality
    const PurchasesModule = await import('@revenuecat/purchases-capacitor');
    Purchases = PurchasesModule.Purchases;

    const apiKey = isIOS() ? REVENUECAT_API_KEYS.apple : REVENUECAT_API_KEYS.google;

    if (!apiKey) {
      console.error('📦 RevenueCat: API key not configured for this platform');
      return false;
    }

    await Purchases.configure({
      apiKey,
      appUserID: userId // Optional: link to your user ID
    });

    isInitialized = true;
    console.log('📦 RevenueCat: Initialized successfully');
    return true;
  } catch (error) {
    console.error('📦 RevenueCat: Failed to initialize', error);
    return false;
  }
}

/**
 * Get available subscription products
 * @returns {Promise<Array>} Array of available products
 */
export async function getProducts() {
  if (!Purchases) {
    console.warn('📦 RevenueCat: Not initialized');
    return [];
  }

  try {
    const offerings = await Purchases.getOfferings();
    
    if (offerings.current && offerings.current.availablePackages.length > 0) {
      return offerings.current.availablePackages.map(pkg => ({
        id: pkg.identifier,
        productId: pkg.product.identifier,
        title: pkg.product.title,
        description: pkg.product.description,
        price: pkg.product.priceString,
        priceValue: pkg.product.price,
        currency: pkg.product.currencyCode,
        packageType: pkg.packageType,
        // Period info
        subscriptionPeriod: pkg.product.subscriptionPeriod,
        introPrice: pkg.product.introPrice
      }));
    }
    
    return [];
  } catch (error) {
    console.error('📦 RevenueCat: Failed to get products', error);
    throw error;
  }
}

/**
 * Purchase a subscription package
 * @param {string} packageId - The package identifier to purchase
 * @returns {Promise<Object>} Purchase result with customer info
 */
export async function purchasePackage(packageId) {
  if (!Purchases) {
    throw new Error('RevenueCat not initialized');
  }

  try {
    const offerings = await Purchases.getOfferings();
    const packageToPurchase = offerings.current?.availablePackages.find(
      pkg => pkg.identifier === packageId
    );

    if (!packageToPurchase) {
      throw new Error(`Package ${packageId} not found`);
    }

    const { customerInfo } = await Purchases.purchasePackage({ 
      aPackage: packageToPurchase 
    });

    // Check which tier the user now has access to
    const activeEntitlements = customerInfo.entitlements.active;
    const hasPremium = activeEntitlements[ENTITLEMENTS.PREMIUM] !== undefined;
    const hasPro = activeEntitlements[ENTITLEMENTS.PRO] !== undefined;
    const hasAdfree = activeEntitlements[ENTITLEMENTS.ADFREE] !== undefined;
    
    // Determine the active tier (highest wins)
    let activeTier = 'free';
    let expirationDate = null;
    if (hasPremium) {
      activeTier = 'premium';
      expirationDate = activeEntitlements[ENTITLEMENTS.PREMIUM]?.expirationDate;
    } else if (hasPro) {
      activeTier = 'pro';
      expirationDate = activeEntitlements[ENTITLEMENTS.PRO]?.expirationDate;
    } else if (hasAdfree) {
      activeTier = 'adfree';
      expirationDate = activeEntitlements[ENTITLEMENTS.ADFREE]?.expirationDate;
    }

    return {
      success: true,
      isPremium: hasPremium,
      isPro: hasPro,
      isAdfree: hasAdfree,
      activeTier,
      customerInfo,
      expirationDate
    };
  } catch (error) {
    // Handle user cancellation gracefully
    if (error.userCancelled) {
      return {
        success: false,
        cancelled: true,
        error: 'Purchase cancelled'
      };
    }
    
    console.error('📦 RevenueCat: Purchase failed', error);
    throw error;
  }
}

/**
 * Restore previous purchases
 * Useful when user reinstalls the app or switches devices
 * @returns {Promise<Object>} Customer info with restored purchases
 */
export async function restorePurchases() {
  if (!Purchases) {
    throw new Error('RevenueCat not initialized');
  }

  try {
    const { customerInfo } = await Purchases.restorePurchases();
    
    // Check which tier the user has access to
    const activeEntitlements = customerInfo.entitlements.active;
    const hasPremium = activeEntitlements[ENTITLEMENTS.PREMIUM] !== undefined;
    const hasPro = activeEntitlements[ENTITLEMENTS.PRO] !== undefined;
    const hasAdfree = activeEntitlements[ENTITLEMENTS.ADFREE] !== undefined;
    
    // Determine the active tier (highest wins)
    let activeTier = 'free';
    let expirationDate = null;
    if (hasPremium) {
      activeTier = 'premium';
      expirationDate = activeEntitlements[ENTITLEMENTS.PREMIUM]?.expirationDate;
    } else if (hasPro) {
      activeTier = 'pro';
      expirationDate = activeEntitlements[ENTITLEMENTS.PRO]?.expirationDate;
    } else if (hasAdfree) {
      activeTier = 'adfree';
      expirationDate = activeEntitlements[ENTITLEMENTS.ADFREE]?.expirationDate;
    }

    return {
      success: true,
      isPremium: hasPremium,
      isPro: hasPro,
      isAdfree: hasAdfree,
      activeTier,
      customerInfo,
      expirationDate
    };
  } catch (error) {
    console.error('📦 RevenueCat: Restore failed', error);
    throw error;
  }
}

/**
 * Get current customer subscription status
 * @returns {Promise<Object>} Customer info and active entitlements
 */
export async function getCustomerInfo() {
  if (!Purchases) {
    throw new Error('RevenueCat not initialized');
  }

  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    
    // Check which tier the user has access to
    const activeEntitlements = customerInfo.entitlements.active;
    const hasPremium = activeEntitlements[ENTITLEMENTS.PREMIUM] !== undefined;
    const hasPro = activeEntitlements[ENTITLEMENTS.PRO] !== undefined;
    const hasAdfree = activeEntitlements[ENTITLEMENTS.ADFREE] !== undefined;
    
    // Determine the active tier (highest wins)
    let activeTier = 'free';
    if (hasPremium) {
      activeTier = 'premium';
    } else if (hasPro) {
      activeTier = 'pro';
    } else if (hasAdfree) {
      activeTier = 'adfree';
    }
    
    return {
      isPremium: hasPremium,
      isPro: hasPro,
      isAdfree: hasAdfree,
      activeTier,
      entitlements: activeEntitlements,
      managementUrl: customerInfo.managementURL,
      originalAppUserId: customerInfo.originalAppUserId,
      latestExpirationDate: customerInfo.latestExpirationDate,
      allExpirationDates: customerInfo.allExpirationDates
    };
  } catch (error) {
    console.error('📦 RevenueCat: Failed to get customer info', error);
    throw error;
  }
}

/**
 * Identify a user with RevenueCat
 * Links purchases to your app's user ID
 * @param {string} userId - Your app's user ID
 */
export async function identifyUser(userId) {
  if (!Purchases) {
    console.warn('📦 RevenueCat: Not initialized, cannot identify user');
    return;
  }

  try {
    await Purchases.logIn({ appUserID: userId });
    console.log('📦 RevenueCat: User identified', userId);
  } catch (error) {
    console.error('📦 RevenueCat: Failed to identify user', error);
  }
}

/**
 * Log out the current user
 * Creates a new anonymous user
 */
export async function logoutUser() {
  if (!Purchases) {
    return;
  }

  try {
    await Purchases.logOut();
    console.log('📦 RevenueCat: User logged out');
  } catch (error) {
    console.error('📦 RevenueCat: Failed to log out', error);
  }
}

/**
 * Check if user has an active premium subscription
 * @returns {Promise<boolean>} True if user has active premium
 */
export async function hasPremiumAccess() {
  try {
    const info = await getCustomerInfo();
    return info.isPremium;
  } catch (error) {
    return false;
  }
}

export default {
  initializeRevenueCat,
  getProducts,
  purchasePackage,
  restorePurchases,
  getCustomerInfo,
  identifyUser,
  logoutUser,
  hasPremiumAccess,
  PRODUCT_IDS,
  ENTITLEMENTS
};

