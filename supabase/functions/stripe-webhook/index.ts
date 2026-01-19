// supabase/functions/stripe-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2023-10-16",
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") as string;

// Map Stripe price IDs to subscription tiers
// Uses environment variables to support different IDs for test vs live mode
const PRICE_TO_TIER: Record<string, string> = {};

// Load price IDs from environment variables
const priceAdfree = Deno.env.get("STRIPE_PRICE_ADFREE");
const pricePro = Deno.env.get("STRIPE_PRICE_PRO");
const pricePremium = Deno.env.get("STRIPE_PRICE_PREMIUM");

if (priceAdfree) PRICE_TO_TIER[priceAdfree] = "adfree";
if (pricePro) PRICE_TO_TIER[pricePro] = "pro";
if (pricePremium) PRICE_TO_TIER[pricePremium] = "premium";

// Log the mapping and warn about missing configurations
console.log("Loaded PRICE_TO_TIER mapping:", PRICE_TO_TIER);

const missingPriceVars: string[] = [];
if (!priceAdfree) missingPriceVars.push("STRIPE_PRICE_ADFREE");
if (!pricePro) missingPriceVars.push("STRIPE_PRICE_PRO");
if (!pricePremium) missingPriceVars.push("STRIPE_PRICE_PREMIUM");

if (missingPriceVars.length > 0) {
  console.error(`⚠️ CRITICAL: Missing Stripe price environment variables: ${missingPriceVars.join(", ")}. Subscriptions with unconfigured prices will FAIL to process correctly.`);
}

if (Object.keys(PRICE_TO_TIER).length === 0) {
  console.error("🚨 CRITICAL: PRICE_TO_TIER is EMPTY! No price IDs are configured. ALL subscription webhooks will fail!");
}

// Tier configurations
const TIER_CONFIG: Record<string, { monthly_credits: number }> = {
  free: { monthly_credits: 15 },
  adfree: { monthly_credits: 25 },
  pro: { monthly_credits: 100 },
  premium: { monthly_credits: 250 },
  admin: { monthly_credits: 1000 },
};

/**
 * Sync subscription to unified user_subscriptions table
 * This keeps subscriptions from all providers (Stripe, Apple, Google) in sync
 */
async function syncToUserSubscriptions(
  supabaseClient: any,
  userId: string,
  data: {
    status: string;
    tier: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string | null;
    priceId?: string;
    currentPeriodEnd?: Date | null;
    cancelledAt?: Date | null;
  }
) {
  try {
    const { error } = await supabaseClient
      .from("user_subscriptions")
      .upsert({
        user_id: userId,
        payment_provider: "stripe",
        status: data.status,
        tier: data.tier,
        stripe_customer_id: data.stripeCustomerId,
        stripe_subscription_id: data.stripeSubscriptionId,
        price_id: data.priceId,
        current_period_end: data.currentPeriodEnd?.toISOString() || null,
        cancelled_at: data.cancelledAt?.toISOString() || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id"
      });

    if (error) {
      console.error("Failed to sync to user_subscriptions:", error);
    } else {
      console.log(`Synced to user_subscriptions: user ${userId}, status ${data.status}`);
    }
  } catch (err) {
    console.error("Error syncing to user_subscriptions:", err);
  }
}

/**
 * Find user ID by stripe_customer_id as a fallback
 */
async function findUserByCustomerId(supabaseClient: any, customerId: string): Promise<string | null> {
  console.log(`Looking up user by stripe_customer_id: ${customerId}`);
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (error) {
    console.error(`Error finding user by customer ID ${customerId}:`, error);
    return null;
  }

  console.log(`Found user ${data?.id} for customer ${customerId}`);
  return data?.id || null;
}

/**
 * Get user ID from various sources with fallbacks
 */
