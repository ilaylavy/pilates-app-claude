import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { LogBox, Platform } from 'react-native';

import { AuthProvider } from './src/hooks/useAuth';
import Navigation from './src/navigation/Navigation';
import { STRIPE_PUBLISHABLE_KEY } from './src/utils/config';
import { Logger, setupGlobalErrorHandler } from './src/services/LoggingService';

// Suppress all NativeEventEmitter warnings
LogBox.ignoreLogs([
  'new NativeEventEmitter',
  'EventEmitter.removeListener',
  'Require cycle',
]);

// Also suppress console.warn for NativeEventEmitter
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && 
      args[0].includes('new NativeEventEmitter')) {
    return;
  }
  originalWarn(...args);
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
    // Initialize global logging system
    setupGlobalErrorHandler();
    
    // Log app startup
    Logger.info('Pilates app launched', {
      platform: Platform.OS,
      version: Platform.Version,
      timestamp: new Date().toISOString()
    });
    
    // Track app launch event
    Logger.trackEvent('app.launched', {
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
      environment: __DEV__ ? 'development' : 'production'
    });
    
    // Log device information
    Logger.debug('Device information logged', {
      platform: Platform.OS,
      version: Platform.Version,
      isTablet: Platform.isPad,
      constants: Platform.constants
    });
    
    return () => {
      // Log app shutdown
      Logger.info('Pilates app shutting down');
      Logger.trackEvent('app.shutdown', {
        timestamp: new Date().toISOString()
      });
    };
  }, []);

  return (
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
  );
}