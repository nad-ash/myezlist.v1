/**
 * Activity Tracking Context Helpers
 * 
 * Provides standardized tracking contexts for entity operations.
 * Use with entity.create(), entity.update(), entity.delete() methods.
 */

/**
 * Create a tracking context object
 * @param {string} page - Page name where action occurred
 * @param {string} operationName - Human-readable operation name
 * @param {string} userId - User ID performing the action
 * @param {string} description - Detailed description of the action
 */
export const createTrackingContext = (page, operationName, userId, description) => ({
  page,
  operationName,
  userId,
  description
});

// ==========================================
// PREDEFINED OPERATION NAMES
// ==========================================

export const OPERATIONS = {
  // Shopping List Operations
  SHOPPING_LIST: {
    CREATE: 'Create New Shopping List',
    DELETE: 'Delete Shopping List',
  },
  
  // Item Operations
  ITEM: {
    ADD: 'Add New Item to List',
    EDIT: 'Edit Item Details',
    DELETE: 'Delete Item from List',
    ARCHIVE: 'Archive Item in List',
    ACTIVATE: 'Activate Item in List',
    FAVORITE: 'Mark Item as Favorite',
    UNFAVORITE: 'Remove Item from Favorite',
    COMPLETE_SHOPPING: 'Complete Item in Shopping',
    ACTIVATE_SHOPPING: 'Activate Item in Shopping',
    COMPLETE_ALL_SHOPPING: 'Complete All Items in Shopping',
  },
  
  // Todo Operations
  TODO: {
    CREATE: 'Create New Todo',
    UPDATE: 'Update Todo Details',
    DELETE: 'Delete Todo',
    COMPLETE: 'Complete Todo',
    REACTIVATE: 'Reactivate Todo',
  },
  
  // Recipe Operations
  RECIPE: {
    CREATE: 'Create New Recipe',
    UPDATE: 'Update Custom Recipe',
    SAVE_CUSTOMIZED: 'Save Customized Recipe',
  },
  
  // Recipe Favorite Operations
  RECIPE_FAVORITE: {
    ADD: 'Add Recipe as Favorite',
    REMOVE: 'Remove Recipe from Favorite',
  },
  
  // List Member Operations
  LIST_MEMBER: {
    JOIN: 'Join List via Link',
  },
  
  // Share Operations
  SHARE: {
    CREATE_LINK: 'Share Shopping List',
  },
  
  // Import Operations
  IMPORT: {
    BULK_IMPORT: 'Bulk Import Items',
    CREATE_LIST_VIA_IMPORT: 'Create List via Import',
  },
};

// ==========================================
// PAGE NAMES (for consistency)
// ==========================================

export const PAGES = {
  MANAGE_LISTS: 'ManageLists',
  LIST_VIEW: 'ListView',
  TODOS: 'Todos',
  MY_RECIPES: 'MyRecipes',
  RECIPE_DETAIL: 'RecipeDetail',
  SHOPPING_MODE: 'ShoppingModeActive',
  JOIN_LIST: 'JoinListViaLink',
  IMPORT_LIST: 'ImportList',
};

// ==========================================
// HELPER FUNCTIONS FOR COMMON TRACKING
// ==========================================

/**
 * Create tracking context for shopping list operations
 */
export const trackShoppingList = {
  create: (userId, listName) => createTrackingContext(
    PAGES.MANAGE_LISTS,
    OPERATIONS.SHOPPING_LIST.CREATE,
    userId,
    `User created shopping list "${listName}"`
  ),
  delete: (userId, listName, page = PAGES.MANAGE_LISTS) => createTrackingContext(
    page,
    OPERATIONS.SHOPPING_LIST.DELETE,
    userId,
    `User deleted shopping list "${listName}"`
  ),
};

/**
 * Create tracking context for item operations
 */
