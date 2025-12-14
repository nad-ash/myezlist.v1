import { test, expect } from '@playwright/test';
import { login, signUp } from './fixtures/auth.fixture';
import { createTestUser } from './fixtures/test-data';

test.describe('Authentication', () => {
  test.describe('Sign In', () => {
    test('should display login page with sign in and sign up tabs', async ({ page }) => {
      await page.goto('/Login');
      
      // Check for key elements
      await expect(page.locator('text=Welcome')).toBeVisible();
      
      // Use specific tab locators
      await expect(page.getByRole('tab', { name: 'Sign In' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Sign Up' })).toBeVisible();
      
      // Check for form elements
      await expect(page.locator('#signin-email')).toBeVisible();
      await expect(page.locator('#signin-password')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/Login');
      
      // Fill in invalid credentials
      await page.fill('#signin-email', 'invalid@example.com');
      await page.fill('#signin-password', 'wrongpassword');
      
      // Submit the form
      await page.click('button[type="submit"]');
      
      // Wait for error message
      await expect(page.locator('[role="alert"], .text-red-500, .text-destructive').first()).toBeVisible({ timeout: 10000 });
    });

    test('should show/hide password toggle', async ({ page }) => {
      await page.goto('/Login');
      
      const passwordInput = page.locator('#signin-password');
      const toggleButton = page.locator('button:has(svg.lucide-eye), button:has(svg.lucide-eye-off)').first();
      
      // Initially password should be hidden
      await expect(passwordInput).toHaveAttribute('type', 'password');
      
      // Click toggle to show password
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'text');
      
      // Click again to hide
      await toggleButton.click();
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('should have forgot password link', async ({ page }) => {
      await page.goto('/Login');
      
      const forgotPasswordLink = page.locator('text=Forgot password?');
      await expect(forgotPasswordLink).toBeVisible();
    });
  });

  test.describe('Sign Up', () => {
    test('should switch to sign up tab', async ({ page }) => {
      await page.goto('/Login');
      
      // Click on Sign Up tab
      await page.getByRole('tab', { name: 'Sign Up' }).click();
      
      // Check for sign up form elements
      await expect(page.locator('#signup-name')).toBeVisible();
      await expect(page.locator('#signup-email')).toBeVisible();
      await expect(page.locator('#signup-password')).toBeVisible();
      await expect(page.locator('#signup-confirm')).toBeVisible();
    });

    test('should show error for password mismatch', async ({ page }) => {
      await page.goto('/Login');
      
      // Switch to sign up tab
      await page.getByRole('tab', { name: 'Sign Up' }).click();
      
      // Fill in form with mismatched passwords
      await page.fill('#signup-name', 'Test User');
      await page.fill('#signup-email', 'test@example.com');
      await page.fill('#signup-password', 'Password123!');
      await page.fill('#signup-confirm', 'DifferentPassword!');
      
      // Submit
      await page.click('button[type="submit"]:has-text("Create Account")');
      
      // Check for error message
      await expect(page.locator('text=Passwords do not match')).toBeVisible();
    });

    test('should show terms and privacy policy links', async ({ page }) => {
      await page.goto('/Login');
      
      // Switch to sign up tab
      await page.getByRole('tab', { name: 'Sign Up' }).click();
      
      // Check for legal links
      await expect(page.locator('a:has-text("Terms")')).toBeVisible();
      await expect(page.locator('a:has-text("Privacy Policy")')).toBeVisible();
    });
  });

  test.describe('OAuth', () => {
    test('should display Google and Apple sign in buttons', async ({ page }) => {
      await page.goto('/Login');
      
      // Check for OAuth buttons
      await expect(page.locator('button:has-text("Google")')).toBeVisible();
      await expect(page.locator('button:has-text("Apple")')).toBeVisible();
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated users from Home to Landing', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies();
      
      // Try to access protected route
      await page.goto('/Home');
      
      // Should be redirected to Landing or Login (case-insensitive)
      await page.waitForURL(/\/(landing|login)/i, { timeout: 15000 });
    });

    test('should redirect unauthenticated users from ManageLists to Landing', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies();
      
      // Try to access protected route
      await page.goto('/ManageLists');
      
      // Should be redirected to Landing or Login (case-insensitive)
      await page.waitForURL(/\/(landing|login)/i, { timeout: 15000 });
    });

    test('should allow access to public pages without authentication', async ({ page }) => {
      // Clear any existing session
      await page.context().clearCookies();
      
      // Access public pages
      await page.goto('/Landing');
      await expect(page).toHaveURL(/\/[Ll]anding/);
      
      await page.goto('/PrivacyPolicy');
      await expect(page).toHaveURL(/\/PrivacyPolicy/i);
      
      await page.goto('/Terms');
      await expect(page).toHaveURL(/\/Terms/i);
    });
  });

  test.describe('Navigation', () => {
    test('should have back to home link on login page', async ({ page }) => {
      await page.goto('/Login');
      
      const backLink = page.locator('a:has-text("Back to Home")');
      await expect(backLink).toBeVisible();
    });

    test('should navigate to landing page from login', async ({ page }) => {
      await page.goto('/Login');
      
      await page.click('a:has-text("Back to Home")');
      // Use case-insensitive match for URL
      await expect(page).toHaveURL(/\/[Ll]anding/);
    });
  });
});
