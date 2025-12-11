/**
 * Client-side caching utility for app data
 * Implements configurable cache durations with automatic expiration
 */

const DEFAULT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

class AppCache {
  constructor() {
    this.memoryCache = {
      user: null,
      subscriptionTiers: null,
      premiumFeatures: null,
      recipes: null,
      recipeFavorites: null,
      allShoppingLists: null,
      listMemberships: null
    };
  }

  /**
   * Check if a specific cache type is enabled
   */
  isCacheEnabled(cacheType) {
    try {
      const settings = localStorage.getItem('app_cache_settings');
      if (!settings) return true; // Default to enabled
      
      const parsed = JSON.parse(settings);
      // If enabled property doesn't exist, default to true
      return parsed[`${cacheType}_enabled`] !== false;
    } catch (error) {
      console.error('Error checking cache enabled status:', error);
      return true; // Default to enabled on error
    }
  }

  /**
   * Set cache enabled/disabled status for a specific cache type
   */
  setCacheEnabled(cacheType, enabled) {
    try {
      const settings = localStorage.getItem('app_cache_settings');
      const parsed = settings ? JSON.parse(settings) : {};
      
      parsed[`${cacheType}_enabled`] = enabled;
      
      localStorage.setItem('app_cache_settings', JSON.stringify(parsed));
      console.log(`✅ Cache ${cacheType} ${enabled ? 'enabled' : 'disabled'}`);
      
      // If disabling, clear the cache immediately
      if (!enabled) {
        if (cacheType === 'user') {
          this.clearUser();
        } else if (cacheType === 'subscriptionTiers') {
          localStorage.removeItem('app_cache_subscription_tiers');
          this.memoryCache.subscriptionTiers = null;
        } else if (cacheType === 'premiumFeatures') {
          this.clearPremiumFeatures();
        } else if (cacheType === 'recipes') {
          this.clearRecipes();
        } else if (cacheType === 'shoppingLists') {
          this.clearAllShoppingLists();
          this.clearShoppingListEntities();
          this.clearListMemberships();
        } else if (cacheType === 'recipeFavorites') {
          this.clearRecipeFavorites();
        }
      }
    } catch (error) {
      console.error('Error setting cache enabled status:', error);
    }
  }

  /**
   * Get all cache enabled statuses
   */
  getAllCacheEnabled() {
    try {
      const settings = localStorage.getItem('app_cache_settings');
      if (!settings) {
        return {
          user: true,
          subscriptionTiers: true,
          premiumFeatures: true,
          recipes: true,
          shoppingLists: true,
          recipeFavorites: true
        };
      }

      const parsed = JSON.parse(settings);
      return {
        user: parsed.user_enabled !== false,
        subscriptionTiers: parsed.subscriptionTiers_enabled !== false,
        premiumFeatures: parsed.premiumFeatures_enabled !== false,
        recipes: parsed.recipes_enabled !== false,
        shoppingLists: parsed.shoppingLists_enabled !== false,
        recipeFavorites: parsed.recipeFavorites_enabled !== false
      };
    } catch (error) {
      console.error('Error reading cache enabled settings:', error);
      return {
        user: true,
        subscriptionTiers: true,
        premiumFeatures: true,
        recipes: true,
        shoppingLists: true,
        recipeFavorites: true
      };
    }
  }

  /**
   * Get cache duration for a specific cache type (in milliseconds)
   */
  getCacheDuration(cacheType) {
    try {
      const settings = localStorage.getItem('app_cache_settings');
      if (!settings) return DEFAULT_CACHE_DURATION;

      const parsed = JSON.parse(settings);
      return parsed[cacheType] || DEFAULT_CACHE_DURATION;
    } catch (error) {
      console.error('Error reading cache settings:', error);
      return DEFAULT_CACHE_DURATION;
    }
  }

