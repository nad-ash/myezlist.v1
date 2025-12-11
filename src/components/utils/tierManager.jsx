import { User, SubscriptionTier } from "@/api/entities";
import { appCache } from "./appCache";

/**
 * Get user's current tier information, limits, and usage
 * Uses cache to minimize API calls
 */
export async function getUserTierInfo() {
  try {
    // Check cache first for user
    let user = appCache.getUser();
    if (!user) {
      console.log('🔄 tierManager: Fetching user from API (cache miss)');
      user = await User.me();
      appCache.setUser(user);
    } else {
      console.log('📦 tierManager: Using cached user data');
    }
    
    // Check cache first for subscription tiers
    let allTiers = appCache.getSubscriptionTiers();
    if (!allTiers) {
      console.log('🔄 tierManager: Fetching subscription tiers from API (cache miss)');
      allTiers = await SubscriptionTier.list();
      appCache.setSubscriptionTiers(allTiers);
    } else {
      console.log('📦 tierManager: Using cached subscription tiers');
    }

    const userTierName = user.subscription_tier || 'free';
    const tier = allTiers.find(t => t.tier_name === userTierName);

    if (!tier) {
      throw new Error(`Tier ${userTierName} not found`);
    }

    // Calculate credit usage
    const creditsTotal = user.monthly_credits_total || tier.monthly_credits;
    const creditsUsed = user.credits_used_this_month || 0;
    const creditsRemaining = Math.max(0, creditsTotal - creditsUsed);
    const creditsPercentage = creditsTotal > 0 ? Math.round((creditsRemaining / creditsTotal) * 100) : 0;

    // If user's credits don't match tier config, update them
    if (creditsTotal !== tier.monthly_credits) {
      const updates = { monthly_credits_total: tier.monthly_credits };
      await User.updateMe(updates);
      appCache.updateUser(updates);
    }

    return {
      user,
      tier,
      limits: {
        maxShoppingLists: tier.max_shopping_lists || 5,
        maxTotalItems: tier.max_total_items || 50,
        maxTasks: tier.max_tasks || 20,
        maxCustomRecipes: tier.max_custom_recipes || 5,
        monthlyCredits: tier.monthly_credits || 10,
        hasAds: tier.has_ads !== false,
        allowedThemes: Array.isArray(tier.allowed_themes) ? tier.allowed_themes : ['default'],
        themeRestrictionDuration: tier.theme_restriction_duration || 0
      },
      usage: {
        creditsTotal,
        creditsUsed,
        creditsRemaining,
        creditsPercentage,
      },
    };
  } catch (error) {
    console.error("Error getting user tier info:", error);
    throw error;
  }
}

/**
 * Check if user can create a new shopping list
 */
export async function canCreateShoppingList() {
  try {
    // Force fresh user data by clearing cache first
    appCache.clearUser();
    
    const { limits, user } = await getUserTierInfo();
    
    // Use user's current_shopping_lists count (which is kept in sync via incrementUsage/decrementUsage)
    const currentListCount = user.current_shopping_lists || 0;
    
    const canCreate = currentListCount < limits.maxShoppingLists;
    
    return {
      canCreate,
      currentCount: currentListCount,
      limit: limits.maxShoppingLists,
      message: canCreate 
        ? null 
        : `You've reached your limit of ${limits.maxShoppingLists} shopping lists. Upgrade your plan to create more lists.`
    };
  } catch (error) {
    console.error("Error checking shopping list limit:", error);
    return {
      canCreate: false,
      message: "Unable to verify shopping list limit. Please try again."
    };
  }
}

/**
 * Check if user can add a new item to a shopping list
 */
export async function canAddItem() {
  try {
    // Force fresh user data by clearing cache first
    appCache.clearUser();
    
    const { limits, user } = await getUserTierInfo();
    
    // Use user's current_total_items count (which is kept in sync via incrementUsage/decrementUsage)
    const currentItemCount = user.current_total_items || 0;
    
    const canAdd = currentItemCount < limits.maxTotalItems;
    
    return {
      canAdd,
      currentCount: currentItemCount,
      limit: limits.maxTotalItems,
      message: canAdd 
        ? null 
        : `You've reached your limit of ${limits.maxTotalItems} total items across all lists. Upgrade your plan to add more items.`
    };
  } catch (error) {
    console.error("Error checking item limit:", error);
    return {
      canAdd: false,
      message: "Unable to verify item limit. Please try again."
    };
  }
}

/**
 * Check if user can create a new task
 */
