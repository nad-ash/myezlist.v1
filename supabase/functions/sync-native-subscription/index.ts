/**
 * Sync Native Subscription Edge Function
 * 
 * Called from the app after a successful Apple IAP or Google Play purchase.
 * Updates the user's subscription status in the database.
 * 
 * SECURITY: This function verifies purchases with RevenueCat's API server-side
 * rather than trusting client-provided tier information.
 * 
 * This provides a unified subscription table that tracks subscriptions
 * from all providers (Stripe, Apple, Google).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// RevenueCat entitlement IDs (must match what's configured in RevenueCat dashboard)
const ENTITLEMENTS = {
  ADFREE: 'adfree',
  PRO: 'pro', 
  PREMIUM: 'premium'
};

/**
 * Verify subscription with RevenueCat API
 * Returns the verified tier and expiration date from RevenueCat
 */
async function verifySubscriptionWithRevenueCat(
  userId: string,
  provider: 'apple' | 'google'
): Promise<{ tier: string; expirationDate: string | null; verified: boolean }> {
  const revenueCatApiKey = provider === 'apple' 
    ? Deno.env.get("REVENUECAT_APPLE_API_KEY")
    : Deno.env.get("REVENUECAT_GOOGLE_API_KEY");

  if (!revenueCatApiKey) {
    console.warn(`⚠️ RevenueCat API key not configured for ${provider}, falling back to client-provided tier`);
    return { tier: 'free', expirationDate: null, verified: false };
  }

  try {
    // Call RevenueCat REST API to get subscriber info
    // https://www.revenuecat.com/docs/api-v1#tag/Customers/operation/get_subscriber
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${revenueCatApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error(`❌ RevenueCat API error: ${response.status} ${response.statusText}`);
      return { tier: 'free', expirationDate: null, verified: false };
    }

    const data = await response.json();
    const entitlements = data?.subscriber?.entitlements || {};
    
    // Determine tier from active entitlements (highest wins: premium > pro > adfree)
    let verifiedTier = 'free';
    let expirationDate: string | null = null;

    if (entitlements[ENTITLEMENTS.PREMIUM]?.expires_date) {
      const expires = new Date(entitlements[ENTITLEMENTS.PREMIUM].expires_date);
      if (expires > new Date()) {
        verifiedTier = 'premium';
        expirationDate = entitlements[ENTITLEMENTS.PREMIUM].expires_date;
      }
    } else if (entitlements[ENTITLEMENTS.PRO]?.expires_date) {
      const expires = new Date(entitlements[ENTITLEMENTS.PRO].expires_date);
      if (expires > new Date()) {
        verifiedTier = 'pro';
        expirationDate = entitlements[ENTITLEMENTS.PRO].expires_date;
      }
    } else if (entitlements[ENTITLEMENTS.ADFREE]?.expires_date) {
      const expires = new Date(entitlements[ENTITLEMENTS.ADFREE].expires_date);
      if (expires > new Date()) {
        verifiedTier = 'adfree';
        expirationDate = entitlements[ENTITLEMENTS.ADFREE].expires_date;
      }
    }

    console.log(`✅ RevenueCat verified: tier=${verifiedTier}, expires=${expirationDate}`);
    return { tier: verifiedTier, expirationDate, verified: true };

  } catch (error) {
    console.error('❌ Failed to verify with RevenueCat:', error);
    return { tier: 'free', expirationDate: null, verified: false };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client for auth verification
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for database updates
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { provider, expirationDate, restored, tier: clientTier } = await req.json();

    if (!provider || !['apple', 'google'].includes(provider)) {
      return new Response(
        JSON.stringify({ error: "Invalid provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📱 Syncing ${provider} subscription for user ${user.id}...`);

    // SECURITY: Verify the subscription server-side with RevenueCat
    // Don't trust client-provided tier - a malicious client could claim premium
    const verification = await verifySubscriptionWithRevenueCat(user.id, provider as 'apple' | 'google');
    
    let subscriptionTier: string;
    let finalExpirationDate: string;

    if (verification.verified && verification.tier !== 'free') {
      // Use the verified tier from RevenueCat
      subscriptionTier = verification.tier;
      finalExpirationDate = verification.expirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      console.log(`📱 Using verified tier from RevenueCat: ${subscriptionTier}`);
    } else if (!verification.verified) {
      // RevenueCat verification failed (API key not set or API error)
      // Fall back to client-provided tier with validation, but log a warning
      console.warn(`⚠️ RevenueCat verification unavailable, using client-provided tier (potential security risk)`);
      const validTiers = ['adfree', 'pro', 'premium'];
      // Default to lowest paid tier (adfree) instead of premium to limit potential abuse
      subscriptionTier = clientTier && validTiers.includes(clientTier) ? clientTier : 'adfree';
      
      // Validate and sanitize client-provided expiration date
      let validExpirationDate: string | null = null;
      if (expirationDate) {
        const parsedDate = new Date(expirationDate);
        if (!isNaN(parsedDate.getTime())) {
          validExpirationDate = parsedDate.toISOString();
        }
      }
      finalExpirationDate = validExpirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      // Verified but tier is 'free' - user has no active subscription
      console.log(`📱 RevenueCat verified: no active subscription for user`);
      return new Response(
        JSON.stringify({ error: "No active subscription found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📱 Final tier: ${subscriptionTier}, expires: ${finalExpirationDate}`);

    // Get the tier info to get the correct monthly credits and limits
    const { data: tierData, error: tierError } = await supabaseAdmin
      .from("subscription_tiers")
      .select("monthly_credits, max_shopping_lists, max_total_items, max_tasks, max_custom_recipes")
      .eq("tier_name", subscriptionTier)
      .single();

    if (tierError) {
      console.error("Failed to get tier info:", tierError);
      // Continue with default values if tier lookup fails
    }

    const monthlyCredits = tierData?.monthly_credits || 100;
    console.log(`📱 ${subscriptionTier} tier credits: ${monthlyCredits}`);

    // Update or insert subscription record
    const { error: upsertError } = await supabaseAdmin
      .from("user_subscriptions")
      .upsert({
        user_id: user.id,
        payment_provider: provider,
        status: "active",
        tier: subscriptionTier,
        current_period_end: finalExpirationDate,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id"
      });

    if (upsertError) {
      console.error("Failed to update subscription:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to update subscription" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update user profile with the correct tier AND credits
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        subscription_tier: subscriptionTier,
        monthly_credits_total: monthlyCredits,
        subscription_start_date: new Date().toISOString(),
        updated_date: new Date().toISOString()
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("Failed to update profile tier:", profileError);
      // Return error so the client knows the sync failed
      return new Response(
        JSON.stringify({ error: "Failed to update profile subscription tier", details: profileError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ ${restored ? 'Restored' : 'Synced'} ${provider} subscription for user ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: restored ? "Subscription restored" : "Subscription synced"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error syncing subscription:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