  /**
   * Set cache duration for a specific cache type (in minutes)
   */
  setCacheDuration(cacheType, durationInMinutes) {
    try {
      const settings = localStorage.getItem('app_cache_settings');
      const parsed = settings ? JSON.parse(settings) : {};
      
      parsed[cacheType] = durationInMinutes * 60 * 1000; // Convert minutes to milliseconds
      
      localStorage.setItem('app_cache_settings', JSON.stringify(parsed));
      console.log(`✅ Cache duration for ${cacheType} set to ${durationInMinutes} minutes`);
    } catch (error) {
      console.error('Error setting cache duration:', error);
    }
  }

  /**
   * Get all cache duration settings (in minutes)
   */
  getAllCacheDurations() {
    try {
      const settings = localStorage.getItem('app_cache_settings');
      if (!settings) {
        return {
          user: DEFAULT_CACHE_DURATION,
          subscriptionTiers: DEFAULT_CACHE_DURATION,
          premiumFeatures: DEFAULT_CACHE_DURATION,
          recipes: DEFAULT_CACHE_DURATION,
          shoppingLists: DEFAULT_CACHE_DURATION,
          recipeFavorites: DEFAULT_CACHE_DURATION
        };
      }

      const parsed = JSON.parse(settings);
      return {
        user: parsed.user || DEFAULT_CACHE_DURATION,
        subscriptionTiers: parsed.subscriptionTiers || DEFAULT_CACHE_DURATION,
        premiumFeatures: parsed.premiumFeatures || DEFAULT_CACHE_DURATION,
        recipes: parsed.recipes || DEFAULT_CACHE_DURATION,
        shoppingLists: parsed.shoppingLists || DEFAULT_CACHE_DURATION,
        recipeFavorites: parsed.recipeFavorites || DEFAULT_CACHE_DURATION
      };
    } catch (error) {
      console.error('Error reading cache settings:', error);
      return {
        user: DEFAULT_CACHE_DURATION,
        subscriptionTiers: DEFAULT_CACHE_DURATION,
        premiumFeatures: DEFAULT_CACHE_DURATION,
        recipes: DEFAULT_CACHE_DURATION,
        shoppingLists: DEFAULT_CACHE_DURATION,
        recipeFavorites: DEFAULT_CACHE_DURATION
      };
    }
  }

  /**
   * Get cached user data with validation
   * expectedUserId: Optional parameter to validate cached user matches expected user
   */
  getUser(expectedUserId = null) {
    // Check if cache is enabled first
    if (!this.isCacheEnabled('user')) {
      console.log('🚫 User cache is disabled, skipping cache');
      return null;
    }

    try {
      const cached = localStorage.getItem('app_cache_user');
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const duration = this.getCacheDuration('user');

      // Check if cache is expired
      if (now - timestamp > duration) {
        console.log('⏰ User cache expired, clearing');
        localStorage.removeItem('app_cache_user');
        this.memoryCache.user = null;
        return null;
      }

      // CRITICAL: Validate user ID if provided
      if (expectedUserId && data.id !== expectedUserId) {
        console.log('⚠️ Cached user ID mismatch! Expected:', expectedUserId, 'Got:', data.id);
        console.log('🗑️ Clearing stale user cache for different user');
        this.clearUser();
        return null;
      }

      // Return from memory cache if available, otherwise from localStorage
      if (this.memoryCache.user) {
        // Also validate memory cache
        if (expectedUserId && this.memoryCache.user.id !== expectedUserId) {
          console.log('⚠️ Memory cached user ID mismatch!');
          this.memoryCache.user = null;
          return null;
        }
        return this.memoryCache.user;
      }

      this.memoryCache.user = data;
      return data;
    } catch (error) {
      console.error('Error reading user cache:', error);
      this.clearUser(); // Clear corrupted cache
      return null;
    }
  }

