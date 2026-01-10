/**
 * RevenueCat Webhook Handler
 * 
 * Receives webhook events from RevenueCat when subscription status changes:
 * - INITIAL_PURCHASE: New subscription started
 * - RENEWAL: Subscription renewed
 * - CANCELLATION: User cancelled (still active until period end)
 * - EXPIRATION: Subscription expired
 * - BILLING_ISSUE: Payment failed
 * - PRODUCT_CHANGE: User changed subscription plan
 * 
 * SETUP:
 * 1. In RevenueCat dashboard, go to Project Settings > Integrations > Webhooks
 * 2. Add webhook URL: https://your-project.supabase.co/functions/v1/revenuecat-webhook
 * 3. Set Authorization header to match REVENUECAT_WEBHOOK_SECRET
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REVENUECAT_WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify webhook secret
    const authHeader = req.headers.get("Authorization");
    if (REVENUECAT_WEBHOOK_SECRET && authHeader !== `Bearer ${REVENUECAT_WEBHOOK_SECRET}`) {
      console.error("Invalid webhook secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook event
    const event = await req.json();
    
    console.log(`📩 RevenueCat webhook: ${event.event?.type || 'unknown'}`);

    const eventType = event.event?.type;
    const appUserId = event.event?.app_user_id;
    const productId = event.event?.product_id;
    const expirationDate = event.event?.expiration_at_ms 
      ? new Date(event.event.expiration_at_ms).toISOString()
      : null;

    if (!appUserId) {
      console.log("No app_user_id in event, skipping");
      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine the store (apple or google) from the event
    const store = event.event?.store || "unknown";
    const provider = store === "APP_STORE" ? "apple" : store === "PLAY_STORE" ? "google" : store;

    // Handle different event types
    switch (eventType) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "UNCANCELLATION":
        // Subscription is active
        await updateSubscriptionStatus(supabase, appUserId, {
          status: "active",
          tier: "premium",
          provider,
          expirationDate,
          productId
        });
        break;

      case "CANCELLATION":
        // User cancelled but still has access until period end
        await updateSubscriptionStatus(supabase, appUserId, {
          status: "cancelled",
          tier: "premium", // Still premium until expiration
          provider,
          expirationDate,
          productId,
          cancelledAt: new Date().toISOString()
        });
        break;

      case "EXPIRATION":
        // Subscription expired - downgrade to free
        await updateSubscriptionStatus(supabase, appUserId, {
          status: "expired",
          tier: "free",
          provider,
          expirationDate: null,
          productId
        });
        break;

      case "BILLING_ISSUE":
        // Payment failed - might enter grace period
        await updateSubscriptionStatus(supabase, appUserId, {
          status: "billing_issue",
          tier: "premium", // Still premium during grace period
          provider,
          expirationDate,
          productId
        });
        break;

      case "PRODUCT_CHANGE":
        // User changed subscription plan
        await updateSubscriptionStatus(supabase, appUserId, {
          status: "active",
          tier: "premium",
          provider,
          expirationDate,
          productId
        });
        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Update user's subscription status in the database
 */
async function updateSubscriptionStatus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  data: {
    status: string;
    tier: string;
    provider: string;
    expirationDate: string | null;
    productId?: string;
    cancelledAt?: string;
  }
) {
  console.log(`Updating subscription for user ${userId}:`, data);

  // Update user_subscriptions table
  const { error: subError } = await supabase
    .from("user_subscriptions")
    .upsert({
      user_id: userId,
      payment_provider: data.provider,
      status: data.status,
      tier: data.tier,
      product_id: data.productId,
      current_period_end: data.expirationDate,
      cancelled_at: data.cancelledAt,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "user_id"
    });

  if (subError) {
    console.error("Failed to update user_subscriptions:", subError);
  }

  // Update profile tier
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ 
      tier: data.tier,
      updated_at: new Date().toISOString()
    })
    .eq("id", userId);

  if (profileError) {
    console.error("Failed to update profile tier:", profileError);
  }

  console.log(`✅ Updated subscription for user ${userId} to ${data.tier}`);
}

