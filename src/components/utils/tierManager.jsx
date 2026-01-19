import { User, SubscriptionTier } from "@/api/entities";
import { appCache } from "./appCache";
import { getFamilyCreditsRemaining, getFamilyInfo, getUserResourceCounts } from "@/services/familyService";

/**
 * Get user's current tier information, limits, and usage
 * Uses cache to minimize API calls
 * Supports family credit pooling - uses family pool credits if user is in a family group
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

    // Get credit usage - use family pool if user is in a family group
    let creditsTotal, creditsUsed, creditsRemaining, creditsPercentage, isFamilyPool = false;
    let familyInfo = null;
    
    try {
      // Try to get family credits info (will return individual credits if not in a family)
      const creditsInfo = await getFamilyCreditsRemaining(user.id);
      console.log('👨‍👩‍👧‍👦 tierManager: Credits info:', creditsInfo);
      
      creditsTotal = creditsInfo.monthly_credits || tier.monthly_credits;
      creditsUsed = creditsInfo.credits_used || 0;
      creditsRemaining = creditsInfo.credits_remaining || 0;
      isFamilyPool = creditsInfo.is_family_pool || false;
      
      // If user is in a family pool, also get family info to determine if they're owner or member
      if (isFamilyPool) {
        try {
          familyInfo = await getFamilyInfo();
          console.log('👨‍👩‍👧‍👦 tierManager: Family info:', familyInfo);
        } catch (familyInfoError) {
          console.warn('👨‍👩‍👧‍👦 tierManager: Could not fetch family info:', familyInfoError);
        }
      }
    } catch (familyError) {
      // Fallback to individual credits if family check fails
      console.warn('👨‍👩‍👧‍👦 tierManager: Family credits check failed, using individual:', familyError);
      creditsTotal = user.monthly_credits_total || tier.monthly_credits;
      creditsUsed = user.credits_used_this_month || 0;
      creditsRemaining = Math.max(0, creditsTotal - creditsUsed);
    }
    
    creditsPercentage = creditsTotal > 0 ? Math.round((creditsRemaining / creditsTotal) * 100) : 0;

    // If user's credits don't match tier config, update them (only for non-family members)
    if (!isFamilyPool && (user.monthly_credits_total || tier.monthly_credits) !== tier.monthly_credits) {
      const updates = { monthly_credits_total: tier.monthly_credits };
      await User.updateMe(updates);
      appCache.updateUser(updates);
    }

    // Determine if user is a family member (not owner)
    const isFamilyMember = isFamilyPool && familyInfo?.has_family && !familyInfo?.is_owner;
    const isFamilyOwner = isFamilyPool && familyInfo?.has_family && familyInfo?.is_owner;

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
        isFamilyPool,
      },
      family: {
        isFamilyMember,
        isFamilyOwner,
        familyName: familyInfo?.family_group?.name || null,
      },
    };
  } catch (error) {
    console.error("Error getting user tier info:", error);
    throw error;
  }
}

/**
 * Check if user can create a new shopping list
 * Uses family-aware counts when user is in a family group
 */
export async function canCreateShoppingList() {
  try {
    // Force fresh user data by clearing cache first
    appCache.clearUser();
    
    const { limits, user, family } = await getUserTierInfo();
    
    let currentListCount;
    
    // If user is in a family, use family-aware resource counts
    if (family?.isFamilyMember || family?.isFamilyOwner) {
      try {
        const resourceCounts = await getUserResourceCounts(user.id);
        currentListCount = resourceCounts?.shopping_lists || 0;
        console.log('👨‍👩‍👧‍👦 tierManager: Using family-aware list count:', currentListCount);
      } catch (familyCountError) {
        console.warn('👨‍👩‍👧‍👦 tierManager: Failed to get family counts, using individual:', familyCountError);
        currentListCount = user.current_shopping_lists || 0;
      }
    } else {
      currentListCount = user.current_shopping_lists || 0;
    }
    
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
 * Uses family-aware counts when user is in a family group
 * @param {boolean} useCache - If true, use cached data for fast response (default: false for accuracy)
 */
export async function canAddItem(useCache = false) {
  try {
    // Only force fresh user data if not using cache
    if (!useCache) {
      appCache.clearUser();
    }
    
    const { limits, user, family } = await getUserTierInfo();
    
    let currentItemCount;
    
    // If user is in a family, use family-aware resource counts
    if (family?.isFamilyMember || family?.isFamilyOwner) {
      try {
        const resourceCounts = await getUserResourceCounts(user.id);
        currentItemCount = resourceCounts?.total_items || 0;
        console.log('👨‍👩‍👧‍👦 tierManager: Using family-aware item count:', currentItemCount);
      } catch (familyCountError) {
        console.warn('👨‍👩‍👧‍👦 tierManager: Failed to get family counts, using individual:', familyCountError);
        currentItemCount = user.current_total_items || 0;
      }
    } else {
      currentItemCount = user.current_total_items || 0;
    }
    
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
 * Uses family-aware counts when user is in a family group
 */
export async function canCreateTask() {
  try {
    // Force fresh user data by clearing cache first
    appCache.clearUser();
    
    const { limits, user, family } = await getUserTierInfo();
    
    let currentTaskCount;
    
    // If user is in a family, use family-aware resource counts
    if (family?.isFamilyMember || family?.isFamilyOwner) {
      try {
        const resourceCounts = await getUserResourceCounts(user.id);
        currentTaskCount = resourceCounts?.tasks || 0;
        console.log('👨‍👩‍👧‍👦 tierManager: Using family-aware task count:', currentTaskCount);
      } catch (familyCountError) {
        console.warn('👨‍👩‍👧‍👦 tierManager: Failed to get family counts, using individual:', familyCountError);
        currentTaskCount = user.current_tasks || 0;
      }
    } else {
      currentTaskCount = user.current_tasks || 0;
    }
    
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
 * Uses family-aware counts when user is in a family group
 */
export async function canCreateCustomRecipe() {
  try {
    // Force fresh user data by clearing cache first
    appCache.clearUser();
    
    const { limits, user, family } = await getUserTierInfo();
    
    let currentRecipeCount;
    
    // If user is in a family, use family-aware resource counts
    if (family?.isFamilyMember || family?.isFamilyOwner) {
      try {
        const resourceCounts = await getUserResourceCounts(user.id);
        currentRecipeCount = resourceCounts?.custom_recipes || 0;
        console.log('👨‍👩‍👧‍👦 tierManager: Using family-aware recipe count:', currentRecipeCount);
      } catch (familyCountError) {
        console.warn('👨‍👩‍👧‍👦 tierManager: Failed to get family counts, using individual:', familyCountError);
        currentRecipeCount = user.current_custom_recipes || 0;
      }
    } else {
      currentRecipeCount = user.current_custom_recipes || 0;
    }
    
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