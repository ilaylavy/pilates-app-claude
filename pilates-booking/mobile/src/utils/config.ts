// For development, use your local machine's IP address
// Common patterns:
// - Android emulator: 10.0.2.2:8000
// - iOS simulator: localhost:8000  
// - Physical device: your actual IP (check with ipconfig/ifconfig)

const getDevApiUrl = () => {
  // For physical device, use actual IP
  const LOCAL_IP = '192.168.235.110'; // Updated to current IP from error logs
  return `http://${LOCAL_IP}:8000`;
};

// Backup URLs to try if primary fails
export const BACKUP_API_URLS = [
  'http://10.100.102.24:8000',  // WSL/Docker host IP
  'http://127.0.0.1:8000',     // localhost
  'http://10.0.0.19:8000',      // Another local IP
  'http://10.0.2.2:8000',      // Android emulator host
  'http://10.0.0.22:8000',      // Another local IP
  'http://localhost:8000',     // standard localhost
  'http://192.168.235.110:8000', // Common router IP range
  'http://192.168.0.107:8000', // Common router IP range
];

export const API_BASE_URL = __DEV__ 
  ? getDevApiUrl()
  : 'https://your-production-api.com';

// Stripe Configuration
export const STRIPE_PUBLISHABLE_KEY = __DEV__
  ? process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST || ''
  : process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE || '';

// API Endpoints - Centralized configuration to prevent inconsistencies
export const API_ENDPOINTS = {
  // Base API prefix
  BASE: '/api/v1',
  
  // Authentication endpoints
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    REFRESH: '/api/v1/auth/refresh',
    LOGOUT: '/api/v1/auth/logout',
    VERIFY_EMAIL: '/api/v1/auth/verify-email',
    FORGOT_PASSWORD: '/api/v1/auth/forgot-password',
    RESET_PASSWORD: '/api/v1/auth/reset-password',
    SESSIONS: '/api/v1/auth/sessions',
    LOGOUT_ALL_DEVICES: '/api/v1/auth/logout-all-devices',
    VALIDATE_PASSWORD: '/api/v1/auth/validate-password',
  },
  
  // User endpoints
  USERS: {
    ME: '/api/v1/users/me',
    AVATAR: '/api/v1/users/me/avatar',
    STATS: '/api/v1/users/me/stats',
    PREFERENCES: '/api/v1/users/me/preferences',
    BOOKING_HISTORY: '/api/v1/users/me/booking-history',
  },
  
  // Class endpoints
  CLASSES: {
    UPCOMING: '/api/v1/classes/upcoming',
    CREATE: '/api/v1/classes/create',
    INSTANCES: '/api/v1/classes/instances',
    TEMPLATES: '/api/v1/classes/templates',
    BY_ID: (id: number) => `/api/v1/classes/${id}`,
    WEEK: (date: string) => `/api/v1/classes/week/${date}`,
    MONTH: (year: number, month: number) => `/api/v1/classes/month/${year}/${month}`,
    PARTICIPANTS: (id: number) => `/api/v1/classes/${id}/participants`,
  },
  
  // Booking endpoints
  BOOKINGS: {
    CREATE: '/api/v1/bookings/create',
    MY_BOOKINGS: '/api/v1/bookings/my-bookings',
    LIST: '/api/v1/bookings/',
    CANCEL: (id: number) => `/api/v1/bookings/${id}/cancel`,
  },
  
  // Package endpoints
  PACKAGES: {
    LIST: '/api/v1/packages/',
    PURCHASE: '/api/v1/packages/purchase',
    MY_PACKAGES: '/api/v1/packages/my-packages',
    CATALOG: '/api/v1/packages/catalog',
    BY_ID: (id: number) => `/api/v1/packages/${id}`,
    TOGGLE: (id: number) => `/api/v1/packages/${id}/toggle`,
    REORDER: '/api/v1/packages/reorder',
  },
  
  // Payment endpoints
  PAYMENTS: {
    CREATE_INTENT: '/api/v1/payments/create-payment-intent',
    CONFIRM: '/api/v1/payments/confirm-payment',
    METHODS: '/api/v1/payments/methods',
    HISTORY: '/api/v1/payments/history',
    REFUND: (id: number) => `/api/v1/payments/refund/${id}`,
    INVOICE: (id: string) => `/api/v1/payments/invoices/${id}`,
  },
} as const;

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
  card: '#FFFFFF',
  accent: '#6366F1',
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