async function resolveUserId(
  supabaseClient: any,
  metadata: Record<string, string> | null | undefined,
  customerId: string | null | undefined
): Promise<string | null> {
  // First try metadata
  if (metadata?.supabase_user_id) {
    console.log(`Found user ID in metadata: ${metadata.supabase_user_id}`);
    return metadata.supabase_user_id;
  }

  // Fallback to looking up by customer ID
  if (customerId) {
    return await findUserByCustomerId(supabaseClient, customerId);
  }

  console.warn("No user ID found in metadata and no customer ID provided");
  return null;
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error("No stripe-signature header found");
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

    console.log(`=== Processing event: ${event.type} ===`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`Checkout session completed: ${session.id}`);
        console.log(`Session metadata:`, JSON.stringify(session.metadata));
        console.log(`Customer ID: ${session.customer}`);
        
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (!subscriptionId) {
          console.error("No subscription ID in checkout session");
          break;
        }

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        console.log(`Subscription retrieved: ${subscription.id}, status: ${subscription.status}`);
        console.log(`Subscription metadata:`, JSON.stringify(subscription.metadata));
        
        const priceId = subscription.items.data[0]?.price.id;
        console.log(`Price ID: ${priceId}`);
        
        const tier = PRICE_TO_TIER[priceId];
        if (!tier) {
          console.error(`🚨 CRITICAL: Unknown price ID: ${priceId}. Known prices: [${Object.keys(PRICE_TO_TIER).join(", ")}]`);
          console.error(`Cannot process subscription - price ID not mapped to a tier. Configure STRIPE_PRICE_* environment variables.`);
          // Return 500 to tell Stripe to retry - this gives operators time to fix the configuration
          return new Response(
            JSON.stringify({ 
              error: "Price ID not configured", 
              priceId,
              knownPrices: Object.keys(PRICE_TO_TIER) 
            }), 
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
        console.log(`Tier resolved to: ${tier}`);

        // Try to find user ID from session metadata, subscription metadata, or customer lookup
        let userId = session.metadata?.supabase_user_id || subscription.metadata?.supabase_user_id;
        
        if (!userId && customerId) {
          userId = await findUserByCustomerId(supabaseClient, customerId);
        }

        if (!userId) {
          console.error("Could not resolve user ID from any source");
          console.error("Session metadata:", session.metadata);
          console.error("Subscription metadata:", subscription.metadata);
          console.error("Customer ID:", customerId);
          break;
        }

        console.log(`Updating user ${userId} to tier ${tier}`);

        // Update user profile
        const { data: updateData, error: updateError } = await supabaseClient
          .from("profiles")
          .update({
            subscription_tier: tier,
            stripe_customer_id: customerId, // Ensure customer ID is stored
            stripe_subscription_id: subscriptionId,
            stripe_subscription_status: subscription.status,
            subscription_start_date: new Date().toISOString(),
            monthly_credits_total: TIER_CONFIG[tier]?.monthly_credits || 100,
            credits_used_this_month: 0,
            credits_reset_date: new Date().toISOString(),
            last_payment_date: new Date().toISOString(),
          })
          .eq("id", userId)
          .select();

        if (updateError) {
          console.error(`FAILED to update user ${userId}:`, updateError);
        } else {
          console.log(`SUCCESS: User ${userId} upgraded to ${tier}`);
          console.log(`Update result:`, JSON.stringify(updateData));
          
          // Sync to unified user_subscriptions table
          await syncToUserSubscriptions(supabaseClient, userId, {
            status: "active",
            tier,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            priceId,
            currentPeriodEnd: subscription.current_period_end 
              ? new Date(subscription.current_period_end * 1000) 
              : null
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`=== SUBSCRIPTION UPDATED EVENT ===`);
        console.log(`Subscription ID: ${subscription.id}`);
        console.log(`Status: ${subscription.status}`);
        console.log(`cancel_at_period_end: ${subscription.cancel_at_period_end}`);
        console.log(`canceled_at: ${subscription.canceled_at}`);
        console.log(`cancel_at: ${subscription.cancel_at}`);
        console.log(`Customer ID: ${subscription.customer}`);
        console.log(`Metadata:`, JSON.stringify(subscription.metadata));
        
        const customerId = subscription.customer as string;
        const userId = await resolveUserId(supabaseClient, subscription.metadata, customerId);
        
        console.log(`Resolved userId: ${userId}`);
        
        if (!userId) {
          console.error("Could not resolve user ID for subscription update");
          break;
        }

        const priceId = subscription.items.data[0]?.price.id;
        const tier = PRICE_TO_TIER[priceId];
        
        if (!tier && subscription.status !== "canceled") {
          console.error(`🚨 CRITICAL: Unknown price ID in subscription update: ${priceId}. Known prices: [${Object.keys(PRICE_TO_TIER).join(", ")}]`);
          console.error(`Cannot process subscription update - price ID not mapped to a tier. Configure STRIPE_PRICE_* environment variables.`);
          // Return 500 to tell Stripe to retry - this gives operators time to fix the configuration
          return new Response(
            JSON.stringify({ 
              error: "Price ID not configured", 
              priceId,
              knownPrices: Object.keys(PRICE_TO_TIER) 
            }), 
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
        console.log(`Price ID: ${priceId}, Tier: ${tier || "(canceled)"}`);

        // Check if subscription is being canceled
        const isCanceled = subscription.status === "canceled";
        const isCanceledAtPeriodEnd = subscription.cancel_at_period_end === true;
        const canceledAt = subscription.canceled_at;
        
        console.log(`isCanceled: ${isCanceled}`);
        console.log(`isCanceledAtPeriodEnd: ${isCanceledAtPeriodEnd}`);
        console.log(`canceledAt truthy: ${!!canceledAt}`);

        let updateData: Record<string, any>;

        if (isCanceled) {
          // Subscription is fully canceled - downgrade to free
          console.log(`Subscription canceled for user ${userId}, downgrading to free`);
          updateData = {
            subscription_tier: "free",
            stripe_subscription_id: null,
            stripe_subscription_status: "canceled",
            subscription_end_date: new Date().toISOString(),
            monthly_credits_total: TIER_CONFIG["free"]?.monthly_credits || 15,
          };
        } else if (isCanceledAtPeriodEnd && canceledAt) {
          // Subscription will cancel at end of period - mark as pending cancellation
          // Keep status as "active" (valid DB value) but set cancel_reason to indicate pending
          console.log(`>>> PENDING CANCEL DETECTED for user ${userId}`);
          const cancelAtDate = subscription.cancel_at 
            ? new Date(subscription.cancel_at * 1000).toISOString() 
            : null;
          console.log(`cancelAtDate: ${cancelAtDate}`);
          updateData = {
            stripe_subscription_status: "active", // Keep as active (valid DB constraint value)
            subscription_cancel_reason: "pending_cancel", // Use this field to indicate pending cancellation
            subscription_end_date: cancelAtDate, // When it will actually end
            // Keep current tier until period ends
          };
          console.log(`updateData:`, JSON.stringify(updateData));
        } else if (isCanceledAtPeriodEnd === false && subscription.status === "active") {
          // User might have reactivated - clear cancel info
          // tier is guaranteed to be defined here because we return 500 for unknown prices when not canceled
          console.log(`Subscription reactivated for user ${userId}`);
          updateData = {
            subscription_tier: tier!,
            stripe_subscription_status: subscription.status,
            subscription_cancel_reason: null,
            subscription_end_date: null,
            monthly_credits_total: TIER_CONFIG[tier!]?.monthly_credits || 100,
          };
        } else {
          // Normal update (e.g., plan change)
          // tier is guaranteed to be defined here because we return 500 for unknown prices when not canceled
          updateData = {
            subscription_tier: tier!,
            stripe_subscription_status: subscription.status,
            monthly_credits_total: TIER_CONFIG[tier!]?.monthly_credits || 100,
          };
        }

        const { error: updateError } = await supabaseClient
          .from("profiles")
          .update(updateData)
          .eq("id", userId);

        if (updateError) {
          console.error(`FAILED to update subscription for user ${userId}:`, updateError);
        } else {
          console.log(`SUCCESS: User ${userId} subscription updated`, updateData);
          
          // Sync to unified user_subscriptions table
          await syncToUserSubscriptions(supabaseClient, userId, {
            status: isCanceled ? "expired" : (isCanceledAtPeriodEnd ? "cancelled" : "active"),
            tier: isCanceled ? "free" : (tier || "free"),
            stripeCustomerId: customerId,
            stripeSubscriptionId: isCanceled ? null : subscription.id,
            priceId,
            currentPeriodEnd: subscription.current_period_end 
              ? new Date(subscription.current_period_end * 1000) 
              : null,
            cancelledAt: canceledAt ? new Date(canceledAt * 1000) : null
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Subscription deleted: ${subscription.id}`);
        
        const customerId = subscription.customer as string;
        const userId = await resolveUserId(supabaseClient, subscription.metadata, customerId);

        if (!userId) {
          console.error("Could not resolve user ID for subscription deletion");
          break;
        }

        // Downgrade to free tier
        const { error: updateError } = await supabaseClient
          .from("profiles")
          .update({
            subscription_tier: "free",
            stripe_subscription_id: null,
            stripe_subscription_status: "canceled",
            subscription_end_date: new Date().toISOString(),
            monthly_credits_total: 15,
          })
          .eq("id", userId);

        if (updateError) {
          console.error(`FAILED to downgrade user ${userId}:`, updateError);
        } else {
          console.log(`SUCCESS: User ${userId} subscription canceled, downgraded to free`);
          
          // Sync to unified user_subscriptions table
          await syncToUserSubscriptions(supabaseClient, userId, {
            status: "expired",
            tier: "free",
            stripeCustomerId: customerId,
            stripeSubscriptionId: null,
            currentPeriodEnd: null,
            cancelledAt: new Date()
          });
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice payment succeeded: ${invoice.id}`);
        
        const subscriptionId = invoice.subscription as string;
        const customerId = invoice.customer as string;

        if (!subscriptionId) {
          console.log("No subscription ID on invoice, skipping");
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = await resolveUserId(supabaseClient, subscription.metadata, customerId);

        if (!userId) {
          console.error("Could not resolve user ID for payment success");
          break;
        }

        const { error: updateError } = await supabaseClient
          .from("profiles")
          .update({
            last_payment_date: new Date().toISOString(),
          })
          .eq("id", userId);

        if (updateError) {
          console.error(`FAILED to update last_payment_date for user ${userId}:`, updateError);
        } else {
          console.log(`SUCCESS: User ${userId} payment succeeded, last_payment_date updated`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice payment failed: ${invoice.id}`);
        
        const subscriptionId = invoice.subscription as string;
        const customerId = invoice.customer as string;

        if (!subscriptionId) {
          console.log("No subscription ID on invoice, skipping");
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = await resolveUserId(supabaseClient, subscription.metadata, customerId);

        if (!userId) {
          console.error("Could not resolve user ID for payment failure");
          break;
        }

        const { error: updateError } = await supabaseClient
          .from("profiles")
          .update({
            stripe_subscription_status: "past_due",
          })
          .eq("id", userId);

        if (updateError) {
          console.error(`FAILED to update status for user ${userId}:`, updateError);
        } else {
          console.log(`SUCCESS: User ${userId} marked as past_due`);
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
