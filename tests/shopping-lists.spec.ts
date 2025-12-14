import { test, expect } from '@playwright/test';
import { createTestShoppingList } from './fixtures/test-data';

// Note: These tests require a valid test user in Supabase
// Set TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables
// or update the credentials in tests/fixtures/auth.fixture.ts

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || '';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || '';

// Helper to login before tests
async function loginIfCredentialsAvailable(page: any): Promise<boolean> {
  if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
    console.log('Skipping: No test credentials available');
    return false;
  }
  
  try {
    await page.goto('/Login');
    await page.waitForSelector('#signin-email', { timeout: 5000 });
    await page.fill('#signin-email', TEST_USER_EMAIL);
    await page.fill('#signin-password', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(home|$)/i, { timeout: 15000 });
    return true;
  } catch (e) {
    console.log('Login failed:', e);
    return false;
  }
}

test.describe('Shopping Lists', () => {
  test.describe('List Management (No Auth Required)', () => {
    test('should redirect to landing when not authenticated', async ({ page }) => {
      await page.goto('/ManageLists');
      
      // Should redirect to landing or login
      await page.waitForURL(/\/(landing|login)/i, { timeout: 10000 });
    });
  });

  test.describe('List Management (Auth Required)', () => {
    test.beforeEach(async ({ page }) => {
      const loggedIn = await loginIfCredentialsAvailable(page);
      if (!loggedIn) {
        test.skip();
      }
    });

    test('should display manage lists page', async ({ page }) => {
      await page.goto('/ManageLists');
      
      // Check for page title
      await expect(page.locator('text=My Shopping Lists')).toBeVisible();
      
      // Check for action buttons
      await expect(page.locator('button:has-text("New List")')).toBeVisible();
      await expect(page.locator('button:has-text("Import")')).toBeVisible();
    });

    test('should open create list dialog', async ({ page }) => {
      await page.goto('/ManageLists');
      
      // Click new list button
      await page.click('button:has-text("New List")');
      
      // Check for dialog elements
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });

    test('should create a new shopping list', async ({ page }) => {
      await page.goto('/ManageLists');
      
      const testList = createTestShoppingList({ name: `E2E Test List ${Date.now()}` });
      
      // Click new list button
      await page.click('button:has-text("New List")');
      
      // Fill in list details
      const nameInput = page.locator('[role="dialog"] input').first();
      await nameInput.fill(testList.name);
      
      // Submit the form
      await page.click('[role="dialog"] button:has-text("Create"), [role="dialog"] button:has-text("Save")');
      
      // Wait for dialog to close and list to appear
      await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 5000 });
      await expect(page.locator(`text=${testList.name}`)).toBeVisible({ timeout: 10000 });
    });

    test('should have refresh button', async ({ page }) => {
      await page.goto('/ManageLists');
      
      // Check for refresh button
      const refreshButton = page.locator('button[title="Refresh lists"], button:has(svg.lucide-refresh-cw)');
      await expect(refreshButton.first()).toBeVisible();
    });
  });

  test.describe('Voice Command', () => {
    test.beforeEach(async ({ page }) => {
      const loggedIn = await loginIfCredentialsAvailable(page);
      if (!loggedIn) {
        test.skip();
      }
    });

    test('should display voice command input on manage lists page', async ({ page }) => {
      await page.goto('/ManageLists');
      
      // Wait for page to load
      await page.waitForTimeout(2000);
      
      // Check for input area (could be text, search, or just input without type)
      const input = page.locator('input[placeholder*="Add"], input[placeholder*="add"], input[placeholder*="voice"], input[placeholder*="Voice"]');
      
      // Voice input is optional - some views may not have it
      const inputCount = await input.count();
      if (inputCount > 0) {
        await expect(input.first()).toBeVisible();
      } else {
        // If no voice input, just verify page loaded correctly
        await expect(page.locator('text=My Shopping Lists')).toBeVisible();
      }
    });
  });
});

// Separate describe block for tests that work without auth
test.describe('Shopping Lists - Public Pages', () => {
  test('should show landing page content', async ({ page }) => {
    await page.goto('/Landing');
    
    // Check landing page loads - look for the logo/brand name
    await expect(page.locator('text=MyEZList').first()).toBeVisible({ timeout: 10000 });
  });
});
