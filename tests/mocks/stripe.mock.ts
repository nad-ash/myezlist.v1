import { Page, Route } from '@playwright/test';

/**
 * Mock responses for Stripe API calls
 * These mocks prevent real payment processing during testing
 */

// Mock successful checkout session creation
export const MOCK_CHECKOUT_SESSION = {
  id: 'cs_test_mock_session_123',
  object: 'checkout.session',
  url: 'http://localhost:5173/Settings?success=true&from=free&to=pro',
  payment_status: 'unpaid',
  status: 'open',
  customer: 'cus_test_123',
  subscription: 'sub_test_123',
  mode: 'subscription',
};

// Mock successful customer portal session
export const MOCK_CUSTOMER_PORTAL = {
  id: 'bps_test_mock_portal_123',
  object: 'billing_portal.session',
  url: 'http://localhost:5173/Settings',
  customer: 'cus_test_123',
  return_url: 'http://localhost:5173/Settings',
};

// Mock subscription data
export const MOCK_SUBSCRIPTION = {
  id: 'sub_test_123',
  object: 'subscription',
  status: 'active',
  current_period_start: Math.floor(Date.now() / 1000),
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  customer: 'cus_test_123',
  items: {
    data: [
      {
        price: {
          id: 'price_pro_monthly',
          product: 'prod_pro',
          unit_amount: 499,
          currency: 'usd',
          recurring: {
            interval: 'month',
          },
        },
      },
    ],
  },
};

// Mock payment intent
export const MOCK_PAYMENT_INTENT = {
  id: 'pi_test_123',
  object: 'payment_intent',
  status: 'succeeded',
  amount: 499,
  currency: 'usd',
  customer: 'cus_test_123',
};

/**
 * Setup Stripe-related API mocks
 * Intercepts calls to Supabase Edge Functions that handle Stripe
 */
export async function setupStripeMocks(page: Page): Promise<void> {
  // Mock create-checkout-session endpoint
  await page.route('**/functions/v1/create-checkout-session**', async (route: Route) => {
    const postData = route.request().postData();
    let tier = 'pro';
    
    if (postData) {
      try {
        const data = JSON.parse(postData);
        tier = data.tier || 'pro';
      } catch {
        // Use default tier
      }
    }
    
    const mockSession = {
      ...MOCK_CHECKOUT_SESSION,
      url: `http://localhost:5173/Settings?success=true&from=free&to=${tier}`,
    };
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: mockSession }),
    });
  });

  // Mock create-customer-portal endpoint
  await page.route('**/functions/v1/create-customer-portal**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_CUSTOMER_PORTAL }),
    });
  });

  // Mock Stripe webhook endpoint (if testing webhook handling)
  await page.route('**/functions/v1/stripe-webhook**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ received: true }),
    });
  });

  // Mock direct Stripe API calls (if any bypass Edge Functions)
  await page.route('**/api.stripe.com/**', async (route: Route) => {
    const url = route.request().url();
    
    if (url.includes('/checkout/sessions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CHECKOUT_SESSION),
      });
    } else if (url.includes('/billing_portal/sessions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CUSTOMER_PORTAL),
      });
    } else if (url.includes('/subscriptions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SUBSCRIPTION),
      });
    } else if (url.includes('/payment_intents')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PAYMENT_INTENT),
      });
    } else {
      // Default response for other Stripe endpoints
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }
  });
}

/**
 * Mock checkout to simulate successful payment flow
 * Redirects directly to success URL instead of Stripe Checkout
 */
export async function mockSuccessfulCheckout(page: Page, fromTier: string = 'free', toTier: string = 'pro'): Promise<void> {
  await page.route('**/functions/v1/create-checkout-session**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          ...MOCK_CHECKOUT_SESSION,
          url: `http://localhost:5173/Settings?success=true&from=${fromTier}&to=${toTier}`,
        },
      }),
    });
  });
}

/**
 * Mock checkout to simulate canceled payment
 */
export async function mockCanceledCheckout(page: Page): Promise<void> {
  await page.route('**/functions/v1/create-checkout-session**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          ...MOCK_CHECKOUT_SESSION,
          url: 'http://localhost:5173/Settings?canceled=true',
        },
      }),
    });
  });
}

/**
 * Mock checkout to simulate an error
 */
export async function mockCheckoutError(page: Page, statusCode: number = 500): Promise<void> {
  await page.route('**/functions/v1/create-checkout-session**', async (route: Route) => {
    await route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Failed to create checkout session',
        message: 'An error occurred while processing your request',
      }),
    });
  });
}

/**
 * Mock customer portal to return error
 */
export async function mockPortalError(page: Page): Promise<void> {
  await page.route('**/functions/v1/create-customer-portal**', async (route: Route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'No subscription found',
        message: 'You must have an active subscription to manage it',
      }),
    });
  });
}

/**
 * Clear all Stripe mocks
 */
export async function clearStripeMocks(page: Page): Promise<void> {
  await page.unroute('**/functions/v1/create-checkout-session**');
  await page.unroute('**/functions/v1/create-customer-portal**');
  await page.unroute('**/functions/v1/stripe-webhook**');
  await page.unroute('**/api.stripe.com/**');
}

/**
 * Intercept navigation to Stripe Checkout and redirect to success/cancel page
 * Use this when the real Stripe Checkout URL would be opened
 */
export async function interceptStripeCheckout(page: Page, simulateSuccess: boolean = true): Promise<void> {
  // Listen for navigation to Stripe
  page.on('request', async (request) => {
    if (request.url().includes('checkout.stripe.com')) {
      // Cancel the navigation and go to our mock result page
      const resultUrl = simulateSuccess
        ? 'http://localhost:5173/Settings?success=true&from=free&to=pro'
        : 'http://localhost:5173/Settings?canceled=true';
      
      await page.goto(resultUrl);
    }
  });
}
