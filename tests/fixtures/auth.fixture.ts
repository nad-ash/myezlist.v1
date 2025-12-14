import { test as base, expect, Page } from '@playwright/test';

// Test user credentials - use environment variables or defaults
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'e2e-test@myezlist.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123!';

// Extend base test with authenticated fixture
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login page
    await page.goto('/Login');

    // Wait for the page to load
    await page.waitForSelector('[data-testid="signin-email"], #signin-email', { timeout: 10000 });

    // Fill in credentials
    await page.fill('#signin-email', TEST_USER_EMAIL);
    await page.fill('#signin-password', TEST_USER_PASSWORD);

    // Click sign in button
    await page.click('button[type="submit"]');

    // Wait for redirect to Home page (authentication complete) - case insensitive
    await page.waitForURL(/\/(home|$)/i, { timeout: 15000 });

    // Verify we're logged in by checking for user-specific content
    await expect(page.locator('text=Welcome back')).toBeVisible({ timeout: 10000 });

    // Use the authenticated page
    await use(page);
  },
});

export { expect };

/**
 * Helper function to login programmatically
 * Use this when you need to login in beforeEach or specific test cases
 */
export async function login(page: Page, email?: string, password?: string): Promise<void> {
  const userEmail = email || TEST_USER_EMAIL;
  const userPassword = password || TEST_USER_PASSWORD;

  await page.goto('/Login');
  await page.waitForSelector('#signin-email', { timeout: 10000 });
  await page.fill('#signin-email', userEmail);
  await page.fill('#signin-password', userPassword);
  await page.click('button[type="submit"]');
  // Wait for redirect to Home page (case-insensitive) or error message
  await page.waitForURL(/\/(home|$)/i, { timeout: 15000 });
}

/**
 * Helper function to logout
 */
export async function logout(page: Page): Promise<void> {
  // Navigate to a page with logout functionality
  // This depends on where the logout button is in your app
  // Typically in a menu or settings page
  await page.goto('/Settings');
  
  // Look for logout button or link
  const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")');
  if (await logoutButton.count() > 0) {
    await logoutButton.first().click();
  }
  
  // Wait for redirect to login or landing page
  await page.waitForURL(/\/(Login|Landing|$)/, { timeout: 10000 });
}

/**
 * Helper function to sign up a new user
 */
export async function signUp(
  page: Page,
  fullName: string,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/Login');
  
  // Click on Sign Up tab
  await page.click('[data-value="signup"], button:has-text("Sign Up")');
  
  // Fill in sign up form
  await page.fill('#signup-name', fullName);
  await page.fill('#signup-email', email);
  await page.fill('#signup-password', password);
  await page.fill('#signup-confirm', password);
  
  // Submit
  await page.click('button[type="submit"]:has-text("Create Account")');
}

/**
 * Check if user is currently authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    await page.goto('/Home');
    await page.waitForURL(/\/(Home|$)/, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
