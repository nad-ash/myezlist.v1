import React, { useState, useEffect } from "react";
import { User, SubscriptionTier, PremiumFeature } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Crown, 
  Zap, 
  ShoppingCart, 
  CheckCircle2, 
  List, 
  ChefHat,
  Loader2,
  ExternalLink,
  CheckCircle,
  XCircle,
  CreditCard,
  Package,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserTierInfo } from "@/components/utils/tierManager";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { createCheckoutSession } from "@/api/functions";
import { createCustomerPortal } from "@/api/functions";
import { appCache } from "@/components/utils/appCache";

const tierIcons = {
  free: Package,
  adfree: ShoppingCart,
  pro: Zap,
  premium: Crown
};

const tierColors = {
  free: "from-slate-400 to-slate-600",
  adfree: "from-blue-400 to-blue-600",
  pro: "from-purple-400 to-purple-600",
  premium: "from-amber-400 to-amber-600"
};

const tierDisplayNames = {
  free: "Free",
  adfree: "Ad-Free",
  pro: "Pro",
  premium: "Premium"
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [tierInfo, setTierInfo] = useState(null);
  const [allTiers, setAllTiers] = useState([]);
  const [premiumFeatures, setPremiumFeatures] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showCancelMessage, setShowCancelMessage] = useState(false);
  const [upgradeDetails, setUpgradeDetails] = useState({ from: '', to: '' });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasSuccess = urlParams.get('success') === 'true';
    const fromTier = urlParams.get('from') || '';
    const toTier = urlParams.get('to') || '';
    
    // CRITICAL FIX: Clear user cache when returning from successful payment
    // This forces fresh API call to get updated subscription tier
    if (hasSuccess) {
      console.log('🔄 Payment success detected - clearing user cache to fetch updated tier');
      appCache.clearUser();
    }
    
    // Store upgrade details
    if (hasSuccess && fromTier && toTier) {
      setUpgradeDetails({ from: fromTier, to: toTier });
    }
    
    // Load data first, with retry logic for webhook processing
    loadDataWithRetry(hasSuccess, toTier);
    
    // Check URL params after data is loaded
    if (hasSuccess) {
      setShowSuccessMessage(true);
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (urlParams.get('canceled') === 'true') {
      setShowCancelMessage(true);
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
      // Auto-hide cancel message after 5 seconds
      setTimeout(() => setShowCancelMessage(false), 5000);
    }
    
    // Check initial theme
    setIsDarkMode(document.documentElement.classList.contains('theme-dark'));
    
    // Watch for theme changes
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('theme-dark'));
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const loadDataWithRetry = async (isAfterPayment = false, expectedTier = '', maxRetries = 5) => {
    setLoading(true);
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Wait longer on each retry to give webhook more time
        if (isAfterPayment && attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        } else if (isAfterPayment) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const info = await getUserTierInfo();
        
        // Check if webhook has processed (tier matches expected tier)
        if (!isAfterPayment || !expectedTier || info.tier.tier_name === expectedTier || attempt === maxRetries - 1) {
          setTierInfo(info);
          
          const tiers = await SubscriptionTier.list('sort_order');
          setAllTiers(tiers.filter(t => t.tier_name !== 'admin'));

          const features = await PremiumFeature.list('category');
          setPremiumFeatures(features.filter(f => f.is_active));
          
          setLoading(false);
          return;
        }
        
        // If tier hasn't updated yet, clear cache and retry
        console.log(`Attempt ${attempt + 1}: Webhook not processed yet, clearing cache and retrying...`);
        appCache.clearUser();
      } catch (error) {
        console.error("Error loading data:", error);
        if (attempt === maxRetries - 1) {
          setLoading(false);
          return;
        }
      }
    }
    
    setLoading(false);
  };

  const handleUpgrade = async (tierName) => {
    if (upgrading) return;
    
    setUpgrading(true);
    try {
      const { data } = await createCheckoutSession({ tier: tierName });
      
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      alert("Failed to start checkout. Please try again.");
      setUpgrading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (managingSubscription) return;
    
    setManagingSubscription(true);
    try {
      // createCustomerPortal already handles the redirect internally
      // It returns { url: "..." } and redirects to that URL
      const response = await createCustomerPortal();
      console.log('Portal response:', response);
      
      // The redirect happens inside createCustomerPortal, but just in case:
      if (response && response.url) {
        window.location.href = response.url;
      } else if (response && response.data && response.data.url) {
        // Fallback for wrapped response
        window.location.href = response.data.url;
      }
      // If we get here without redirect, the function already handled it
    } catch (error) {
      console.error("Error opening customer portal:", error);
      alert("Failed to open subscription management. Please try again.");
      setManagingSubscription(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">
          {showSuccessMessage ? 'Processing your subscription...' : 'Loading settings...'}
        </p>
      </div>
    );
  }

  const { tier, limits, usage, user } = tierInfo;
  const CurrentIcon = tierIcons[tier.tier_name] || Package;
  const currentGradient = tierColors[tier.tier_name];
  const upgrades = allTiers.filter(t => t.sort_order > tier.sort_order);


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Success Message - Now dismissible by user with upgrade details */}
      {showSuccessMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 dark:bg-green-900/20 dark:border-green-700">
          <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-800 dark:text-green-300">🎉 Subscription Upgraded Successfully!</h3>
            <p className="text-sm text-green-700 dark:text-green-400">
              {upgradeDetails.from && upgradeDetails.to ? (
                <>
                  You've been upgraded from <strong>{tierDisplayNames[upgradeDetails.from] || upgradeDetails.from}</strong> to{' '}
                  <strong>{tierDisplayNames[upgradeDetails.to] || upgradeDetails.to}</strong> plan. 
                  Enjoy your new features and increased limits!
                </>
              ) : (
                'Your subscription has been successfully activated. Enjoy your new features!'
              )}
            </p>
          </div>
          <button
            onClick={() => setShowSuccessMessage(false)}
            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 flex-shrink-0"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Cancel Message */}
      {showCancelMessage && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-3 dark:bg-slate-800 dark:border-slate-700">
          <XCircle className="w-6 h-6 text-slate-600 dark:text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200">Checkout Canceled</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your checkout was canceled. No charges were made.
            </p>
          </div>
          <button
            onClick={() => setShowCancelMessage(false)}
            className="text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">Settings & Subscription</h1>
        <p className="text-slate-600 dark:text-slate-400">Manage your subscription and view usage</p>
      </div>

      {/* Your Plan Label */}
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Your Plan</h2>
      </div>

      {/* Current Plan Card */}
      <Card 
        className="mb-8 overflow-hidden"
        style={{
          backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
          borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
        }}
      >
        <div className={cn("h-2 bg-gradient-to-r", currentGradient)} />
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg", currentGradient)}>
                <CurrentIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <CardTitle 
                  className="text-2xl text-slate-900 dark:text-slate-100"
                  style={{
                    color: isDarkMode ? 'rgb(241 245 249)' : ''
                  }}
                >
                  {tier.display_name}
                </CardTitle>
                <p className="text-slate-600 dark:text-slate-400">
                  {user?.subscription_end_date ? (
                    <>Expires {new Date(user.subscription_end_date).toLocaleDateString()}</>
                  ) : tier.price_per_month === 0 ? (
                    'Free Forever'
                  ) : (
                    `$${tier.price_per_month.toFixed(2)}/month`
                  )}
                </p>
              </div>
            </div>
            {user.subscription_tier !== 'free' && 
             user.subscription_tier !== 'admin' && (
              <Button
                onClick={handleManageSubscription}
                disabled={managingSubscription}
                variant="outline"
                className="gap-2"
                style={{
                  backgroundColor: isDarkMode ? 'rgb(51 65 85)' : '',
                  color: isDarkMode ? 'rgb(226 232 240)' : '',
                  borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
                }}
              >
                {managingSubscription ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Manage Subscription
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        
        {user?.subscription_end_date && user?.subscription_cancel_reason && (
          <div className="px-6 py-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900 dark:text-amber-100">Subscription Ending</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Your subscription will end on {new Date(user.subscription_end_date).toLocaleDateString()} and you'll be moved to the Free plan.
                </p>
                {user.subscription_cancel_reason !== 'User canceled subscription' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    Reason: {user.subscription_cancel_reason}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        <CardContent>
              {/* Usage Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <div 
                  className="rounded-lg p-3 sm:p-4 text-center relative"
                  style={{
                    backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                  }}
                >
                  <p 
                    className="text-xl sm:text-2xl font-bold mb-1"
                    style={{ color: isDarkMode ? 'rgb(96 165 250)' : 'rgb(37 99 235)' }}
                  >
                    {user.current_shopping_lists || 0}/{tier.max_shopping_lists}
                  </p>
                  <p 
                    className="text-xs flex items-center justify-center gap-1"
                    style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                  >
                    Shopping Lists
                    {(user.current_shopping_lists || 0) >= tier.max_shopping_lists && (
                      <AlertCircle className="w-3 h-3 text-red-500 dark:text-red-400" title="Limit reached" />
                    )}
                  </p>
                </div>
                <div 
                  className="rounded-lg p-3 sm:p-4 text-center relative"
                  style={{
                    backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                  }}
                >
                  <p 
                    className="text-xl sm:text-2xl font-bold mb-1"
                    style={{ color: isDarkMode ? 'rgb(34 197 94)' : 'rgb(22 163 74)' }}
                  >
                    {user.current_total_items || 0}/{tier.max_total_items}
                  </p>
                  <p 
                    className="text-xs flex items-center justify-center gap-1"
                    style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                  >
                    Total Items
                    {(user.current_total_items || 0) >= tier.max_total_items && (
                      <AlertCircle className="w-3 h-3 text-red-500 dark:text-red-400" title="Limit reached" />
                    )}
                  </p>
                </div>
                <div 
                  className="rounded-lg p-3 sm:p-4 text-center relative"
                  style={{
                    backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                  }}
                >
                  <p 
                    className="text-xl sm:text-2xl font-bold mb-1"
                    style={{ color: isDarkMode ? 'rgb(236 72 153)' : 'rgb(219 39 119)' }}
                  >
                    {user.current_tasks || 0}/{tier.max_tasks}
                  </p>
                  <p 
                    className="text-xs flex items-center justify-center gap-1"
                    style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                  >
                    Tasks
                    {(user.current_tasks || 0) >= tier.max_tasks && (
                      <AlertCircle className="w-3 h-3 text-red-500 dark:text-red-400" title="Limit reached" />
                    )}
                  </p>
                </div>
                <div 
                  className="rounded-lg p-3 sm:p-4 text-center relative"
                  style={{
                    backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                  }}
                >
                  <p 
                    className="text-xl sm:text-2xl font-bold mb-1"
                    style={{ color: isDarkMode ? 'rgb(251 146 60)' : 'rgb(234 88 12)' }}
                  >
                    {user.current_custom_recipes || 0}/{tier.max_custom_recipes}
                  </p>
                  <p 
                    className="text-xs flex items-center justify-center gap-1"
                    style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                  >
                    Custom Recipes
                    {(user.current_custom_recipes || 0) >= tier.max_custom_recipes && (
                      <AlertCircle className="w-3 h-3 text-red-500 dark:text-red-400" title="Limit reached" />
                    )}
                  </p>
                </div>
              </div>

              {/* Credits Usage */}
              <div 
                className="rounded-lg p-3 sm:p-4 mb-6"
                style={{
                  backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                }}
              >
                <div className="flex justify-between items-center mb-2">
                  <p 
                    className="text-xs font-semibold flex items-center gap-1"
                    style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                  >
                    Monthly Credits Available
                    {usage.creditsRemaining === 0 && (
                      <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" title="No credits available" />
                    )}
                  </p>
                  <p 
                    className="text-sm font-bold"
                    style={{ color: isDarkMode ? 'rgb(251 146 60)' : 'rgb(234 88 12)' }}
                  >
                    {usage.creditsRemaining}/{usage.creditsTotal}
                  </p>
                </div>
                <Progress value={usage.creditsPercentage} className="h-2" />
                <p 
                  className="text-xs mt-2"
                  style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                >
                  Resets on {user.credits_reset_date 
                    ? new Date(user.credits_reset_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : new Date(new Date(user.created_date).setMonth(new Date().getMonth() + 1)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>

              {/* Premium Themes Info */}
              <div 
                className="rounded-lg p-3 sm:p-4 mb-6"
                style={{
                  backgroundColor: isDarkMode ? 'rgb(51 65 85)' : 'rgb(248 250 252)'
                }}
              >
                <p 
                  className="text-xs font-semibold mb-2"
                  style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}
                >
                  Premium Themes
                </p>
                <p 
                  className="text-sm"
                  style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}
                >
                  {tier.allowed_themes && tier.allowed_themes.filter(t => t !== 'default').length > 0
                    ? tier.allowed_themes.filter(t => t !== 'default').map(theme => theme.charAt(0).toUpperCase() + theme.slice(1)).join(', ')
                    : 'None'}
                  {tier.tier_name === 'free' && tier.theme_restriction_duration > 0 && (
                    <span className="text-xs ml-2" style={{ color: isDarkMode ? 'rgb(148 163 184)' : 'rgb(100 116 139)' }}>
                      (1st month only)
                    </span>
                  )}
                </p>
              </div>
        </CardContent>
      </Card>

      {/* Available Upgrade Plans */}
      {upgrades.length > 0 && (
        <div className="mb-8">
          <h2 
            className="text-2xl font-bold mb-6"
            style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
          >
            Upgrade Your Plan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upgrades.map((tier) => {
              const TierIcon = tierIcons[tier.tier_name] || Package;
              const isRecommended = tier.tier_name === 'pro';
              return (
                <Card
                  key={tier.id}
                  className="relative overflow-hidden hover:shadow-xl transition-all border-2"
                  style={{
                    backgroundColor: isDarkMode ? 'rgb(30 41 59)' : 'white',
                    borderColor: isRecommended 
                      ? (isDarkMode ? 'rgb(168 85 247)' : 'rgb(139 92 246)')
                      : (isDarkMode ? 'rgb(71 85 105)' : 'rgb(226 232 240)')
                  }}
                >
                  <div className={cn("h-3 bg-gradient-to-r", tierColors[tier.tier_name])} />
                  
                  {isRecommended && (
                    <div className="absolute top-6 right-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                      Recommended
                    </div>
                  )}
                  
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg", tierColors[tier.tier_name])}>
                        <TierIcon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 
                          className="text-xl font-bold"
                          style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                        >
                          {tier.display_name}
                        </h3>
                        <p 
                          className="text-2xl font-bold"
                          style={{ color: isDarkMode ? 'rgb(96 165 250)' : 'rgb(37 99 235)' }}
                        >
                          ${tier.price_per_month.toFixed(2)}<span className="text-sm font-normal">/mo</span>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between text-sm">
                        <span style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}>
                          Shopping Lists
                        </span>
                        <span 
                          className="font-semibold"
                          style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                        >
                          {tier.max_shopping_lists}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}>
                          Total Items
                        </span>
                        <span 
                          className="font-semibold"
                          style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                        >
                          {tier.max_total_items}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}>
                          Tasks
                        </span>
                        <span 
                          className="font-semibold"
                          style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                        >
                          {tier.max_tasks}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}>
                          Custom Recipes
                        </span>
                        <span 
                          className="font-semibold"
                          style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                        >
                          {tier.max_custom_recipes}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}>
                          Monthly Credits
                        </span>
                        <span 
                          className="font-semibold"
                          style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                        >
                          {tier.monthly_credits}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: isDarkMode ? 'rgb(203 213 225)' : 'rgb(71 85 105)' }}>
                          Premium Themes
                        </span>
                        <span 
                          className="font-semibold"
                          style={{ color: isDarkMode ? 'rgb(248 250 252)' : 'rgb(15 23 42)' }}
                        >
                          {tier.allowed_themes && tier.allowed_themes.filter(t => t !== 'default').length > 0
                            ? tier.allowed_themes.filter(t => t !== 'default').map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')
                            : 'None'}
                        </span>
                      </div>
                      {!tier.has_ads && (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Ad-Free Experience</span>
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={() => handleUpgrade(tier.tier_name)}
                      disabled={upgrading}
                      className={cn(
                        "w-full gap-2",
                        "bg-gradient-to-r hover:shadow-lg " + tierColors[tier.tier_name]
                      )}
                    >
                      {upgrading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Upgrade to {tier.display_name}
                          <ExternalLink className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {/* Terms Agreement Notice */}
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
            By upgrading, you agree to our{' '}
            <a 
              href={createPageUrl("Terms")} 
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Terms & Conditions
            </a>
            {' '}and{' '}
            <a 
              href={createPageUrl("PrivacyPolicy")} 
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      )}

      {/* Premium Features */}
      {premiumFeatures.length > 0 && (
        <>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">
            Premium Features (Use Credits)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {premiumFeatures.map((feature) => (
              <Card
                key={feature.id}
                style={{
                  backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
                  borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100">
                      {feature.display_name}
                    </h4>
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      {feature.credits_per_use} {feature.credits_per_use === 1 ? 'credit' : 'credits'}
                    </Badge>
                  </div>
                  {feature.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {feature.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Legal Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">
          Legal
        </h2>
        <Card
          style={{
            backgroundColor: isDarkMode ? 'rgb(30 41 59)' : '',
            borderColor: isDarkMode ? 'rgb(71 85 105)' : ''
          }}
        >
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <a 
                href={createPageUrl("PrivacyPolicy")}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Privacy Policy
              </a>
              <a 
                href={createPageUrl("Terms")}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Terms & Conditions
              </a>
              <a 
                href={createPageUrl("RefundPolicy")}
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                Refund Policy
              </a>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
              © 2025 MyEZList. All rights reserved.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}