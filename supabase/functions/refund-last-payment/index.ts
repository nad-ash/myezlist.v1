// supabase/functions/refund-last-payment/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
      apiVersion: "2023-10-16",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // Use service role for admin operations
    );

    // Get the requesting user from the auth header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    
    const supabaseAuthClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    
    const { data: { user: requestingUser }, error: userError } = await supabaseAuthClient.auth.getUser(token);

    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is admin
    const { data: adminProfile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", requestingUser.id)
      .single();

    if (adminProfile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the target user's profile
    const { data: targetProfile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("stripe_customer_id, stripe_subscription_status, subscription_cancel_reason, email")
      .eq("id", userId)
      .single();

    if (profileError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if subscription is canceled or pending cancellation
    // Canceled: stripe_subscription_status === 'canceled'
    // Pending cancel: subscription_cancel_reason === 'pending_cancel'
    const isCanceled = targetProfile.stripe_subscription_status === "canceled";
    const isPendingCancel = targetProfile.subscription_cancel_reason === "pending_cancel";
    
    if (!isCanceled && !isPendingCancel) {
      return new Response(
        JSON.stringify({ error: "Refund only allowed for canceled or pending cancellation subscriptions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!targetProfile.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: "No Stripe customer found for this user" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the last successful charge for this customer
    const charges = await stripe.charges.list({
      customer: targetProfile.stripe_customer_id,
      limit: 1,
    });

    if (charges.data.length === 0) {
      return new Response(
        JSON.stringify({ error: "No payments found for this customer" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lastCharge = charges.data[0];

    // Check if already refunded
    if (lastCharge.refunded) {
      return new Response(
        JSON.stringify({ error: "This payment has already been refunded" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the charge is refundable (not too old, etc.)
    if (lastCharge.status !== "succeeded") {
      return new Response(
        JSON.stringify({ error: "Last charge was not successful and cannot be refunded" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the refund
    const refund = await stripe.refunds.create({
      charge: lastCharge.id,
      reason: "requested_by_customer",
    });

    if (refund.status === "succeeded" || refund.status === "pending") {
      // Update the user's profile with last_refunded_date
      await supabaseClient
        .from("profiles")
        .update({
          last_refunded_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        })
        .eq("id", userId);

      // Log the refund action
      await supabaseClient
        .from("activity_tracking")
        .insert({
          operation_type: "UPDATE",
          page: "UserManagement",
          operation_name: "Admin Refund Processed",
          description: `Refunded $${(lastCharge.amount / 100).toFixed(2)} for ${targetProfile.email}`,
          user_id: userId,
        });

      return new Response(
        JSON.stringify({
          success: true,
          refundId: refund.id,
          amount: lastCharge.amount / 100,
          currency: lastCharge.currency,
          status: refund.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: `Refund failed with status: ${refund.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error processing refund:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

