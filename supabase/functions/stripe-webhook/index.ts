// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2023-10-16",
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") as string;

// Map Stripe price IDs to subscription tiers
const PRICE_TO_TIER: Record<string, string> = {
  // Add your Stripe price IDs here
  "price_1SPeiTFMuPSjYr4KyTxOKEP8": "adfree",
  "price_1SPemvFMuPSjYr4KOW0L2OCr": "pro",
  "price_1SPesAFMuPSjYr4KIdi5yR3o": "premium"
};

// Tier configurations
const TIER_CONFIG: Record<string, { monthly_credits: number }> = {
  free: { monthly_credits: 15 },
  adfree: { monthly_credits: 25 },
  pro: { monthly_credits: 100 },
  premium: { monthly_credits: 250 },
  admin: { monthly_credits: 1000 },
};

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    
    // Verify the webhook signature (use async version for Deno)
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // Use service role for admin operations
    );

    console.log(`Processing event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const subscriptionId = session.subscription as string;

        if (userId && subscriptionId) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;
          const tier = PRICE_TO_TIER[priceId] || "pro"; // Default to pro if not mapped

          // Update user profile
          await supabaseClient
            .from("profiles")
            .update({
              subscription_tier: tier,
              stripe_subscription_id: subscriptionId,
              stripe_subscription_status: subscription.status,
              subscription_start_date: new Date().toISOString(),
              monthly_credits_total: TIER_CONFIG[tier]?.monthly_credits || 100,
              credits_used_this_month: 0,
              credits_reset_date: new Date().toISOString(),
            })
            .eq("id", userId);

          console.log(`User ${userId} upgraded to ${tier}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;
        
        if (userId) {
          const priceId = subscription.items.data[0]?.price.id;
          const tier = PRICE_TO_TIER[priceId] || "pro";

          await supabaseClient
            .from("profiles")
            .update({
              subscription_tier: tier,
              stripe_subscription_status: subscription.status,
              monthly_credits_total: TIER_CONFIG[tier]?.monthly_credits || 100,
            })
            .eq("id", userId);

          console.log(`User ${userId} subscription updated to ${tier}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.supabase_user_id;

        if (userId) {
          // Downgrade to free tier
          await supabaseClient
            .from("profiles")
            .update({
              subscription_tier: "free",
              stripe_subscription_id: null,
              stripe_subscription_status: "canceled",
              subscription_end_date: new Date().toISOString(),
              monthly_credits_total: 15,
            })
            .eq("id", userId);

          console.log(`User ${userId} subscription canceled, downgraded to free`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const userId = subscription.metadata?.supabase_user_id;

          if (userId) {
            await supabaseClient
              .from("profiles")
              .update({
                stripe_subscription_status: "past_due",
              })
              .eq("id", userId);

            console.log(`User ${userId} payment failed`);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(`Webhook Error: ${error.message}`, { status: 500 });
  }
});

