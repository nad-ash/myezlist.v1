import { User, UserAdmin, ShoppingList, Item, Todo, Recipe } from "@/api/entities";
import { appCache } from "./appCache";

/**
 * Sync user's usage counts with actual data
 * Calculates current counts from database and updates User entity
 */
export async function syncUserUsage(userId) {
  try {
    console.log('🔄 Syncing usage counts for user:', userId);
    
    // Get the target user's data
    const allUsers = await UserAdmin.filter({});
    const targetUser = allUsers.find(u => u.id === userId);
    
    if (!targetUser) {
      throw new Error(`User ${userId} not found`);
    }
    
    // Count shopping lists owned by user
    const shoppingLists = await ShoppingList.filter({
      owner_id: userId,
      archived: false
    });
    const currentShoppingLists = shoppingLists.length;
    
    // Count total items in user's lists
    let currentTotalItems = 0;
    if (shoppingLists.length > 0) {
      const listIds = shoppingLists.map(list => list.id);
      const allItems = await Item.list();
      currentTotalItems = allItems.filter(item => listIds.includes(item.list_id)).length;
    }
    
    // Count tasks created by user
    const tasks = await Todo.filter({
      created_by: targetUser.email
    });
    const currentTasks = tasks.length;
    
    // Count custom recipes created by user
    const recipes = await Recipe.filter({
      is_user_generated: true,
      generated_by_user_id: userId
    });
    const currentCustomRecipes = recipes.length;
    
    // Update user entity with current counts
    await User.updateMe({
      current_shopping_lists: currentShoppingLists,
      current_total_items: currentTotalItems,
      current_tasks: currentTasks,
      current_custom_recipes: currentCustomRecipes
    });
    
    // Clear user cache to force fresh data
    appCache.clearUser();
    
    console.log('✅ Usage synced:', {
      shoppingLists: currentShoppingLists,
      totalItems: currentTotalItems,
      tasks: currentTasks,
      customRecipes: currentCustomRecipes
    });
    
    return {
      currentShoppingLists,
      currentTotalItems,
      currentTasks,
      currentCustomRecipes
    };
  } catch (error) {
    console.error('Error syncing user usage:', error);
    throw error;
  }
}

/**
 * Increment a usage counter for the current user
 */
export async function incrementUsage(field) {
  try {
    const user = await User.me();
    const currentValue = user[field] || 0;
    
    await User.updateMe({
      [field]: currentValue + 1
    });
    
    // Clear user cache
    appCache.clearUser();
    
    console.log(`✅ Incremented ${field}: ${currentValue} → ${currentValue + 1}`);
  } catch (error) {
    console.error(`Error incrementing ${field}:`, error);
  }
}

/**
 * Decrement a usage counter for the current user
 */
export async function decrementUsage(field) {
  try {
    const user = await User.me();
    const currentValue = user[field] || 0;
    const newValue = Math.max(0, currentValue - 1);
    
    await User.updateMe({
      [field]: newValue
    });
    
    // Clear user cache
    appCache.clearUser();
    
    console.log(`✅ Decremented ${field}: ${currentValue} → ${newValue}`);
  } catch (error) {
    console.error(`Error decrementing ${field}:`, error);
  }
}