  /**
   * Set user data in cache
   */
  setUser(userData) {
    // Don't cache if disabled
    if (!this.isCacheEnabled('user')) {
      console.log('🚫 User cache is disabled, skipping cache storage');
      return;
    }

    try {
      const cacheData = {
        data: userData,
        timestamp: Date.now()
      };
      localStorage.setItem('app_cache_user', JSON.stringify(cacheData));
      this.memoryCache.user = userData;
      console.log('✅ Cached user data for user ID:', userData.id);
    } catch (error) {
      console.error('Error setting user cache:', error);
    }
  }

  /**
   * Get cached subscription tiers
   */
  getSubscriptionTiers() {
    // Check if cache is enabled first
    if (!this.isCacheEnabled('subscriptionTiers')) {
      console.log('🚫 Subscription tiers cache is disabled, skipping cache');
      return null;
    }

    try {
      const cached = localStorage.getItem('app_cache_subscription_tiers');
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const duration = this.getCacheDuration('subscriptionTiers');

      // Check if cache is expired
      if (now - timestamp > duration) {
        localStorage.removeItem('app_cache_subscription_tiers');
        this.memoryCache.subscriptionTiers = null;
        return null;
      }

      // Return from memory cache if available, otherwise from localStorage
      if (this.memoryCache.subscriptionTiers) {
        return this.memoryCache.subscriptionTiers;
      }

      this.memoryCache.subscriptionTiers = data;
      return data;
    } catch (error) {
      console.error('Error reading subscription tiers cache:', error);
      return null;
    }
  }

  /**
   * Set subscription tiers in cache
   */
  setSubscriptionTiers(tiersData) {
    // Don't cache if disabled
    if (!this.isCacheEnabled('subscriptionTiers')) {
      console.log('🚫 Subscription tiers cache is disabled, skipping cache storage');
      return;
    }

    try {
      const cacheData = {
        data: tiersData,
        timestamp: Date.now()
      };
      localStorage.setItem('app_cache_subscription_tiers', JSON.stringify(cacheData));
      this.memoryCache.subscriptionTiers = tiersData;
    } catch (error) {
      console.error('Error setting subscription tiers cache:', error);
    }
  }

  /**
   * Get cached premium features
   */
  getPremiumFeatures() {
    // Check if cache is enabled first
    if (!this.isCacheEnabled('premiumFeatures')) {
      console.log('🚫 Premium features cache is disabled, skipping cache');
      return null;
    }

    try {
      const cached = localStorage.getItem('app_cache_premium_features');
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const duration = this.getCacheDuration('premiumFeatures');

      // Check if cache is expired
      if (now - timestamp > duration) {
        localStorage.removeItem('app_cache_premium_features');
        this.memoryCache.premiumFeatures = null;
        return null;
      }

      // Return from memory cache if available, otherwise from localStorage
      if (this.memoryCache.premiumFeatures) {
        return this.memoryCache.premiumFeatures;
      }

      this.memoryCache.premiumFeatures = data;
      return data;
    } catch (error) {
      console.error('Error reading premium features cache:', error);
      return null;
    }
  }

  /**
   * Set premium features in cache
   */
  setPremiumFeatures(featuresData) {
    // Don't cache if disabled
    if (!this.isCacheEnabled('premiumFeatures')) {
      console.log('🚫 Premium features cache is disabled, skipping cache storage');
      return;
    }

    try {
      const cacheData = {
        data: featuresData,
        timestamp: Date.now()
      };
      localStorage.setItem('app_cache_premium_features', JSON.stringify(cacheData));
      this.memoryCache.premiumFeatures = featuresData;
    } catch (error) {
      console.error('Error setting premium features cache:', error);
    }
  }