export async function canCreateTask() {
  try {
    // Force fresh user data by clearing cache first
    appCache.clearUser();
    
    const { limits, user } = await getUserTierInfo();
    
    // Use user's current_tasks count (which is kept in sync via incrementUsage/decrementUsage)
    const currentTaskCount = user.current_tasks || 0;
    
    const canCreate = currentTaskCount < limits.maxTasks;
    
    return {
      canCreate,
      currentCount: currentTaskCount,
      limit: limits.maxTasks,
      message: canCreate 
        ? null 
        : `You've reached your limit of ${limits.maxTasks} tasks. Upgrade your plan to create more tasks.`
    };
  } catch (error) {
    console.error("Error checking task limit:", error);
    return {
      canCreate: false,
      message: "Unable to verify task limit. Please try again."
    };
  }
}

/**
 * Check if user can create a new custom recipe
 */
export async function canCreateCustomRecipe() {
  try {
    // Force fresh user data by clearing cache first
    appCache.clearUser();
    
    const { limits, user } = await getUserTierInfo();
    
    // Use user's current_custom_recipes count (which is kept in sync via incrementUsage/decrementUsage)
    const currentRecipeCount = user.current_custom_recipes || 0;
    
    const canCreate = currentRecipeCount < limits.maxCustomRecipes;
    
    return {
      canCreate,
      currentCount: currentRecipeCount,
      limit: limits.maxCustomRecipes,
      message: canCreate 
        ? null 
        : `You've reached your limit of ${limits.maxCustomRecipes} custom recipes. Upgrade your plan to create more recipes.`
    };
  } catch (error) {
    console.error("Error checking recipe limit:", error);
    return {
      canCreate: false,
      message: "Unable to verify recipe limit. Please try again."
    };
  }
}

/**
 * Check if user can access a specific theme
 */
export async function canAccessTheme(themeName) {
  try {
    const { tier, user } = await getUserTierInfo();
    
    // ADMIN BYPASS: Admins have access to all themes
    if (user.role === 'admin') {
      return { canAccess: true };
    }
    
    // Default theme is always accessible
    if (themeName === 'default') {
      return { canAccess: true };
    }
    
    // Check if there's a time restriction - do this BEFORE checking allowed themes
    const restrictionMonths = tier.theme_restriction_duration || 0;
    
    if (restrictionMonths > 0 && user.subscription_start_date) {
      const subscriptionStart = new Date(user.subscription_start_date);
      const monthsSinceStart = Math.floor((Date.now() - subscriptionStart.getTime()) / (1000 * 60 * 60 * 24 * 30));
      
      // User is still within grace period - allow all themes
      if (monthsSinceStart < restrictionMonths) {
        return { canAccess: true };
      }
    }
    
    // After grace period, check tier's allowed themes
    const allowedThemes = Array.isArray(tier.allowed_themes) ? tier.allowed_themes : ['default'];
    const isThemeAllowed = allowedThemes.includes(themeName);
    
    if (!isThemeAllowed) {
      return {
        canAccess: false,
        message: `The ${themeName} theme is not available in your current plan. Upgrade to access this theme.`
      };
    }
    
    return { canAccess: true };
  } catch (error) {
    console.error("Error checking theme access:", error);
    return {
      canAccess: false,
      message: "Unable to verify theme access. Please try again."
    };
  }
}

/**
 * Get available upgrade tiers for the current user
 */
export async function getAvailableUpgrades() {
  try {
    const { tier } = await getUserTierInfo();
    
    // Use cached tiers first
    let allTiers = appCache.getSubscriptionTiers();
    
    // If cache is empty, fetch from API
    if (!allTiers || !Array.isArray(allTiers)) {
      console.log('🔄 getAvailableUpgrades: Fetching subscription tiers from API');
      allTiers = await SubscriptionTier.list();
      
      // Validate the fetched data
      if (!allTiers || !Array.isArray(allTiers)) {
        console.error('Invalid subscription tiers data received:', allTiers);
        return [];
      }
      
      appCache.setSubscriptionTiers(allTiers);
    } else {
      console.log('📦 getAvailableUpgrades: Using cached subscription tiers');
    }
    
    // Filter out current tier, admin tier, and tiers below current
    const upgrades = allTiers
      .filter(t => {
        if (!t || typeof t !== 'object') return false;
        return (
          t.tier_name !== 'admin' && 
          t.tier_name !== tier.tier_name &&
          (t.sort_order || 0) > (tier.sort_order || 0)
        );
      })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    
    return upgrades;
  } catch (error) {
    console.error("Error getting available upgrades:", error);
    return [];
  }
}