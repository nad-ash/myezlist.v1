/**
 * Supabase Edge Functions
 * 
 * This file provides functions that call Supabase Edge Functions
 * for server-side operations like Stripe payments.
 */

import { supabase } from './supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Call a Supabase Edge Function
 * @param {string} functionName - Name of the edge function
 * @param {Object} body - Request body
 * @returns {Promise<Object>} - Response data
 */
async function callEdgeFunction(functionName, body = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Edge function ${functionName} failed`);
  }

  return data;
}

// Map tier names to Stripe Price IDs
// TODO: Replace these with your actual Stripe Price IDs from the Stripe Dashboard
// Go to Stripe Dashboard → Products → Click product → Copy the Price ID (starts with price_)
const TIER_TO_PRICE_ID = {
  adfree: import.meta.env.VITE_STRIPE_PRICE_ADFREE || 'price_REPLACE_WITH_ADFREE_PRICE_ID',
  pro: import.meta.env.VITE_STRIPE_PRICE_PRO || 'price_REPLACE_WITH_PRO_PRICE_ID',
  premium: import.meta.env.VITE_STRIPE_PRICE_PREMIUM || 'price_REPLACE_WITH_PREMIUM_PRICE_ID',
};

/**
 * Create a Stripe Checkout Session
 * @param {Object} params - { priceId OR tier, successUrl, cancelUrl }
 * @returns {Promise<Object>} - { sessionId, url }
 */
export async function createCheckoutSession({ priceId, tier, successUrl, cancelUrl }) {
  // Support both priceId directly or tier name (which gets mapped to priceId)
  let finalPriceId = priceId;
  
  if (!finalPriceId && tier) {
    finalPriceId = TIER_TO_PRICE_ID[tier];
    if (!finalPriceId || finalPriceId.includes('REPLACE_WITH')) {
      throw new Error(`Stripe Price ID not configured for tier "${tier}". Please add VITE_STRIPE_PRICE_${tier.toUpperCase()} to your .env file.`);
    }
  }

  if (!finalPriceId) {
    throw new Error('Either priceId or tier must be provided');
  }

  const data = await callEdgeFunction('create-checkout-session', {
    priceId: finalPriceId,
    successUrl: successUrl || `${window.location.origin}/settings?success=true`,
    cancelUrl: cancelUrl || `${window.location.origin}/settings?canceled=true`,
  });

  // Redirect to Stripe Checkout
  if (data.url) {
    window.location.href = data.url;
  }

  return data;
}

/**
 * Create a Stripe Customer Portal session
 * @param {Object} params - { returnUrl }
 * @returns {Promise<Object>} - { url }
 */
export async function createCustomerPortal({ returnUrl } = {}) {
  const data = await callEdgeFunction('create-customer-portal', {
    returnUrl: returnUrl || `${window.location.origin}/settings`,
  });

  // Redirect to Customer Portal
  if (data.url) {
    window.location.href = data.url;
  }

  return data;
}

/**
 * Stripe webhook (not called from frontend - handled by Stripe)
 */
export async function stripeWebhook() {
  throw new Error('Stripe webhook should not be called from frontend');
}

/**
 * Manual upgrade (admin function)
 * @param {Object} params - { userId, tier }
 */
export async function manualUpgrade({ userId, tier }) {
  // This can be done directly via Supabase for admin users
  const { data, error } = await supabase
    .from('profiles')
    .update({
      subscription_tier: tier,
      monthly_credits_total: getTierCredits(tier),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Refund last payment (admin function)
 * @param {Object} params - { userId }
 * @returns {Promise<Object>} - { success, refundId, amount, currency, status }
 */
export async function refundLastPayment({ userId }) {
  return await callEdgeFunction('refund-last-payment', { userId });
}

/**
 * Backfill activity tracking (admin function)
 */
export async function backfillActivityTracking() {
  console.warn('backfillActivityTracking: This should be run as a database migration or admin script');
  return { success: true, message: 'Not implemented for Supabase - run as SQL migration' };
}

/**
 * Get PWA manifest
 */
export async function manifest() {
  // Return static manifest or fetch from public folder
  return {
    name: 'MyEZList',
    short_name: 'MyEZList',
    start_url: '/',
    display: 'standalone',
    theme_color: '#3B82F6',
    background_color: '#ffffff',
  };
}

// Helper function to get credits for a tier
function getTierCredits(tier) {
  const credits = {
    free: 15,
    adfree: 25,
    pro: 100,
    premium: 250,
    admin: 1000,
  };
  return credits[tier] || 15;
}

/**
 * Get aggregated activity stats (scalable - computed server-side)
 * @param {string|null} cutoffDate - ISO date string for filtering, or null for all time
 * @returns {Promise<Object>} - Aggregated stats object
 */
export async function getActivityStats(cutoffDate = null) {
  const { data, error } = await supabase.rpc('get_activity_stats', {
    cutoff_date: cutoffDate
  });
  
  if (error) {
    console.error('Failed to get activity stats:', error);
    throw error;
  }
  
  return data;
}

/**
 * Atomically update a statistic count (increment or decrement)
 * Uses PostgreSQL function to prevent race conditions
 * @param {string} statKey - The stat_key to update (e.g., 'total_items', 'total_tasks')
 * @param {number} delta - Amount to add (positive) or subtract (negative). Default: 1
 * @returns {Promise<number>} The new count value
 */
export async function updateStatCount(statKey, delta = 1) {
  const { data, error } = await supabase.rpc('update_stat_count', {
    stat_key_param: statKey,
    delta: delta
  });
  
  if (error) {
    console.error(`Failed to atomically update stat ${statKey}:`, error);
    throw error;
  }
  
  console.log(`📊 Atomic stat update: ${statKey} ${delta >= 0 ? '+' : ''}${delta} → new count: ${data}`);
  return data;
}

/**
 * Securely join a list via share token
 * Validates the token server-side and creates a membership request
 * 
 * @param {string} shareToken - The share link token
 * @returns {Promise<Object>} Result object with:
 *   - success: boolean
 *   - status: 'pending' | 'already_pending' | 'already_approved' (if success)
 *     - 'pending': New membership request created
 *     - 'already_pending': User already has a pending request (no new record created)
 *     - 'already_approved': User already has access to the list
 *   - error: 'invalid_token' | 'not_authenticated' | 'server_error' (if !success)
 *   - list_id: UUID (if success)
 *   - list_name: string (if success)
 *   - message: string
 */
export async function joinListViaShareToken(shareToken) {
  const { data, error } = await supabase.rpc('join_list_via_share_token', {
    share_token: shareToken
  });
  
  if (error) {
    console.error('Failed to join list via share token:', error);
    throw error;
  }
  
  return data;
}

/**
 * Validate a share token (can be called before authentication)
 * Used to show "Sign in to join" UI with list name
 * 
 * @param {string} shareToken - The share link token to validate
 * @returns {Promise<Object>} Result object with:
 *   - valid: boolean
 *   - list_name: string (if valid)
 *   - message: string (if !valid)
 */
export async function validateShareToken(shareToken) {
  const { data, error } = await supabase.rpc('validate_share_token', {
    share_token: shareToken
  });
  
  if (error) {
    console.error('Failed to validate share token:', error);
    // Return invalid rather than throwing for better UX
    return { valid: false, message: 'Unable to validate share link' };
  }
  
  return data;
}

