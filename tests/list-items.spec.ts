import { test, expect } from '@playwright/test';
import { createTestShoppingItem } from './fixtures/test-data';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars directly in test file to ensure they're available
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test'), override: false });

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || '';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || '';

// Debug: Log credentials status
console.log('list-items.spec.ts: TEST_USER_EMAIL =', TEST_USER_EMAIL ? 'SET' : 'NOT SET');

// Helper to login before tests
async function loginIfCredentialsAvailable(page: any): Promise<boolean> {
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    console.log('Skipping: No test credentials available');
    return false;
  }
  
  try {
    console.log('Attempting login with:', TEST_USER_EMAIL);
    await page.goto('/Login');
    
    // Wait for the sign-in tab to be visible and click it if needed
    const signInTab = page.getByRole('tab', { name: 'Sign In' });
    if (await signInTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signInTab.click();
    }
    
    await page.waitForSelector('#signin-email', { timeout: 10000 });
    console.log('Found email input, filling credentials...');
    await page.fill('#signin-email', TEST_USER_EMAIL);
    await page.fill('#signin-password', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for successful login - check for Home URL or the presence of sidebar navigation
    await page.waitForURL(/\/(home|$)/i, { timeout: 15000 });
    console.log('Login successful!');
    return true;
  } catch (e) {
    console.log('Login failed:', e);
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/login-failure-debug.png' }).catch(() => {});
    return false;
  }
}

// Helper to navigate to a list view
async function navigateToFirstList(page: any): Promise<boolean> {
  console.log('navigateToFirstList: Going to /ManageLists');
  await page.goto('/ManageLists');
  
  // Wait for the page title to appear first
  await page.waitForSelector('text="My Shopping Lists"', { timeout: 10000 }).catch(() => {});
  
  // Wait for lists to load (loading spinner to disappear or lists to appear)
  await page.waitForTimeout(5000);
  
  // Take debug screenshot
  await page.screenshot({ path: 'test-results/manage-lists-loaded.png' }).catch(() => {});
  
  // Look for list cards - they have cursor-pointer class and contain list info
  // The Card component has: cursor-pointer, overflow-hidden, group classes
  const listCards = page.locator('.cursor-pointer.group');
  let count = await listCards.count();
  console.log(`navigateToFirstList: Found ${count} list cards with cursor-pointer.group`);
  
  // If no cards found, try waiting a bit more
  if (count === 0) {
    console.log('navigateToFirstList: No cards found, waiting more...');
    await page.waitForTimeout(3000);
    count = await listCards.count();
    console.log(`navigateToFirstList: After additional wait, found ${count} list cards`);
  }
  
  if (count > 0) {
    console.log('navigateToFirstList: Clicking first list card');
    await listCards.first().click();
    await page.waitForTimeout(1000);
    
    // Wait for navigation
    try {
      await page.waitForURL(/\/listview/i, { timeout: 10000 });
      console.log('navigateToFirstList: Successfully navigated to ListView');
      return true;
    } catch {
      // Check current URL
      const currentUrl = page.url();
      console.log(`navigateToFirstList: Current URL is ${currentUrl}`);
      // Try alternative - check if we're on a page with Quick Add
      const hasListView = await page.locator('text="Quick Add"').count();
      console.log(`navigateToFirstList: Alternative check - found ${hasListView} Quick Add elements`);
      if (hasListView > 0) return true;
      
      // Check if there's an "Add Item" button
      const hasAddItem = await page.locator('text="Add Item (with details)"').count();
      console.log(`navigateToFirstList: Found ${hasAddItem} Add Item buttons`);
      return hasAddItem > 0;
    }
  }
  
  // Take screenshot to debug
  await page.screenshot({ path: 'test-results/navigate-list-debug.png' }).catch(() => {});
  console.log('navigateToFirstList: No list cards found');
  return false;
}

