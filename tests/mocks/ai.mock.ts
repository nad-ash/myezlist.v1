import { Page, Route } from '@playwright/test';

/**
 * Mock responses for AI/Gemini API calls
 * These mocks prevent real API calls during testing, making tests:
 * - Fast: No network latency
 * - Reliable: Consistent responses
 * - Free: No API costs
 */

// Mock Gemini API response for recipe generation
export const MOCK_RECIPE_RESPONSE = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              full_title: 'Creamy Garlic Parmesan Chicken',
              short_title: 'Garlic Parmesan Chicken',
              description: 'Tender chicken breasts in a rich, creamy garlic parmesan sauce. Perfect for a quick weeknight dinner.',
              cuisine: 'Italian-American',
              cooking_time: '35 mins',
              prep_time: '10 mins',
              servings: 4,
              difficulty: 'Medium',
              ingredients: [
                '4 boneless, skinless chicken breasts',
                '2 tablespoons olive oil',
                '4 cloves garlic, minced',
                '1 cup heavy cream',
                '1 cup grated parmesan cheese',
                '1 teaspoon Italian seasoning',
                'Salt and pepper to taste',
                'Fresh parsley for garnish',
              ],
              instructions: [
                'Season chicken breasts with salt, pepper, and Italian seasoning.',
                'Heat olive oil in a large skillet over medium-high heat.',
                'Cook chicken for 6-7 minutes per side until golden and cooked through. Remove and set aside.',
                'In the same skillet, sauté garlic for 1 minute until fragrant.',
                'Pour in heavy cream and bring to a simmer.',
                'Stir in parmesan cheese until melted and smooth.',
                'Return chicken to the skillet and coat with sauce.',
                'Garnish with fresh parsley and serve.',
              ],
              nutrition: {
                calories: 450,
                protein: '42g',
                carbs: '5g',
                fat: '28g',
              },
            }),
          },
        ],
      },
      finishReason: 'STOP',
    },
  ],
};

// Mock Gemini API response for image generation description
export const MOCK_IMAGE_DESCRIPTION_RESPONSE = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: 'A beautifully plated dish of creamy garlic parmesan chicken, garnished with fresh parsley, served on a white ceramic plate with a rustic wooden background.',
          },
        ],
      },
      finishReason: 'STOP',
    },
  ],
};

// Mock response for voice command parsing
export const MOCK_VOICE_PARSE_RESPONSE = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              action: 'add',
              item_name: 'organic milk',
              quantity: 2,
              unit: 'gallons',
              list_name: 'Weekly Groceries',
              category: 'Dairy',
            }),
          },
        ],
      },
      finishReason: 'STOP',
    },
  ],
};

// Mock OpenAI image generation response
export const MOCK_OPENAI_IMAGE_RESPONSE = {
  created: Date.now(),
  data: [
    {
      url: 'https://placehold.co/512x512/orange/white?text=AI+Generated',
      revised_prompt: 'A delicious home-cooked meal',
    },
  ],
};

/**
 * Setup all AI-related API mocks for a page
 * Call this in beforeEach or at the start of tests that use AI features
 */
export async function setupAIMocks(page: Page): Promise<void> {
  // Mock Gemini/Google AI API
  await page.route('**/generativelanguage.googleapis.com/**', async (route: Route) => {
    const url = route.request().url();
    
    // Determine response based on request content
    const postData = route.request().postData();
    
    let response = MOCK_RECIPE_RESPONSE;
    
    if (postData) {
      if (postData.includes('voice') || postData.includes('command') || postData.includes('parse')) {
        response = MOCK_VOICE_PARSE_RESPONSE;
      } else if (postData.includes('image') || postData.includes('describe') || postData.includes('photo')) {
        response = MOCK_IMAGE_DESCRIPTION_RESPONSE;
      }
    }
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });

  // Mock OpenAI API (for image generation if used)
  await page.route('**/api.openai.com/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_OPENAI_IMAGE_RESPONSE),
    });
  });

  // Mock any image generation endpoints
  await page.route('**/generate-image**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        imageUrl: 'https://placehold.co/512x512/orange/white?text=Generated',
      }),
    });
  });
}

/**
 * Mock a specific recipe generation response
 */
export async function mockRecipeGeneration(page: Page, customRecipe?: object): Promise<void> {
  await page.route('**/generativelanguage.googleapis.com/**', async (route: Route) => {
    const response = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify(customRecipe || MOCK_RECIPE_RESPONSE.candidates[0].content.parts[0].text),
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    };
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Mock AI API to return an error
 * Useful for testing error handling
 */
export async function mockAIError(page: Page, statusCode: number = 500): Promise<void> {
  await page.route('**/generativelanguage.googleapis.com/**', async (route: Route) => {
    await route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: statusCode,
          message: 'API Error - Rate limit exceeded',
          status: 'RESOURCE_EXHAUSTED',
        },
      }),
    });
  });
}

/**
 * Clear all AI mocks
 */
export async function clearAIMocks(page: Page): Promise<void> {
  await page.unroute('**/generativelanguage.googleapis.com/**');
  await page.unroute('**/api.openai.com/**');
  await page.unroute('**/generate-image**');
}