export const trackItem = {
  add: (userId, itemName) => createTrackingContext(
    PAGES.LIST_VIEW,
    OPERATIONS.ITEM.ADD,
    userId,
    `User added item "${itemName}" to list`
  ),
  edit: (userId, itemName) => createTrackingContext(
    PAGES.LIST_VIEW,
    OPERATIONS.ITEM.EDIT,
    userId,
    `User edited item "${itemName}"`
  ),
  delete: (userId, itemName) => createTrackingContext(
    PAGES.LIST_VIEW,
    OPERATIONS.ITEM.DELETE,
    userId,
    `User deleted item "${itemName}" from list`
  ),
  archive: (userId, itemName) => createTrackingContext(
    PAGES.LIST_VIEW,
    OPERATIONS.ITEM.ARCHIVE,
    userId,
    `User archived item "${itemName}"`
  ),
  activate: (userId, itemName) => createTrackingContext(
    PAGES.LIST_VIEW,
    OPERATIONS.ITEM.ACTIVATE,
    userId,
    `User activated item "${itemName}"`
  ),
  favorite: (userId, itemName) => createTrackingContext(
    PAGES.LIST_VIEW,
    OPERATIONS.ITEM.FAVORITE,
    userId,
    `User marked item "${itemName}" as favorite`
  ),
  unfavorite: (userId, itemName) => createTrackingContext(
    PAGES.LIST_VIEW,
    OPERATIONS.ITEM.UNFAVORITE,
    userId,
    `User unmarked item "${itemName}" as favorite`
  ),
  completeInShopping: (userId, itemName) => createTrackingContext(
    PAGES.SHOPPING_MODE,
    OPERATIONS.ITEM.COMPLETE_SHOPPING,
    userId,
    `User completed item "${itemName}" while shopping`
  ),
  activateInShopping: (userId, itemName) => createTrackingContext(
    PAGES.SHOPPING_MODE,
    OPERATIONS.ITEM.ACTIVATE_SHOPPING,
    userId,
    `User reactivated item "${itemName}" while shopping`
  ),
  completeAllInShopping: (userId, listName) => createTrackingContext(
    PAGES.SHOPPING_MODE,
    OPERATIONS.ITEM.COMPLETE_ALL_SHOPPING,
    userId,
    `User completed shopping for list "${listName}" by checking all remaining items`
  ),
};

/**
 * Create tracking context for todo operations
 */
export const trackTodo = {
  create: (userId, title) => createTrackingContext(
    PAGES.TODOS,
    OPERATIONS.TODO.CREATE,
    userId,
    `User created task "${title}"`
  ),
  update: (userId) => createTrackingContext(
    PAGES.TODOS,
    OPERATIONS.TODO.UPDATE,
    userId,
    `User updated task details`
  ),
  delete: (userId) => createTrackingContext(
    PAGES.TODOS,
    OPERATIONS.TODO.DELETE,
    userId,
    `User deleted a task`
  ),
  complete: (userId, title) => createTrackingContext(
    PAGES.TODOS,
    OPERATIONS.TODO.COMPLETE,
    userId,
    `User completed task "${title}"`
  ),
  reactivate: (userId, title) => createTrackingContext(
    PAGES.TODOS,
    OPERATIONS.TODO.REACTIVATE,
    userId,
    `User reactivated task "${title}"`
  ),
};

/**
 * Create tracking context for recipe operations
 */
export const trackRecipe = {
  create: (userId, title, page = PAGES.MY_RECIPES) => createTrackingContext(
    page,
    OPERATIONS.RECIPE.CREATE,
    userId,
    `User created recipe "${title}"`
  ),
  update: (userId, title) => createTrackingContext(
    PAGES.RECIPE_DETAIL,
    OPERATIONS.RECIPE.UPDATE,
    userId,
    `User updated custom recipe "${title}"`
  ),
  saveCustomized: (userId, originalTitle, newTitle) => createTrackingContext(
    PAGES.RECIPE_DETAIL,
    OPERATIONS.RECIPE.SAVE_CUSTOMIZED,
    userId,
    `User saved customized version of "${originalTitle}" as "${newTitle}"`
  ),
};

/**
 * Create tracking context for recipe favorite operations
 */
export const trackRecipeFavorite = {
  add: (userId, recipeTitle, page = PAGES.RECIPE_DETAIL) => createTrackingContext(
    page,
    OPERATIONS.RECIPE_FAVORITE.ADD,
    userId,
    `User added recipe "${recipeTitle}" to favorites`
  ),
  remove: (userId, recipeTitle, page = PAGES.RECIPE_DETAIL) => createTrackingContext(
    page,
    OPERATIONS.RECIPE_FAVORITE.REMOVE,
    userId,
    `User removed recipe "${recipeTitle}" from favorites`
  ),
};

/**
 * Create tracking context for share operations
 */
export const trackShare = {
  createLink: (userId, listName, page = PAGES.LIST_VIEW) => createTrackingContext(
    page,
    OPERATIONS.SHARE.CREATE_LINK,
    userId,
    `User created share link for list "${listName}"`
  ),
};

/**
 * Create tracking context for list member operations
 */
export const trackListMember = {
  join: (userId, listName) => createTrackingContext(
    PAGES.JOIN_LIST,
    OPERATIONS.LIST_MEMBER.JOIN,
    userId,
    `User joined shopping list "${listName}" via share link`
  ),
};

/**
 * Create tracking context for import operations
 */
export const trackImport = {
  bulkImport: (userId, listName, itemCount) => createTrackingContext(
    PAGES.IMPORT_LIST,
    OPERATIONS.IMPORT.BULK_IMPORT,
    userId,
    `User imported ${itemCount} items to list "${listName}"`
  ),
  createListViaImport: (userId, listName) => createTrackingContext(
    PAGES.IMPORT_LIST,
    OPERATIONS.IMPORT.CREATE_LIST_VIA_IMPORT,
    userId,
    `User created list "${listName}" via bulk import`
  ),
};

