/**
 * Sync Native Subscription Edge Function
 * 
 * Called from the app after a successful Apple IAP or Google Play purchase.
 * Updates the user's subscription status in the database.
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
    const { provider, expirationDate, restored, tier } = await req.json();

    if (!provider || !['apple', 'google'].includes(provider)) {
      return new Response(
        JSON.stringify({ error: "Invalid provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate tier (default to 'premium' for backwards compatibility)
    const validTiers = ['adfree', 'pro', 'premium'];
    const subscriptionTier = tier && validTiers.includes(tier) ? tier : 'premium';

    // Validate and sanitize expiration date
    let validExpirationDate: string | null = null;
    if (expirationDate) {
      const parsedDate = new Date(expirationDate);
      if (!isNaN(parsedDate.getTime())) {
        validExpirationDate = parsedDate.toISOString();
      } else {
        console.warn(`📱 Invalid expiration date format received: ${expirationDate}, using default`);
      }
    }
    // Default to 30 days from now if no valid date provided
    const finalExpirationDate = validExpirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`📱 Syncing ${provider} subscription for user ${user.id}, tier: ${subscriptionTier}`);

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

