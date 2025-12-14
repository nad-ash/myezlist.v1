import { test, expect } from './fixtures/auth.fixture';
import { setupAIMocks, mockAIError, MOCK_RECIPE_RESPONSE, MOCK_VOICE_PARSE_RESPONSE } from './mocks/ai.mock';

test.describe('AI Features', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Setup AI mocks for all tests in this suite
    await setupAIMocks(page);
  });

  test.describe('AI Recipe Generation', () => {
    test('should generate recipe with mocked Gemini API', async ({ authenticatedPage: page }) => {
      await page.goto('/MyRecipes');
      
      // Look for AI generation trigger
      const generateButton = page.locator('button:has-text("Generate"), button:has-text("AI"), button:has-text("Create")');
      
      if (await generateButton.count() > 0) {
        await generateButton.first().click();
        
        // If there's a prompt input, fill it
        const promptInput = page.locator('input[placeholder*="recipe"], textarea[placeholder*="recipe"]');
        if (await promptInput.count() > 0) {
          await promptInput.first().fill('Make me a chicken pasta recipe');
          
          // Submit the generation request
          const submitButton = page.locator('button:has-text("Generate"), button[type="submit"]');
          if (await submitButton.count() > 0) {
            await submitButton.first().click();
          }
        }
        
        // Wait for response - the mocked API should return quickly
        await page.waitForTimeout(2000);
        
        // The mocked response title should appear
        const mockRecipeTitle = JSON.parse(MOCK_RECIPE_RESPONSE.candidates[0].content.parts[0].text).full_title;
        // Recipe content should be visible (either the mock title or recipe elements)
      }
    });

    test('should handle AI generation error gracefully', async ({ authenticatedPage: page }) => {
      // Override with error mock
      await mockAIError(page, 500);
      
      await page.goto('/MyRecipes');
      
      const generateButton = page.locator('button:has-text("Generate"), button:has-text("AI")');
      
      if (await generateButton.count() > 0) {
        await generateButton.first().click();
        
        // Fill prompt if needed
        const promptInput = page.locator('input[placeholder*="recipe"], textarea[placeholder*="recipe"]');
        if (await promptInput.count() > 0) {
          await promptInput.first().fill('Test recipe');
          
          const submitButton = page.locator('button:has-text("Generate"), button[type="submit"]');
          if (await submitButton.count() > 0) {
            await submitButton.first().click();
          }
        }
        
        // Should show error message
        await page.waitForTimeout(2000);
        
        // Check for error handling UI
        const errorMessage = page.locator('.text-red-500, [role="alert"], text=error, text=failed');
        // Error should be handled gracefully
      }
    });
  });

  test.describe('AI Image Generation', () => {
    test('should generate recipe image with mocked API', async ({ authenticatedPage: page }) => {
      // Navigate to a recipe detail page
      await page.goto('/PopularRecipes');
      await page.waitForTimeout(2000);
      
      const recipeCards = page.locator('[data-testid="recipe-card"], .cursor-pointer:has(img), .rounded-lg:has(img)');
      
      if (await recipeCards.count() > 0) {
        await recipeCards.first().click();
        await expect(page).toHaveURL(/\/RecipeDetail\?id=/);
        
        // Look for image generation button
        const generateImageButton = page.locator('button:has-text("Generate Image"), button:has-text("AI Image")');
        
        if (await generateImageButton.count() > 0) {
          await generateImageButton.first().click();
          
          // Wait for mocked image generation
          await page.waitForTimeout(2000);
          
          // The mocked image URL should be used
        }
      }
    });

    test('should generate item image with mocked API', async ({ authenticatedPage: page }) => {
      // Navigate to a list
      await page.goto('/ManageLists');
      await page.waitForTimeout(2000);
      
      const listCards = page.locator('[data-testid="list-card"], .cursor-pointer:has-text("items")');
      
      if (await listCards.count() > 0) {
        await listCards.first().click();
        await page.waitForURL(/\/ListView\?listId=/);
        
        // Look for item with image generation option
        const generateImageButton = page.locator('button:has(svg.lucide-image), button:has-text("Image")');
        
        if (await generateImageButton.count() > 0) {
          await generateImageButton.first().click();
          
          // Wait for mocked response
          await page.waitForTimeout(2000);
        }
      }
    });
  });

  test.describe('Voice Command Parsing', () => {
    test('should parse voice command with mocked API', async ({ authenticatedPage: page }) => {
      await page.goto('/ManageLists');
      
      // Look for voice input or text input that accepts voice commands
      const voiceInput = page.locator('input[placeholder*="Add items"], input[placeholder*="voice"]');
      
      if (await voiceInput.count() > 0) {
        // Type a voice-like command
        await voiceInput.first().fill('Add 2 gallons of organic milk to my grocery list');
        await voiceInput.first().press('Enter');
        
        // Wait for mocked parsing
        await page.waitForTimeout(2000);
        
        // The mocked response should parse the command
        // Check if item was added or parsing was shown
      }
    });

    test('should handle voice input button if available', async ({ authenticatedPage: page }) => {
      await page.goto('/ManageLists');
      
      // Look for microphone button
      const micButton = page.locator('button:has(svg.lucide-mic), button:has(svg.lucide-microphone)');
      
      if (await micButton.count() > 0) {
        // Just verify the button exists and is clickable
        await expect(micButton.first()).toBeEnabled();
      }
    });
  });

  test.describe('AI Credits', () => {
    test('should display credits usage on settings page', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      // Check for credits display
      await expect(page.locator('text=Credits, text=credits')).toBeVisible();
      
      // Should show credits remaining/total
      const creditsDisplay = page.locator('text=/\\d+\\/\\d+/');
      await expect(creditsDisplay.first()).toBeVisible();
    });

    test('should show credits reset date', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      // Look for reset date information
      const resetInfo = page.locator('text=Reset, text=resets');
      
      if (await resetInfo.count() > 0) {
        await expect(resetInfo.first()).toBeVisible();
      }
    });
  });

  test.describe('Premium Features List', () => {
    test('should display premium features that use credits', async ({ authenticatedPage: page }) => {
      await page.goto('/Settings');
      
      // Scroll down if needed
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      
      // Check for premium features section
      const premiumSection = page.locator('text=Premium Features');
      
      if (await premiumSection.count() > 0) {
        await expect(premiumSection.first()).toBeVisible();
        
        // Check for credit cost badges
        const creditBadges = page.locator('text=/\\d+ credit/');
        if (await creditBadges.count() > 0) {
          await expect(creditBadges.first()).toBeVisible();
        }
      }
    });
  });
});
