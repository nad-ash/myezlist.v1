/**
 * Test Data Factories
 * Factory functions for generating test data with sensible defaults
 */

// Unique ID generator for test data
let idCounter = 0;
const generateId = () => `test-${Date.now()}-${++idCounter}`;

/**
 * Shopping List Factory
 */
export interface TestShoppingList {
  name: string;
  icon?: string;
  color?: string;
  store_sections?: string[];
}

export function createTestShoppingList(overrides: Partial<TestShoppingList> = {}): TestShoppingList {
  return {
    name: `Test List ${generateId()}`,
    icon: '🛒',
    color: '#3B82F6',
    store_sections: ['Produce', 'Dairy', 'Meat', 'Bakery', 'Frozen'],
    ...overrides,
  };
}

/**
 * Shopping Item Factory
 */
export interface TestShoppingItem {
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  notes?: string;
  is_favorite?: boolean;
}

export function createTestShoppingItem(overrides: Partial<TestShoppingItem> = {}): TestShoppingItem {
  return {
    name: `Test Item ${generateId()}`,
    quantity: 1,
    unit: 'each',
    category: 'Produce',
    notes: '',
    is_favorite: false,
    ...overrides,
  };
}

/**
 * Recipe Factory
 */
export interface TestRecipe {
  full_title: string;
  short_title?: string;
  description?: string;
  cuisine?: string;
  cooking_time?: string;
  servings?: number;
  difficulty?: string;
  ingredients?: string[];
  instructions?: string[];
}

export function createTestRecipe(overrides: Partial<TestRecipe> = {}): TestRecipe {
  return {
    full_title: `Test Recipe ${generateId()}`,
    short_title: 'Test Recipe',
    description: 'A delicious test recipe created for E2E testing.',
    cuisine: 'American',
    cooking_time: '30 mins',
    servings: 4,
    difficulty: 'Easy',
    ingredients: [
      '2 cups flour',
      '1 cup sugar',
      '3 eggs',
      '1 cup milk',
    ],
    instructions: [
      'Preheat oven to 350°F.',
      'Mix dry ingredients in a bowl.',
      'Add wet ingredients and stir until combined.',
      'Bake for 25-30 minutes.',
    ],
    ...overrides,
  };
}

/**
 * User Factory (for signup tests)
 */
export interface TestUser {
  full_name: string;
  email: string;
  password: string;
}

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const uniqueId = generateId();
  return {
    full_name: `Test User ${uniqueId}`,
    email: `test-${uniqueId}@example.com`,
    password: 'TestPassword123!',
    ...overrides,
  };
}

/**
 * Todo/Task Factory
 */
export interface TestTodo {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  due_date?: string;
  category?: string;
}

export function createTestTodo(overrides: Partial<TestTodo> = {}): TestTodo {
  return {
    title: `Test Task ${generateId()}`,
    description: 'A test task for E2E testing',
    priority: 'medium',
    category: 'Personal',
    ...overrides,
  };
}

/**
 * Subscription Tier Data (for testing payments)
 */
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price: 0,
    maxLists: 3,
    maxItems: 50,
  },
  adfree: {
    name: 'Ad-Free',
    price: 2.99,
    maxLists: 5,
    maxItems: 100,
  },
  pro: {
    name: 'Pro',
    price: 4.99,
    maxLists: 10,
    maxItems: 500,
  },
  premium: {
    name: 'Premium',
    price: 9.99,
    maxLists: 999,
    maxItems: 9999,
  },
} as const;

/**
 * AI Generated Content Mocks
 */
export const MOCK_AI_RESPONSES = {
  recipeGeneration: {
    full_title: 'Classic Chocolate Chip Cookies',
    short_title: 'Chocolate Chip Cookies',
    description: 'Delicious homemade cookies with melty chocolate chips.',
    cuisine: 'American',
    cooking_time: '25 mins',
    servings: 24,
    difficulty: 'Easy',
    ingredients: [
      '2 1/4 cups all-purpose flour',
      '1 tsp baking soda',
      '1 tsp salt',
      '1 cup butter, softened',
      '3/4 cup granulated sugar',
      '3/4 cup packed brown sugar',
      '2 large eggs',
      '2 tsp vanilla extract',
      '2 cups chocolate chips',
    ],
    instructions: [
      'Preheat oven to 375°F.',
      'Mix flour, baking soda and salt in a bowl.',
      'Beat butter and sugars until creamy.',
      'Add eggs and vanilla; mix well.',
      'Gradually blend in flour mixture.',
      'Stir in chocolate chips.',
      'Drop rounded tablespoons onto baking sheets.',
      'Bake 9 to 11 minutes or until golden brown.',
    ],
  },
  imageGeneration: {
    url: 'https://example.com/generated-image.jpg',
    alt: 'AI Generated Image',
  },
  voiceCommand: {
    parsed: {
      action: 'add',
      item: 'milk',
      quantity: 2,
      unit: 'gallons',
      list: 'Grocery List',
    },
  },
};

/**
 * Helper to wait for a specific amount of time
 */
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate random string for unique test data
 */
export function randomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
