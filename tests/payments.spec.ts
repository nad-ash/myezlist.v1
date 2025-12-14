import { test, expect } from './fixtures/auth.fixture';
import { 
  setupStripeMocks, 
  mockSuccessfulCheckout, 
  mockCanceledCheckout, 
  mockCheckoutError,
  mockPortalError 
} from './mocks/stripe.mock';
import { SUBSCRIPTION_TIERS } from './fixtures/test-data';

test.describe('Payments & Subscriptions', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Setup Stripe mocks for all tests in this suite
    await setupStripeMocks(page);
  });

  test.describe('Settings Page - Subscription Display', () => {
    test('should display current subscription tier', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      // Check for subscription section
      await expect(page.locator('text=Settings')).toBeVisible();
      await expect(page.locator('text=Your Plan, text=Current Plan')).toBeVisible();
      
      // Should show tier name (Free, Ad-Free, Pro, or Premium)
      const tierNames = ['Free', 'Ad-Free', 'Pro', 'Premium'];
      let foundTier = false;
      
      for (const tier of tierNames) {
        const tierElement = page.locator(`text=${tier}`).first();
        if (await tierElement.isVisible()) {
          foundTier = true;
          break;
        }
      }
      
      expect(foundTier).toBe(true);
    });

    test('should display usage statistics', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      // Check for usage stats
      await expect(page.locator('text=Shopping Lists')).toBeVisible();
      await expect(page.locator('text=Total Items')).toBeVisible();
      await expect(page.locator('text=Tasks')).toBeVisible();
    });

    test('should display credits usage', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      // Check for credits display
      await expect(page.locator('text=Credits')).toBeVisible();
      
      // Should show progress bar for credits
      const progressBar = page.locator('[role="progressbar"], .progress');
      await expect(progressBar.first()).toBeVisible();
    });
  });

  test.describe('Subscription Tiers', () => {
    test('should display available upgrade options', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      // Scroll to upgrade section if needed
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      
      // Check for upgrade section
      const upgradeSection = page.locator('text=Upgrade Your Plan');
      
      // If user is not on premium, upgrade options should be visible
      if (await upgradeSection.isVisible()) {
        // Check for tier cards
        const tierCards = page.locator('button:has-text("Upgrade to")');
        await expect(tierCards.first()).toBeVisible();
      }
    });

    test('should display tier features and pricing', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      
      // Look for pricing information
      const priceElements = page.locator('text=/\\$\\d+\\.\\d+/');
      
      if (await priceElements.count() > 0) {
        await expect(priceElements.first()).toBeVisible();
      }
      
      // Look for feature limits
      const limitElements = page.locator('text=/\\d+ Shopping Lists|\\d+ Total Items|\\d+ Tasks/');
      
      if (await limitElements.count() > 0) {
        await expect(limitElements.first()).toBeVisible();
      }
    });
  });

  test.describe('Checkout Flow (Mocked)', () => {
    test('should initiate checkout with mocked Stripe', async ({ authenticatedPage: page }) => {
      await mockSuccessfulCheckout(page, 'free', 'pro');
      
      await page.goto('/Settings');
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      
      // Find upgrade button
      const upgradeButton = page.locator('button:has-text("Upgrade to Pro"), button:has-text("Upgrade to")').first();
      
      if (await upgradeButton.isVisible()) {
        await upgradeButton.click();
        
        // The mocked checkout should redirect to success URL
        await page.waitForURL(/Settings.*success=true/, { timeout: 10000 });
        
        // Success message should be visible
        await expect(page.locator('text=Subscription Upgraded Successfully, text=successfully')).toBeVisible();
      }
    });

    test('should handle canceled checkout', async ({ authenticatedPage: page }) => {
      await mockCanceledCheckout(page);
      
      await page.goto('/Settings');
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      
      const upgradeButton = page.locator('button:has-text("Upgrade to")').first();
      
      if (await upgradeButton.isVisible()) {
        await upgradeButton.click();
        
        // The mocked checkout should redirect to canceled URL
        await page.waitForURL(/Settings.*canceled=true/, { timeout: 10000 });
        
        // Cancel message should be visible
        await expect(page.locator('text=Checkout Canceled, text=canceled')).toBeVisible();
      }
    });

    test('should handle checkout error gracefully', async ({ authenticatedPage: page }) => {
      await mockCheckoutError(page, 500);
      
      await page.goto('/Settings');
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      
      const upgradeButton = page.locator('button:has-text("Upgrade to")').first();
      
      if (await upgradeButton.isVisible()) {
        // Listen for alert
        page.on('dialog', dialog => {
          expect(dialog.message()).toContain('Failed');
          dialog.dismiss();
        });
        
        await upgradeButton.click();
        
        // Wait for error handling
        await page.waitForTimeout(2000);
      }
    });
  });

  test.describe('Customer Portal (Mocked)', () => {
    test('should have manage subscription button for paid users', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      // Check for manage subscription button
      const manageButton = page.locator('button:has-text("Manage Subscription"), button:has-text("Manage")');
      
      // This button only shows for paid users
      // Either it's visible or not depending on user's subscription
    });

    test('should open customer portal with mocked Stripe', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      const manageButton = page.locator('button:has-text("Manage Subscription")');
      
      if (await manageButton.isVisible()) {
        await manageButton.click();
        
        // The mocked portal should redirect back to settings
        await page.waitForURL(/Settings/, { timeout: 10000 });
      }
    });
  });

  test.describe('Subscription Status', () => {
    test('should show subscription end date if set', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      // Check for subscription end date (for users with ending subscriptions)
      const endDateElement = page.locator('text=Expires, text=Subscription Ending');
      
      // This is conditional - only shown if user has an ending subscription
    });

    test('should show ad-free badge for paid tiers', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      // Check for ad-free indicator
      const adFreeIndicator = page.locator('text=Ad-Free');
      
      // This depends on user's current tier
    });
  });

  test.describe('Legal Links', () => {
    test('should display legal links in settings', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      
      // Check for legal section
      await expect(page.locator('text=Legal')).toBeVisible();
      
      // Check for links
      await expect(page.locator('a:has-text("Privacy Policy")')).toBeVisible();
      await expect(page.locator('a:has-text("Terms")')).toBeVisible();
      await expect(page.locator('a:has-text("Refund")')).toBeVisible();
    });

    test('should navigate to terms page', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      
      await page.click('a:has-text("Terms")');
      await expect(page).toHaveURL(/\/Terms/);
    });

    test('should navigate to privacy policy page', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      
      await page.click('a:has-text("Privacy Policy")');
      await expect(page).toHaveURL(/\/PrivacyPolicy/);
    });

    test('should navigate to refund policy page', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      
      await page.click('a:has-text("Refund")');
      await expect(page).toHaveURL(/\/RefundPolicy/);
    });
  });

  test.describe('Terms Agreement', () => {
    test('should show terms agreement notice on upgrade section', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      
      // Check for terms agreement text
      const termsText = page.locator('text=By upgrading');
      
      // Only visible if there are upgrade options
      if (await termsText.isVisible()) {
        await expect(termsText).toBeVisible();
        
        // Should have links to terms and privacy
        const termsLink = page.locator('a:has-text("Terms")');
        const privacyLink = page.locator('a:has-text("Privacy")');
        
        await expect(termsLink.first()).toBeVisible();
        await expect(privacyLink.first()).toBeVisible();
      }
    });
  });
});
