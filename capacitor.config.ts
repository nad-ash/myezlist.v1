import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myezlist.twa',
  appName: 'MyEZList',
  webDir: 'dist',
  server: {
    // For development, you can use live reload
    // url: 'http://localhost:5173',
    // cleartext: true
  },
  plugins: {
    // RevenueCat configuration will be done in code
  },
  ios: {
    // iOS-specific settings
    contentInset: 'never', // Disable automatic safe area - we handle it in CSS
    // Custom URL scheme for OAuth deep linking (myezlist://)
    scheme: 'myezlist',
    // White background - the fixed body/overflow:hidden prevents scroll issues
    backgroundColor: '#ffffff'
  },
  android: {
    // Android-specific settings
    backgroundColor: '#ffffff',
    // Custom URL scheme for OAuth deep linking (myezlist://)
    // Note: Also requires intent-filter in AndroidManifest.xml
    scheme: 'myezlist'
  }
};

export default config;

