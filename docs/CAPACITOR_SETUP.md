# Capacitor & In-App Purchase Setup Guide

This guide explains how to set up native iOS and Android apps with in-app purchases using Capacitor and RevenueCat.

## Overview

MyEZList uses a **hybrid payment architecture**:
- **iOS App Store**: Apple In-App Purchase (via RevenueCat)
- **Google Play Store**: Google Play Billing (via RevenueCat)
- **Web Browser**: Stripe Checkout

This ensures compliance with Apple's App Store guidelines (which require IAP for digital subscriptions) while optimizing payment processing fees for web users.

## Prerequisites

1. **Xcode** (for iOS development) - macOS only
2. **Android Studio** (for Android development)
3. **Apple Developer Account** ($99/year) - for iOS deployment
4. **Google Play Developer Account** ($25 one-time) - for Android deployment
5. **RevenueCat Account** (free tier available)

## Setup Steps

### 1. RevenueCat Configuration

1. Create an account at [RevenueCat](https://www.revenuecat.com/)
2. Create a new project for MyEZList
3. Configure your apps:
   - **iOS App**: Add your App Store Connect app
   - **Android App**: Add your Google Play Console app

4. Set up products in RevenueCat:
   - Create an "Offering" called `default`
   - Add packages:
     - `myezlist_premium_monthly` - Monthly subscription
     - `myezlist_premium_annual` - Annual subscription (optional)

5. Create an "Entitlement" called `premium`

6. Get your API keys:
   - **Apple API Key**: `appl_xxxxxxxxxxxxx`
   - **Google API Key**: `goog_xxxxxxxxxxxxx`

### 2. Environment Variables

Add to your `.env` file:

```bash
# RevenueCat API Keys (these are PUBLIC keys)
VITE_REVENUECAT_APPLE_API_KEY=appl_your_apple_api_key
VITE_REVENUECAT_GOOGLE_API_KEY=goog_your_google_api_key
```

### 3. Supabase Secrets

Set these secrets for the webhook handler:

```bash
# RevenueCat webhook secret (for validating webhook calls)
supabase secrets set REVENUECAT_WEBHOOK_SECRET=your-webhook-secret
```

### 4. RevenueCat Webhook Configuration

1. In RevenueCat dashboard, go to **Project Settings > Integrations > Webhooks**
2. Add a new webhook:
   - **URL**: `https://your-project.supabase.co/functions/v1/revenuecat-webhook`
   - **Authorization Header**: `Bearer your-webhook-secret`
3. Select events to receive:
   - `INITIAL_PURCHASE`
   - `RENEWAL`
   - `CANCELLATION`
   - `EXPIRATION`
   - `BILLING_ISSUE`

### 5. App Store Connect Setup (iOS)

1. Create your app in App Store Connect
2. Set up In-App Purchases:
   - Go to **Features > In-App Purchases**
   - Create a new "Auto-Renewable Subscription"
   - Product ID: `myezlist_premium_monthly`
   - Set pricing (Apple takes 15-30% commission)

3. Create a Subscription Group (e.g., "MyEZList Premium")

4. Configure App Store Server Notifications:
   - Go to **App Information > App Store Server Notifications**
   - Enter your RevenueCat notification URL

### 6. Google Play Console Setup (Android)

1. Create your app in Google Play Console
2. Set up Subscriptions:
   - Go to **Monetization > Subscriptions**
   - Create a subscription with Product ID: `myezlist_premium_monthly`

3. Configure Real-time Developer Notifications:
   - Go to **Monetization setup**
   - Add your RevenueCat notification topic

### 7. Database Migration

Run the SQL migration to create the unified subscriptions table:

```sql
-- Run in Supabase SQL Editor
-- Copy contents of supabase/migrations/add_user_subscriptions_table.sql
```

### 8. Building the Apps

#### iOS

```bash
# Build web assets
npm run build

# Sync to iOS
npx cap sync ios

# Open in Xcode
npx cap open ios
```

In Xcode:
1. Set your signing team
2. Update bundle identifier to `com.myezlist.app`
3. Add In-App Purchase capability
4. Build and test on device

#### Android

```bash
# Build web assets
npm run build

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android
```

In Android Studio:
1. Update `applicationId` in `build.gradle` if needed
2. Configure signing for release builds
3. Build and test on device/emulator

## Testing

### iOS Sandbox Testing

1. Create sandbox testers in App Store Connect
2. Sign out of App Store on test device
3. Sign in with sandbox account when prompted during purchase

### Android Testing

1. Add test accounts in Google Play Console
2. Use license testing to simulate purchases

### RevenueCat Testing

Use RevenueCat's sandbox mode for testing:
- Sandbox purchases work with test accounts
- Subscriptions renew quickly (monthly = 5 minutes)

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   iOS App   │     │ Android App │     │   Web App   │
│  (Capacitor)│     │  (Capacitor)│     │   (Vite)    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Apple IAP  │     │ Google Play │     │   Stripe    │
│(via RevenueCat)   │(via RevenueCat)   │  Checkout   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────┬───────┴───────────────────┘
                   ▼
         ┌─────────────────┐
         │    Supabase     │
         │   Edge Functions│
         │   (Webhooks)    │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ user_subscriptions│
         │   (Unified DB)   │
         └─────────────────┘
```

## Files Reference

| File | Purpose |
|------|---------|
| `src/utils/paymentPlatform.js` | Platform detection (iOS/Android/Web) |
| `src/services/revenueCatService.js` | RevenueCat SDK integration |
| `src/components/subscription/SubscriptionManager.jsx` | Routes to correct payment UI |
| `src/components/subscription/NativeSubscription.jsx` | iOS/Android purchase UI |
| `src/hooks/useSubscription.js` | Unified subscription status hook |
| `supabase/functions/revenuecat-webhook/index.ts` | Handles RevenueCat events |
| `supabase/functions/sync-native-subscription/index.ts` | Syncs purchases to DB |
| `supabase/migrations/add_user_subscriptions_table.sql` | Database schema |
| `capacitor.config.ts` | Capacitor configuration |

## Commission Rates

| Platform | Commission | Notes |
|----------|------------|-------|
| Apple App Store | 15-30% | 15% for small business program |
| Google Play | 15-30% | 15% for first $1M/year |
| Stripe | ~3% | Best rate for web |

## Troubleshooting

### "Products not found" on iOS
- Ensure products are created in App Store Connect
- Wait 24-48 hours for products to propagate
- Check RevenueCat offering configuration

### "Purchase failed" on Android
- Ensure app is signed with correct key
- Check Google Play Console license testing setup
- Verify product IDs match exactly

### Subscriptions not syncing
- Check RevenueCat webhook configuration
- Verify Supabase Edge Function logs
- Ensure webhook secret matches

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [RevenueCat Documentation](https://docs.revenuecat.com/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer/)

