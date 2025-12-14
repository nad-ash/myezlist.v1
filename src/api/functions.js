/**
 * Serverless Functions
 * 
 * This file exports serverless functions with automatic provider switching.
 * Based on BACKEND_PROVIDER config, functions use either Base44 or Supabase Edge Functions.
 */

import { BACKEND_PROVIDER } from './config';
import { base44 } from './base44Client';
import * as supabaseFunctions from './supabaseFunctions';

// ==========================================
// FUNCTION EXPORTS
// Automatically switches between Base44 and Supabase based on BACKEND_PROVIDER
// ==========================================

// Helper to get function from the correct provider
const getFunction = (functionName) => {
  if (BACKEND_PROVIDER === 'supabase') {
    // Return Supabase Edge Function
    return supabaseFunctions[functionName] || (async () => {
      throw new Error(`Supabase function '${functionName}' not implemented`);
    });
  }
  // Return Base44 function
  return base44.functions?.[functionName] || (async () => {
    throw new Error(`Function '${functionName}' not available`);
  });
};

// Stripe Payment Functions
export const createCheckoutSession = getFunction('createCheckoutSession');
export const createCustomerPortal = getFunction('createCustomerPortal');
export const stripeWebhook = getFunction('stripeWebhook');

// Subscription Management
export const manualUpgrade = getFunction('manualUpgrade');

// Admin Functions
export const backfillActivityTracking = getFunction('backfillActivityTracking');

// App Manifest
export const manifest = getFunction('manifest');

// Statistics - Atomic update function
export const updateStatCount = getFunction('updateStatCount');

// Analytics - Aggregated activity stats (scalable)
export const getActivityStats = getFunction('getActivityStats');
