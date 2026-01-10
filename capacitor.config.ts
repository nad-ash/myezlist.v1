import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myezlist.app',
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
    contentInset: 'automatic',
    scheme: 'MyEZList',
    backgroundColor: '#ffffff'
  },
  android: {
    // Android-specific settings
    backgroundColor: '#ffffff'
  }
};

export default config;

