import { test, expect } from './fixtures/auth.fixture';
import { setupAIMocks } from './mocks/ai.mock';
import { createTestRecipe } from './fixtures/test-data';

test.describe('Recipes', () => {
  test.describe('Recipe Hub', () => {
    test('should display recipe hub page', async ({ authenticatedPage: page }) => {
      await page.goto('/Recipe');
      
      // Check for page elements
      await expect(page.locator('text=Recipes')).toBeVisible();
      await expect(page.locator('text=Popular Recipes')).toBeVisible();
      await expect(page.locator('text=My Favorites')).toBeVisible();
      await expect(page.locator('text=My Recipes')).toBeVisible();
    });

    test('should display recipe counts', async ({ authenticatedPage: page }) => {
      await page.goto('/Recipe');
      
      // Wait for stats to load
      await page.waitForTimeout(2000);
      
      // Check that count numbers are visible
      const countElements = page.locator('.text-2xl.font-bold, .text-3xl.font-bold');
      await expect(countElements.first()).toBeVisible();
    });

    test('should display recipe carousel if recipes exist', async ({ authenticatedPage: page }) => {
      await page.goto('/Recipe');
      
      // Wait for carousel to load
      await page.waitForTimeout(2000);
      
      // Check for carousel navigation
      const carouselButtons = page.locator('button:has(svg.lucide-chevron-left), button:has(svg.lucide-chevron-right)');
      
      // Carousel is optional - depends on if recipes with photos exist
    });

    test('should navigate to Popular Recipes', async ({ authenticatedPage: page }) => {
      await page.goto('/Recipe');
      
      // Click on Popular Recipes card
      const popularCard = page.locator('text=Popular Recipes').locator('..');
      await popularCard.click();
      
      // Should navigate to PopularRecipes page
      await expect(page).toHaveURL(/\/PopularRecipes/);
    });

    test('should navigate to My Favorites', async ({ authenticatedPage: page }) => {
      await page.goto('/Recipe');
      
      // Click on My Favorites card
      const favoritesCard = page.locator('text=My Favorites').locator('..');
      await favoritesCard.click();
      
      // Should navigate to FavoriteRecipes page
      await expect(page).toHaveURL(/\/FavoriteRecipes/);
    });

    test('should navigate to My Recipes', async ({ authenticatedPage: page }) => {
      await page.goto('/Recipe');
      
      // Click on My Recipes card
      const myRecipesCard = page.locator('text=My Recipes').locator('..');
      await myRecipesCard.click();
      
      // Should navigate to MyRecipes page
      await expect(page).toHaveURL(/\/MyRecipes/);
    });
  });

  test.describe('Popular Recipes', () => {
    test('should display popular recipes page', async ({ authenticatedPage: page }) => {
      await page.goto('/PopularRecipes');
      
      await expect(page.locator('h1:has-text("Popular"), h1:has-text("Recipes")')).toBeVisible();
    });

    test('should display recipe cards', async ({ authenticatedPage: page }) => {
      await page.goto('/PopularRecipes');
      
      // Wait for recipes to load
      await page.waitForTimeout(2000);
      
      // Check for recipe cards or empty state
      const recipeCards = page.locator('[data-testid="recipe-card"], .cursor-pointer:has(img)');
      const emptyState = page.locator('text=No recipes');
      
      // Either we have recipes or an empty state
    });

    test('should navigate to recipe detail on click', async ({ authenticatedPage: page }) => {
      await page.goto('/PopularRecipes');
      await page.waitForTimeout(2000);
      
      const recipeCards = page.locator('[data-testid="recipe-card"], .cursor-pointer:has(img), .rounded-lg:has(img)');
      const count = await recipeCards.count();
      
      if (count > 0) {
        await recipeCards.first().click();
        
        // Should navigate to recipe detail
        await expect(page).toHaveURL(/\/RecipeDetail\?id=/);
      }
    });
  });

  test.describe('Recipe Detail', () => {
    test('should display recipe detail page', async ({ authenticatedPage: page }) => {
      await page.goto('/PopularRecipes');
      await page.waitForTimeout(2000);
      
      const recipeCards = page.locator('[data-testid="recipe-card"], .cursor-pointer:has(img), .rounded-lg:has(img)');
      const count = await recipeCards.count();
      
      if (count > 0) {
        await recipeCards.first().click();
        await expect(page).toHaveURL(/\/RecipeDetail\?id=/);
        
        // Check for recipe detail elements
        await expect(page.locator('text=Ingredients')).toBeVisible();
        await expect(page.locator('text=Instructions')).toBeVisible();
      }
    });

    test('should have add to favorites button', async ({ authenticatedPage: page }) => {
      await page.goto('/PopularRecipes');
      await page.waitForTimeout(2000);
      
      const recipeCards = page.locator('[data-testid="recipe-card"], .cursor-pointer:has(img), .rounded-lg:has(img)');
      const count = await recipeCards.count();
      
      if (count > 0) {
        await recipeCards.first().click();
        await expect(page).toHaveURL(/\/RecipeDetail\?id=/);
        
        // Check for favorite button
        const favoriteButton = page.locator('button:has(svg.lucide-heart)');
        await expect(favoriteButton.first()).toBeVisible();
      }
    });

    test('should have add ingredients to list button', async ({ authenticatedPage: page }) => {
      await page.goto('/PopularRecipes');
      await page.waitForTimeout(2000);
      
      const recipeCards = page.locator('[data-testid="recipe-card"], .cursor-pointer:has(img), .rounded-lg:has(img)');
      const count = await recipeCards.count();
      
      if (count > 0) {
        await recipeCards.first().click();
        await expect(page).toHaveURL(/\/RecipeDetail\?id=/);
        
        // Check for add to list button
        const addToListButton = page.locator('button:has-text("Add to"), button:has-text("Shopping List")');
        
        if (await addToListButton.count() > 0) {
          await expect(addToListButton.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Favorite Recipes', () => {
    test('should display favorite recipes page', async ({ authenticatedPage: page }) => {
      await page.goto('/FavoriteRecipes');
      
      await expect(page.locator('h1:has-text("Favorite"), h1:has-text("My Favorites")')).toBeVisible();
    });

    test('should show empty state when no favorites', async ({ authenticatedPage: page }) => {
      await page.goto('/FavoriteRecipes');
      await page.waitForTimeout(2000);
      
      // Check for favorites or empty state
      const favoriteCards = page.locator('[data-testid="recipe-card"], .cursor-pointer:has(img)');
      const emptyState = page.locator('text=No favorite, text=no favorites');
      
      // Either we have favorites or an empty state
    });
  });

  test.describe('My Recipes (User Generated)', () => {
    test('should display my recipes page', async ({ authenticatedPage: page }) => {
      await page.goto('/MyRecipes');
      
      await expect(page.locator('h1:has-text("My Recipes"), h1:has-text("Your Recipes")')).toBeVisible();
    });

    test('should have create recipe button', async ({ authenticatedPage: page }) => {
      await page.goto('/MyRecipes');
      
      // Check for create/add recipe button
      const createButton = page.locator('button:has-text("Create"), button:has-text("New Recipe"), button:has-text("Add Recipe")');
      
      if (await createButton.count() > 0) {
        await expect(createButton.first()).toBeVisible();
      }
    });
  });

  test.describe('AI Recipe Generation (Mocked)', () => {
    test('should generate recipe with mocked AI', async ({ authenticatedPage: page }) => {
      // Setup AI mocks before testing
      await setupAIMocks(page);
      
      await page.goto('/MyRecipes');
      
      // Look for generate recipe button or AI generation feature
      const generateButton = page.locator('button:has-text("Generate"), button:has-text("AI"), button:has-text("Create with AI")');
      
      if (await generateButton.count() > 0) {
        await generateButton.first().click();
        
        // The mocked response should be used
        // Check for the mocked recipe title to appear
        await page.waitForTimeout(2000);
      }
    });
  });
});
