/**
 * Custom render function with providers for testing React components.
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { StripeProvider } from '@stripe/stripe-react-native';

import { AuthProvider } from '../../src/hooks/useAuth';
import { User, UserRole } from '../../src/types';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  initialUser?: User | null;
  stripePublishableKey?: string;
}

// Default test user
const defaultTestUser: User = {
  id: 1,
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  role: UserRole.STUDENT,
  is_active: true,
  is_verified: true,
  phone_number: '+1234567890',
  date_of_birth: '1990-01-01',
  emergency_contact_name: 'Emergency Contact',
  emergency_contact_phone: '+1234567891',
  health_conditions: null,
  notes: null,
  bio: null,
  specialties: null,
  certifications: null,
  avatar_url: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Create a test query client
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Mock auth context value
const createMockAuthContext = (user: User | null = null) => ({
  user,
  isAuthenticated: !!user,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  register: jest.fn(),
  refreshToken: jest.fn(),
  updateProfile: jest.fn(),
});

interface AllTheProvidersProps {
  children: ReactNode;
  queryClient: QueryClient;
  initialUser?: User | null;
  stripePublishableKey?: string;
}

function AllTheProviders({ 
  children, 
  queryClient, 
  initialUser = null,
  stripePublishableKey = 'pk_test_123456789'
}: AllTheProvidersProps) {
  // Mock the auth context
  const mockAuthContext = createMockAuthContext(initialUser);
  
  return (
    <StripeProvider publishableKey={stripePublishableKey}>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <AuthProvider value={mockAuthContext as any}>
            {children}
          </AuthProvider>
        </NavigationContainer>
      </QueryClientProvider>
    </StripeProvider>
  );
}

function customRender(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    initialUser = null,
    stripePublishableKey,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders
        queryClient={queryClient}
        initialUser={initialUser}
        stripePublishableKey={stripePublishableKey}
      >
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
}

// Render with authenticated user
function renderWithAuth(
  ui: ReactElement,
  options: Omit<CustomRenderOptions, 'initialUser'> & { user?: User } = {}
) {
  const { user = defaultTestUser, ...restOptions } = options;
  return customRender(ui, {
    ...restOptions,
    initialUser: user,
  });
}

// Render without authentication
function renderWithoutAuth(
  ui: ReactElement,
  options: Omit<CustomRenderOptions, 'initialUser'> = {}
) {
  return customRender(ui, {
    ...options,
    initialUser: null,
  });
}

// Render with admin user
function renderWithAdmin(
  ui: ReactElement,
  options: Omit<CustomRenderOptions, 'initialUser'> = {}
) {
  const adminUser: User = {
    ...defaultTestUser,
    id: 999,
    email: 'admin@example.com',
    role: UserRole.ADMIN,
  };
  
  return customRender(ui, {
    ...options,
    initialUser: adminUser,
  });
}

// Render with instructor user
function renderWithInstructor(
  ui: ReactElement,
  options: Omit<CustomRenderOptions, 'initialUser'> = {}
) {
  const instructorUser: User = {
    ...defaultTestUser,
    id: 888,
    email: 'instructor@example.com',
    role: UserRole.INSTRUCTOR,
    bio: 'Experienced instructor',
    specialties: 'Pilates, Yoga',
    certifications: 'RYT-200, PMA-CPT',
  };
  
  return customRender(ui, {
    ...options,
    initialUser: instructorUser,
  });
}

export {
  customRender as render,
  renderWithAuth,
  renderWithoutAuth,
  renderWithAdmin,
  renderWithInstructor,
  createTestQueryClient,
  defaultTestUser,
};