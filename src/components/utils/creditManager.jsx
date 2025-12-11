import { User, UserAdmin, PremiumFeature, CreditTransaction } from "@/api/entities";
import { appCache } from "./appCache";

/**
 * Check if user has enough credits for a premium feature
 * @param {string} featureKey - The unique key of the premium feature
 * @returns {Promise<{hasCredits: boolean, creditsNeeded: number, creditsAvailable: number, message?: string}>}
 */
export async function checkCreditsAvailable(featureKey) {
  try {
    // Get feature details
    const features = await PremiumFeature.list();
    const feature = features.find(f => f.feature_key === featureKey && f.is_active);
    
    if (!feature) {
      throw new Error(`Feature ${featureKey} not found or is inactive`);
    }
    
    // Check cache first for user
    let user = appCache.getUser();
    if (!user) {
      console.log('🔄 creditManager: Fetching user from API (cache miss)');
      user = await User.me();
      appCache.setUser(user);
    } else {
      console.log('📦 creditManager: Using cached user data');
    }
    
    const creditsUsed = user.credits_used_this_month || 0;
    const creditsTotal = user.monthly_credits_total || 0;
    const creditsAvailable = Math.max(0, creditsTotal - creditsUsed);
    
    const hasCredits = creditsAvailable >= feature.credits_per_use;
    
    if (!hasCredits) {
      return {
        hasCredits: false,
        creditsNeeded: feature.credits_per_use,
        creditsAvailable,
        message: `This feature requires ${feature.credits_per_use} credits, but you only have ${creditsAvailable} remaining. Upgrade your plan or wait for your monthly credit reset.`
      };
    }
    
    return {
      hasCredits: true,
      creditsNeeded: feature.credits_per_use,
      creditsAvailable
    };
  } catch (error) {
    console.error("Error checking credits:", error);
    throw error;
  }
}

/**
 * Consume credits for a premium feature
 * @param {string} featureKey - The unique key of the premium feature
 * @param {string} description - Description of what the credits were used for
 * @param {object} metadata - Additional metadata about the transaction
 * @returns {Promise<{success: boolean, remainingCredits: number, message?: string}>}
 */
export async function consumeCredits(featureKey, description, metadata = {}) {
  try {
    // Get feature details
    const features = await PremiumFeature.list();
    const feature = features.find(f => f.feature_key === featureKey && f.is_active);
    
    if (!feature) {
      throw new Error(`Feature ${featureKey} not found or is inactive`);
    }
    
    // Check cache first for user - IMPORTANT: Get fresh data for credit consumption
    let user = appCache.getUser();
    if (!user) {
      console.log('🔄 creditManager: Fetching user from API (cache miss)');
      user = await User.me();
      appCache.setUser(user);
    } else {
      console.log('📦 creditManager: Using cached user data for credit check');
    }
    
    const creditsUsed = user.credits_used_this_month || 0;
    const creditsTotal = user.monthly_credits_total || 0;
    const creditsAvailable = Math.max(0, creditsTotal - creditsUsed);
    
    // Check if user has enough credits
    if (creditsAvailable < feature.credits_per_use) {
      return {
        success: false,
        remainingCredits: creditsAvailable,
        message: `Insufficient credits. This feature requires ${feature.credits_per_use} credits, but you only have ${creditsAvailable} remaining.`
      };
    }
    
    // Update user's credit usage
    const newCreditsUsed = creditsUsed + feature.credits_per_use;
    const updates = {
      credits_used_this_month: newCreditsUsed
    };
    
    await User.updateMe(updates);
    
    // CRITICAL: Invalidate user cache after credit consumption
    console.log('🔄 creditManager: Invalidating user cache after credit consumption');
    appCache.clearUser();
    
    // Fetch fresh user data and cache it
    const updatedUser = await User.me();
    appCache.setUser(updatedUser);
    
    // Log the transaction
    await CreditTransaction.create({
      user_id: user.id,
      user_email: user.email,
      feature_key: featureKey,
      feature_name: feature.display_name,
      credits_consumed: feature.credits_per_use,
      transaction_type: 'consumption',
      description: description,
      metadata: metadata
    });
    
    const remainingCredits = creditsTotal - newCreditsUsed;
    
    return {
      success: true,
      remainingCredits: Math.max(0, remainingCredits),
      message: `Successfully used ${feature.credits_per_use} credits. You have ${Math.max(0, remainingCredits)} credits remaining.`
    };
  } catch (error) {
    console.error("Error consuming credits:", error);
    throw error;
  }
}

/**
 * Refund credits for a premium feature (admin or error correction)
 * @param {string} userId - User ID to refund credits to
 * @param {string} featureKey - The unique key of the premium feature
 * @param {number} creditsAmount - Number of credits to refund
 * @param {string} reason - Reason for the refund
 * @returns {Promise<{success: boolean, newBalance: number}>}
 */
export async function refundCredits(userId, featureKey, creditsAmount, reason) {
  try {
    // Get feature details for logging
    const features = await PremiumFeature.list();
    const feature = features.find(f => f.feature_key === featureKey);
    
    // Get user's current credit usage
    const users = await UserAdmin.list();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    
    const creditsUsed = user.credits_used_this_month || 0;
    const creditsTotal = user.monthly_credits_total || 0;
    
    // Calculate new credits used (can't go below 0)
    const newCreditsUsed = Math.max(0, creditsUsed - creditsAmount);
    
    // Update user's credit usage
    await UserAdmin.update(userId, {
      credits_used_this_month: newCreditsUsed
    });
    
    // CRITICAL: Invalidate user cache after refund
    console.log('🔄 creditManager: Invalidating user cache after credit refund');
    appCache.clearUser();
    
    // Log the refund transaction
    await CreditTransaction.create({
      user_id: userId,
      user_email: user.email,
      feature_key: featureKey,
      feature_name: feature?.display_name || 'Unknown Feature',
      credits_consumed: -creditsAmount, // Negative to indicate refund
      transaction_type: 'refund',
      description: `Refund: ${reason}`,
      metadata: { reason }
    });
    
    const newBalance = creditsTotal - newCreditsUsed;
    
    return {
      success: true,
      newBalance: Math.max(0, newBalance),
      message: `Successfully refunded ${creditsAmount} credits. New balance: ${Math.max(0, newBalance)}`
    };
  } catch (error) {
    console.error("Error refunding credits:", error);
    throw error;
  }
}

/**
 * Get user's credit transaction history
 * @param {number} limit - Number of recent transactions to retrieve
 * @returns {Promise<Array>}
 */
export async function getCreditHistory(limit = 50) {
  try {
    // Check cache first for user
    let user = appCache.getUser();
    if (!user) {
      user = await User.me();
      appCache.setUser(user);
    }
    
    const transactions = await CreditTransaction.filter(
      { user_id: user.id },
      '-created_date',
      limit
    );
    
    return transactions;
  } catch (error) {
    console.error("Error fetching credit history:", error);
    throw error;
  }
}

/**
 * Get all available premium features
 * @returns {Promise<Array>}
 */
export async function getPremiumFeatures() {
  try {
    const features = await PremiumFeature.filter({ is_active: true });
    return features;
  } catch (error) {
    console.error("Error fetching premium features:", error);
    throw error;
  }
}