  /**
   * Get cached recipes
   */
  getRecipes() {
    // Check if cache is enabled first
    if (!this.isCacheEnabled('recipes')) {
      console.log('🚫 Recipes cache is disabled, skipping cache');
      return null;
    }

    try {
      const cached = localStorage.getItem('app_cache_recipes');
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const duration = this.getCacheDuration('recipes');

      // Check if cache is expired
      if (now - timestamp > duration) {
        localStorage.removeItem('app_cache_recipes');
        this.memoryCache.recipes = null;
        return null;
      }

      // Return from memory cache if available, otherwise from localStorage
      if (this.memoryCache.recipes) {
        return this.memoryCache.recipes;
      }

      this.memoryCache.recipes = data;
      return data;
    } catch (error) {
      console.error('Error reading recipes cache:', error);
      return null;
    }
  }

  /**
   * Set recipes in cache
   */
  setRecipes(recipesData) {
    // Don't cache if disabled
    if (!this.isCacheEnabled('recipes')) {
      console.log('🚫 Recipes cache is disabled, skipping cache storage');
      return;
    }

    try {
      const cacheData = {
        data: recipesData,
        timestamp: Date.now()
      };
      localStorage.setItem('app_cache_recipes', JSON.stringify(cacheData));
      this.memoryCache.recipes = recipesData;
    } catch (error) {
      console.error('Error setting recipes cache:', error);
    }
  }

  /**
   * Get cached list memberships for a specific user
   */
  getListMemberships(userId) {
    // Check if cache is enabled first (uses shoppingLists setting)
    if (!this.isCacheEnabled('shoppingLists')) {
      console.log('🚫 Shopping lists cache is disabled, skipping ListMemberships cache');
      return null;
    }

    try {
      const cached = localStorage.getItem(`app_cache_list_memberships_${userId}`);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const duration = this.getCacheDuration('shoppingLists');

      // Check if cache is expired
      if (now - timestamp > duration) {
        localStorage.removeItem(`app_cache_list_memberships_${userId}`);
        this.memoryCache.listMemberships = null;
        return null;
      }

      // Return from memory cache if available, otherwise from localStorage
      if (this.memoryCache.listMemberships) {
        return this.memoryCache.listMemberships;
      }

      this.memoryCache.listMemberships = data;
      return data;
    } catch (error) {
      console.error('Error reading list memberships cache:', error);
      return null;
    }
  }

  /**
   * Set list memberships in cache for a specific user
   */
  setListMemberships(userId, membershipsData) {
    // Don't cache if disabled
    if (!this.isCacheEnabled('shoppingLists')) {
      console.log('🚫 Shopping lists cache is disabled, skipping ListMemberships cache storage');
      return;
    }

    try {
      const cacheData = {
        data: membershipsData,
        timestamp: Date.now()
      };
      localStorage.setItem(`app_cache_list_memberships_${userId}`, JSON.stringify(cacheData));
      this.memoryCache.listMemberships = membershipsData;
    } catch (error) {
      console.error('Error setting list memberships cache:', error);
    }
  }

