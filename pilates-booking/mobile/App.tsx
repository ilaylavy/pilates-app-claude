import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { LogBox, Platform, I18nManager } from 'react-native';

import { AuthProvider } from './src/hooks/useAuth';
import { LanguageProvider } from './src/contexts/LanguageContext';
import Navigation from './src/navigation/Navigation';
import { STRIPE_PUBLISHABLE_KEY } from './src/utils/config';
import { Logger, setupGlobalErrorHandler } from './src/services/LoggingService';
import { apiClient } from './src/api/client';
import { i18nManager } from './src/i18n/config';

// Suppress all known warnings for cleaner development experience
LogBox.ignoreLogs([
  'new NativeEventEmitter',
  'EventEmitter.removeListener',
  'Require cycle',
  'window.addEventListener is not a function',
  'Non-serializable values were found in the navigation state',
  'Failed to flush logs',
]);

// Also suppress console.warn for specific warnings and unwanted debug logs
const originalWarn = console.warn;
const originalLog = console.log;

console.warn = (...args) => {
  const message = args[0];
  if (message && typeof message === 'string') {
    if (message.includes('new NativeEventEmitter') ||
        message.includes('addListener') ||
        message.includes('removeListeners') ||
        message.includes('window.addEventListener')) {
      return;
    }
  }
  originalWarn(...args);
};

// Suppress package debug logs in development
console.log = (...args) => {
  const message = args[0];
  if (message && typeof message === 'string') {
    if (message.includes('📦 User Packages') || 
        message.includes('User Packages Summary') ||
        message.includes('User Packages Full Response')) {
      return; // Suppress package debug logs
    }
  }
  originalLog(...args);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function App() {
  useEffect(() => {
    // Initialize i18n and RTL support
    const initializeI18n = async () => {
      try {
        // Force allow RTL support
        I18nManager.allowRTL(true);
        
        // Initialize i18n manager
        await i18nManager.setLocale(i18nManager.getCurrentLanguageCode());
        
        Logger.info('I18n initialized', {
          language: i18nManager.getCurrentLanguageCode(),
          isRTL: i18nManager.isRTL(),
        });
      } catch (error) {
        Logger.error('Failed to initialize i18n', error);
      }
    };

    // Initialize global logging system
    setupGlobalErrorHandler();
    
    // Initialize i18n
    initializeI18n();
    
    // Log app startup
    Logger.info('Pilates app launched', {
      platform: Platform.OS,
      version: Platform.Version,
      isRTL: I18nManager.isRTL,
      timestamp: new Date().toISOString()
    });
    
    // Track app launch event
    Logger.trackEvent('app.launched', {
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
      environment: __DEV__ ? 'development' : 'production',
      language: i18nManager.getCurrentLanguageCode(),
      isRTL: i18nManager.isRTL()
    });
    
    // Log device information
    Logger.debug('Device information logged', {
      platform: Platform.OS,
      version: Platform.Version,
      isTablet: Platform.OS === 'ios' && Platform.isPad,
      constants: Platform.constants
    });

    // Development helper: expose clearTokens globally for debugging
    if (__DEV__) {
      (global as any).clearTokens = async () => {
        console.log('🧹 Clearing stored tokens...');
        await apiClient.clearTokens();
        console.log('✅ Tokens cleared! Reload the app to see login screen.');
      };
      console.log('💡 Development tip: Call clearTokens() in console to reset auth');
    }
    
    return () => {
      // Log app shutdown
      Logger.info('Pilates app shutting down');
      Logger.trackEvent('app.shutdown', {
        timestamp: new Date().toISOString()
      });
    };
  }, []);

  return (
    <LanguageProvider>
      <StripeProvider 
        publishableKey={STRIPE_PUBLISHABLE_KEY || ''}
        merchantIdentifier="merchant.pilates.booking" // Add merchant identifier
      >
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <NavigationContainer>
                <Navigation />
                <StatusBar style="auto" />
              </NavigationContainer>
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </StripeProvider>
    </LanguageProvider>
  );
}