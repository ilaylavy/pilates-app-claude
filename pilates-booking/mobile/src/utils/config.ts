// For development, use your local machine's IP address
// Common patterns:
// - Android emulator: 10.0.2.2:8000
// - iOS simulator: localhost:8000  
// - Physical device: your actual IP (check with ipconfig/ifconfig)
const getDevApiUrl = () => {
  // Replace this IP with your actual local IP address
  const LOCAL_IP = '10.100.102.24';
  return `http://${LOCAL_IP}:8000`;
};

export const API_BASE_URL = __DEV__ 
  ? getDevApiUrl()
  : 'https://your-production-api.com';

// Stripe Configuration
export const STRIPE_PUBLISHABLE_KEY = __DEV__
  ? 'pk_test_51RyG191cnfikEKjflX0sQjDVuW7rEIAXdzYSmuyuQJXPSe0ndJqEqjicDR9TKABC5fTvE8F9MUIqwsVwD80VK4Cf00oVrAH3vF' // Replace with your test publishable key
  : 'pk_live_1234567890abcdef'; // Replace with your live publishable key

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  BIOMETRIC_ENABLED: 'biometric_enabled',
} as const;

export const COLORS = {
  primary: '#6366F1',
  secondary: '#F59E0B',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  background: '#FFFFFF',
  surface: '#F9FAFB',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  disabled: '#9CA3AF',
  white: '#FFFFFF',
  lightGray: '#F3F4F6',
} as const;

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;