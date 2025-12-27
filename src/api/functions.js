/**
 * Serverless Functions
 * 
 * This file exports serverless functions using Supabase Edge Functions.
 */

import * as supabaseFunctions from './supabaseFunctions';

// ==========================================
// FUNCTION EXPORTS
// ==========================================

// Stripe Payment Functions
export const createCheckoutSession = supabaseFunctions.createCheckoutSession;
export const createCustomerPortal = supabaseFunctions.createCustomerPortal;
export const stripeWebhook = supabaseFunctions.stripeWebhook;

// Subscription Management
export const manualUpgrade = supabaseFunctions.manualUpgrade;
export const refundLastPayment = supabaseFunctions.refundLastPayment;

// Admin Functions
export const backfillActivityTracking = supabaseFunctions.backfillActivityTracking;

// App Manifest
export const manifest = supabaseFunctions.manifest;

// Statistics - Atomic update function
export const updateStatCount = supabaseFunctions.updateStatCount;

// Analytics - Aggregated activity stats (scalable)
export const getActivityStats = supabaseFunctions.getActivityStats;
