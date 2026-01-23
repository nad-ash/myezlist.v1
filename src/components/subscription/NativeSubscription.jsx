/**
 * Native Subscription Component
 * 
 * Handles subscription purchases for iOS (Apple IAP) and Android (Google Play)
 * using RevenueCat SDK. This component is only rendered when the app is
 * running as a native app via Capacitor.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Crown, Check, RefreshCw, ExternalLink, Sparkles } from 'lucide-react';
import { isIOS } from '@/utils/paymentPlatform';
import {
  initializeRevenueCat,
  getProducts,
  purchasePackage,
  restorePurchases,
  getCustomerInfo,
  identifyUser
} from '@/services/revenueCatService';

export default function NativeSubscription({ user, currentTier, onUpgrade }) {
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [customerInfo, setCustomerInfo] = useState(null);

  useEffect(() => {
    initializeAndLoadProducts();
  }, [user]);

  const initializeAndLoadProducts = async () => {
    setLoading(true);
    setError(null);

    try {
      // Initialize RevenueCat with user ID
      const initialized = await initializeRevenueCat(user?.id);
      
      if (!initialized) {
        setError('Unable to initialize in-app purchases');
        setLoading(false);
        return;
      }

      // Identify user if logged in
      if (user?.id) {
        await identifyUser(user.id);
      }

      // Get available products
      const availableProducts = await getProducts();
      setProducts(availableProducts);

      // Get current subscription status
      const info = await getCustomerInfo();
      setCustomerInfo(info);

    } catch (err) {
      console.error('Failed to load products:', err);
      setError('Failed to load subscription options');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (packageId) => {
    setPurchasing(true);
    setError(null);

    try {
      const result = await purchasePackage(packageId);

      if (result.success) {
        setCustomerInfo({ 
          isPremium: result.isPremium,
          isPro: result.isPro,
          isAdfree: result.isAdfree,
          activeTier: result.activeTier
        });
        onUpgrade?.({
          success: true,
          provider: isIOS() ? 'apple' : 'google',
          activeTier: result.activeTier,
          expirationDate: result.expirationDate
        });
      } else if (result.cancelled) {
        // User cancelled - no error needed
      }
    } catch (err) {
      console.error('Purchase failed:', err);
      setError('Purchase failed. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);

    try {
      const result = await restorePurchases();

      const hasPaidTier = result.isPremium || result.isPro || result.isAdfree;
      if (hasPaidTier) {
        setCustomerInfo({ 
          isPremium: result.isPremium,
          isPro: result.isPro,
          isAdfree: result.isAdfree,
          activeTier: result.activeTier
        });
        onUpgrade?.({
          success: true,
          provider: isIOS() ? 'apple' : 'google',
          activeTier: result.activeTier,
          restored: true
        });
      } else {
        setError('No previous purchases found');
      }
    } catch (err) {
      console.error('Restore failed:', err);
      setError('Failed to restore purchases');
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Loading subscription options...
        </p>
      </div>
    );
  }

  // Check if user has any paid subscription
  const hasPaidSubscription = customerInfo?.isPremium || customerInfo?.isPro || customerInfo?.isAdfree;
  const activeTier = customerInfo?.activeTier || 'free';
  
  const tierLabels = {
    premium: 'Premium',
    pro: 'Pro',
    adfree: 'Ad-Free'
  };

  if (hasPaidSubscription) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-green-700 dark:text-green-400">
            You're a {tierLabels[activeTier] || 'Paid'} Member!
          </CardTitle>
          <CardDescription>
            {activeTier === 'premium' && 'Enjoy unlimited access to all features'}
            {activeTier === 'pro' && 'Enjoy enhanced features and more credits'}
            {activeTier === 'adfree' && 'Enjoy an ad-free experience'}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <li className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Ad-free experience
            </li>
            {(activeTier === 'pro' || activeTier === 'premium') && (
              <li className="flex items-center justify-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                More shopping lists & items
              </li>
            )}
            {activeTier === 'premium' && (
              <li className="flex items-center justify-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Unlimited AI features
              </li>
            )}
          </ul>
        </CardContent>
        <CardFooter className="justify-center">
          <Button
            variant="outline"
            onClick={() => {
              // Open subscription management (App Store/Play Store)
              if (customerInfo?.managementUrl) {
                window.open(customerInfo.managementUrl, '_blank');
              }
            }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Manage Subscription
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
          Upgrade to Premium
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Unlock all features and remove limits
        </p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <p>No subscription options available</p>
          <Button
            variant="ghost"
            onClick={initializeAndLoadProducts}
            className="mt-4"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {products.map((product) => (
            <Card
              key={product.id}
              className="relative overflow-hidden hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              {product.packageType === 'ANNUAL' && (
                <Badge className="absolute top-3 right-3 bg-gradient-to-r from-amber-500 to-orange-500">
                  Best Value
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{product.title}</CardTitle>
                <CardDescription>{product.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-800 dark:text-white">
                  {product.price}
                  <span className="text-base font-normal text-slate-500 dark:text-slate-400">
                    /{product.packageType === 'ANNUAL' ? 'year' : 'month'}
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  onClick={() => handlePurchase(product.id)}
                  disabled={purchasing}
                >
                  {purchasing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 mr-2" />
                      Subscribe
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-700">
        <Button
          variant="ghost"
          onClick={handleRestore}
          disabled={restoring}
          className="text-slate-600 dark:text-slate-400"
        >
          {restoring ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Restoring...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Restore Purchases
            </>
          )}
        </Button>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Already subscribed? Restore your purchase to unlock Premium.
        </p>
      </div>

      <div className="text-xs text-slate-400 dark:text-slate-500 text-center space-y-1">
        <p>
          {isIOS() ? 'Subscription is managed through Apple' : 'Subscription is managed through Google Play'}
        </p>
        <p>
          Cancel anytime. Subscription auto-renews unless cancelled 24 hours before period ends.
        </p>
      </div>
    </div>
  );
}