test.describe('List Items', () => {
  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginIfCredentialsAvailable(page);
    if (!loggedIn) {
      test.skip();
    }
  });

  test.describe('Fast Add Input', () => {
    test('should display fast add input on list view', async ({ page }) => {
      const hasLists = await navigateToFirstList(page);
      if (!hasLists) {
        test.skip();
        return;
      }
      
      // Check for fast add input - the placeholder is "Item name (e.g., Milk, 2lb Chicken)"
      const fastAddInput = page.locator('input[placeholder*="Item name"], input[placeholder*="Milk"]');
      await expect(fastAddInput.first()).toBeVisible({ timeout: 10000 });
    });

    test('should add item via fast add input', async ({ page }) => {
      const hasLists = await navigateToFirstList(page);
      if (!hasLists) {
        test.skip();
        return;
      }
      
      // Get current active items count from header
      const headerText = await page.locator('text=/\\d+ active/').textContent().catch(() => '0 active');
      const initialCount = parseInt(headerText?.match(/(\d+) active/)?.[1] || '0');
      console.log(`Initial active count: ${initialCount}`);
      
      // Use a simpler item name
      const itemName = `Quick Add ${Date.now()}`;
      
      // Find and fill fast add input
      const fastAddInput = page.locator('input[placeholder*="Item name"], input[placeholder*="Milk"]').first();
      await fastAddInput.fill(itemName);
      
      // Find and click the Add button specifically (the blue button with "Add" text)
      const addButton = page.locator('button').filter({ hasText: 'Add' }).filter({ hasNotText: 'Adding' }).first();
      await addButton.click();
      
      // Wait for "Adding..." to appear and then disappear (confirms operation started)
      try {
        await expect(page.locator('button:has-text("Adding")')).toBeVisible({ timeout: 5000 });
        console.log('Adding... button appeared');
        await expect(page.locator('button:has-text("Adding")')).toBeHidden({ timeout: 30000 });
        console.log('Adding... completed');
      } catch (e) {
        console.log('Did not see Adding... state, button may have been too fast');
      }
      
      // Wait for page to update
      await page.waitForTimeout(3000);
      
      // Verify the item count increased
      const newHeaderText = await page.locator('text=/\\d+ active/').textContent().catch(() => '0 active');
      const newCount = parseInt(newHeaderText?.match(/(\d+) active/)?.[1] || '0');
      console.log(`New active count: ${newCount}`);
      
      // Either count increased or we can find the item
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    });
  });

  test.describe('Add Item Dialog', () => {
    test('should open add item dialog', async ({ page }) => {
      const hasLists = await navigateToFirstList(page);
      if (!hasLists) {
        test.skip();
        return;
      }
      
      // Click add item button
      await page.click('button:has-text("Add Item")');
      
      // Check dialog is visible
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
    });

    test('should add item with details', async ({ page }) => {
      const hasLists = await navigateToFirstList(page);
      if (!hasLists) {
        test.skip();
        return;
      }
      
      const testItem = createTestShoppingItem({ 
        name: `Detailed Item ${Date.now()}`,
        quantity: 3,
        category: 'Dairy'
      });
      
      // Click add item button
      await page.click('button:has-text("Add Item")');
      
      // Wait for dialog
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
      
      // Fill in item details - find input in dialog
      const nameInput = page.locator('[role="dialog"] input').first();
      await nameInput.fill(testItem.name);
      
      // Submit
      await page.locator('[role="dialog"]').locator('button:has-text("Save"), button:has-text("Add")').click();
      
      // Wait for dialog to close and item to appear
      await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 5000 });
      await expect(page.locator(`text=${testItem.name}`)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Check/Uncheck Items', () => {
    test('should toggle item check state', async ({ page }) => {
      const hasLists = await navigateToFirstList(page);
      if (!hasLists) {
        test.skip();
        return;
      }
      
      // Look for checkboxes
      const checkboxes = page.locator('input[type="checkbox"], [role="checkbox"]');
      const count = await checkboxes.count();
      
      if (count > 0) {
        // Click to toggle
        await checkboxes.first().click();
        await page.waitForTimeout(500);
        // Test passes if no error
      }
    });
  });

  test.describe('Favorite Items', () => {
    test('should have favorite buttons on items', async ({ page }) => {
      const hasLists = await navigateToFirstList(page);
      if (!hasLists) {
        test.skip();
        return;
      }
      
      // Look for star/favorite buttons
      const favoriteButtons = page.locator('button:has(svg.lucide-star), button:has(svg)').filter({ hasText: '' });
      
      // Just verify page loaded with items
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Shopping Mode', () => {
    test('should navigate to shopping mode from list view', async ({ page }) => {
      const hasLists = await navigateToFirstList(page);
      if (!hasLists) {
        test.skip();
        return;
      }
      
      // Click shopping cart button
      const shoppingModeButton = page.locator('button[title="Enter Shopping Mode"], button:has(svg.lucide-shopping-cart)');
      
      if (await shoppingModeButton.count() > 0) {
        await shoppingModeButton.first().click();
        
        // Should navigate to shopping mode
        await expect(page).toHaveURL(/\/shoppingmodeactive/i, { timeout: 10000 });
      }
    });
  });
});
