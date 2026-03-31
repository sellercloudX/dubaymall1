import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sellercloudx.app',
  appName: 'SellerCloudX',
  webDir: 'dist',
  server: {
    url: 'https://af1b8d1e-f9cb-42f3-8678-575d0e45e819.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    backgroundColor: '#FCFCFD',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    minWebViewVersion: '55',
    overrideUserAgent: 'SellerCloudX-Android/1.0',
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    scrollEnabled: true,
    scheme: 'sellercloudx',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#3B82F6',
      showSpinner: true,
      spinnerColor: '#FFFFFF',
      launchFadeOutDuration: 500,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#3B82F6',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