  /**
   * Clear list memberships cache
   */
  clearListMemberships(userId) {
    try {
      if (userId) {
        localStorage.removeItem(`app_cache_list_memberships_${userId}`);
      } else {
        // Clear all list memberships caches
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('app_cache_list_memberships_')) {
            localStorage.removeItem(key);
          }
        });
      }
      this.memoryCache.listMemberships = null;
      console.log('🗑️ Cleared list memberships cache');
    } catch (error) {
      console.error('Error clearing list memberships cache:', error);
    }
  }

  /**
   * Get all cached ShoppingList entities (metadata only)
   * This caches the list entities themselves (name, color, icon, etc.)
   * Separate from per-list item caching
   */
  getShoppingListEntities() {
    // Check if cache is enabled first
    if (!this.isCacheEnabled('shoppingLists')) {
      console.log('🚫 Shopping lists cache is disabled, skipping cache');
      return null;
    }

    try {
      const cached = localStorage.getItem('app_cache_all_shopping_lists');
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const duration = this.getCacheDuration('shoppingLists');

      // Check if cache is expired
      if (now - timestamp > duration) {
        localStorage.removeItem('app_cache_all_shopping_lists');
        this.memoryCache.allShoppingLists = null;
        return null;
      }

      // Return from memory cache if available, otherwise from localStorage
      if (this.memoryCache.allShoppingLists) {
        return this.memoryCache.allShoppingLists;
      }

      this.memoryCache.allShoppingLists = data;
      return data;
    } catch (error) {
      console.error('Error reading shopping list entities cache:', error);
      return null;
    }
  }

  /**
   * Set all ShoppingList entities in cache
   */
  setShoppingListEntities(listsData) {
    // Don't cache if disabled
    if (!this.isCacheEnabled('shoppingLists')) {
      console.log('🚫 Shopping lists cache is disabled, skipping cache storage');
      return;
    }

    try {
      const cacheData = {
        data: listsData,
        timestamp: Date.now()
      };
      localStorage.setItem('app_cache_all_shopping_lists', JSON.stringify(cacheData));
      this.memoryCache.allShoppingLists = listsData;
    } catch (error) {
      console.error('Error setting shopping list entities cache:', error);
    }
  }

  /**
   * Clear shopping list entities cache
   */
  clearShoppingListEntities() {
    try {
      localStorage.removeItem('app_cache_all_shopping_lists');
      this.memoryCache.allShoppingLists = null;
      console.log('🗑️ Cleared shopping list entities cache');
    } catch (error) {
      console.error('Error clearing shopping list entities cache:', error);
    }
  }

  /**
   * Get cached shopping list for a specific list ID
   * NEW: Each list has its own cache for granular control
   */
  getShoppingList(listId) {
    // Check if cache is enabled first
    if (!this.isCacheEnabled('shoppingLists')) {
      console.log('🚫 Shopping lists cache is disabled, skipping cache');
      return null;
    }

    try {
      const cached = localStorage.getItem(`app_cache_shopping_list_${listId}`);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const duration = this.getCacheDuration('shoppingLists');

      // Check if cache is expired
      if (now - timestamp > duration) {
        localStorage.removeItem(`app_cache_shopping_list_${listId}`);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error reading shopping list cache:', error);
      return null;
    }
  }

  /**
   * Set shopping list in cache for a specific list ID
   * NEW: Each list has its own cache for granular control
   */
  setShoppingList(listId, listData) {
    // Don't cache if disabled
    if (!this.isCacheEnabled('shoppingLists')) {
      console.log('🚫 Shopping lists cache is disabled, skipping cache storage');
      return;
    }

    try {
      const cacheData = {
        data: listData,
        timestamp: Date.now()
      };
      localStorage.setItem(`app_cache_shopping_list_${listId}`, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error setting shopping list cache:', error);
    }
  }

  /**
   * Clear cache for a specific shopping list
   * NEW: Granular invalidation - only affects one list
   */
  clearShoppingList(listId) {
    try {
      localStorage.removeItem(`app_cache_shopping_list_${listId}`);
      console.log(`🗑️ Cleared cache for shopping list: ${listId}`);
    } catch (error) {
      console.error('Error clearing shopping list cache:', error);
    }
  }

  /**
   * Clear all shopping list caches (entities, memberships, and per-list data)
   */
  clearAllShoppingLists() {
    try {
      // Clear all per-list caches
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('app_cache_shopping_list_')) {
          localStorage.removeItem(key);
        }
      });
      
      // Clear entities cache and memberships cache too
      this.clearShoppingListEntities();
      this.clearListMemberships();
      
      console.log('🗑️ Cleared all shopping list caches');
    } catch (error) {
      console.error('Error clearing shopping list caches:', error);
    }
  }

  /**
   * Get count of cached shopping lists
   */
  getShoppingListCacheCount() {
    try {
      const keys = Object.keys(localStorage);
      return keys.filter(key => key.startsWith('app_cache_shopping_list_')).length;
    } catch (error) {
      console.error('Error counting shopping list caches:', error);
      return 0;
    }
  }

  /**
   * Get cached recipe favorites for a specific user
   */
  getRecipeFavorites(userId) {
    // Check if cache is enabled first
    if (!this.isCacheEnabled('recipeFavorites')) {
      console.log('🚫 Recipe favorites cache is disabled, skipping cache');
      return null;
    }

    try {
      const cached = localStorage.getItem(`app_cache_recipe_favorites_${userId}`);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();
      const duration = this.getCacheDuration('recipeFavorites');

      // Check if cache is expired
      if (now - timestamp > duration) {
        localStorage.removeItem(`app_cache_recipe_favorites_${userId}`);
        this.memoryCache.recipeFavorites = null;
        return null;
      }

      // Return from memory cache if available, otherwise from localStorage
      if (this.memoryCache.recipeFavorites) {
        return this.memoryCache.recipeFavorites;
      }

      this.memoryCache.recipeFavorites = data;
      return data;
    } catch (error) {
      console.error('Error reading recipe favorites cache:', error);
      return null;
    }
  }

  /**
   * Set recipe favorites in cache for a specific user
   */
  setRecipeFavorites(userId, favoritesData) {
    // Don't cache if disabled
    if (!this.isCacheEnabled('recipeFavorites')) {
      console.log('🚫 Recipe favorites cache is disabled, skipping cache storage');
      return;
    }

    try {
      const cacheData = {
        data: favoritesData,
        timestamp: Date.now()
      };
      localStorage.setItem(`app_cache_recipe_favorites_${userId}`, JSON.stringify(cacheData));
      this.memoryCache.recipeFavorites = favoritesData;
    } catch (error) {
      console.error('Error setting recipe favorites cache:', error);
    }
  }

  /**
   * Clear all cached data
   */
  clearAll() {
    try {
      console.log('🗑️ CLEARING ALL APP CACHE');
      // Clear all cache entries
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('app_cache_')) {
          localStorage.removeItem(key);
        }
      });
      
      this.memoryCache = {
        user: null,
        subscriptionTiers: null,
        premiumFeatures: null,
        recipes: null,
        recipeFavorites: null,
        allShoppingLists: null,
        listMemberships: null
      };
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Clear user cache only
   */
  clearUser() {
    try {
      localStorage.removeItem('app_cache_user');
      this.memoryCache.user = null;
      console.log('🗑️ Cleared user cache');
    } catch (error) {
      console.error('Error clearing user cache:', error);
    }
  }

  /**
   * Clear premium features cache only
   */
  clearPremiumFeatures() {
    try {
      localStorage.removeItem('app_cache_premium_features');
      this.memoryCache.premiumFeatures = null;
    } catch (error) {
      console.error('Error clearing premium features cache:', error);
    }
  }

  /**
   * Clear recipes cache only
   */
  clearRecipes() {
    try {
      localStorage.removeItem('app_cache_recipes');
      this.memoryCache.recipes = null;
    } catch (error) {
      console.error('Error clearing recipes cache:', error);
    }
  }

  /**
   * Clear recipe favorites cache for a specific user
   */
  clearRecipeFavorites(userId) {
    try {
      if (userId) {
        localStorage.removeItem(`app_cache_recipe_favorites_${userId}`);
      } else {
        // Clear all recipe favorites caches
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('app_cache_recipe_favorites_')) {
            localStorage.removeItem(key);
          }
        });
      }
      this.memoryCache.recipeFavorites = null;
    } catch (error) {
      console.error('Error clearing recipe favorites cache:', error);
    }
  }

  /**
   * Update user data in cache (partial update)
   */
  updateUser(updates) {
    try {
      const currentUser = this.getUser();
      if (currentUser) {
        const updatedUser = { ...currentUser, ...updates };
        this.setUser(updatedUser);
        return updatedUser;
      }
      return null;
    } catch (error) {
      console.error('Error updating user cache:', error);
      return null;
    }
  }
}

// Export singleton instance
export const appCache = new AppCache();