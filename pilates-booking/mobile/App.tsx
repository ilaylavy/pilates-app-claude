import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { LogBox } from 'react-native';

import { AuthProvider } from './src/hooks/useAuth';
import Navigation from './src/navigation/Navigation';
import { STRIPE_PUBLISHABLE_KEY } from './src/utils/config';

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