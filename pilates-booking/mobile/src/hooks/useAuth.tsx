import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { authApi } from '../api/auth';
import { User, AuthTokens, LoginRequest, RegisterRequest } from '../types';
import { STORAGE_KEYS } from '../utils/config';
import { secureStorage } from '../utils/secureStorage';
import { securityManager } from '../utils/securityManager';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  isBiometricEnabled: boolean;
  authenticateWithBiometric: () => Promise<boolean>;
  resetActivity: () => void;
  clearAllData: () => Promise<void>;
  getUserSessions: () => Promise<any[]>;
  logoutAllDevices: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const queryClient = useQueryClient();

  // Initialize security manager and check for stored authentication on app start
  useEffect(() => {
    initializeSecurity();
    checkStoredAuth();
    checkBiometricSettings();
  }, []);

  const initializeSecurity = async () => {
    await securityManager.initialize({
      autoLogoutMinutes: 15,
      enableBiometric: false,
      clearDataOnBackground: true,
      enableJailbreakDetection: true,
    });
    
    securityManager.setCallbacks(
      () => logout(), // Auto logout callback
      () => clearSensitiveData() // App background callback
    );
  };

  const checkStoredAuth = async () => {
    try {
      const token = await secureStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const userData = await secureStorage.getItem(STORAGE_KEYS.USER_DATA);

      if (token && userData) {
        setUser(JSON.parse(userData));
        // Validate token with server - if it fails, clear all auth data
        try {
          await fetchCurrentUser();
        } catch (error) {
          console.log('Stored token is invalid, clearing auth data');
          await clearAuthData();
        }
      }
    } catch (error) {
      console.error('Error checking stored auth:', error);
      // If there's any error with stored auth, clear it to force fresh login
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const checkBiometricSettings = async () => {
    const biometricEnabled = await secureStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
    setIsBiometricEnabled(biometricEnabled === 'true');
  };

  const fetchCurrentUser = async () => {
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      await secureStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(currentUser));
    } catch (error) {
      // Token might be invalid, clear storage
      await clearAuthData();
    }
  };

  const clearAuthData = async () => {
    await Promise.all([
      secureStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
      secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
      secureStorage.removeItem(STORAGE_KEYS.USER_DATA),
    ]);
    setUser(null);
    queryClient.clear();
  };

  const clearSensitiveData = async () => {
    // Clear sensitive data when app goes to background
    queryClient.clear();
    // Don't clear auth tokens, just clear cached data
  };

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (tokens: AuthTokens) => {
      // Store tokens securely
      await secureStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
      await secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
      
      // Reset security timer
      securityManager.resetAutoLogoutTimer();
      
      // Fetch user data
      await fetchCurrentUser();
    },
    onError: (error) => {
      console.error('Login error:', error);
      throw error;
    },
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: async (newUser: User) => {
      // After registration, user needs to login
      setUser(newUser);
    },
    onError: (error) => {
      console.error('Registration error:', error);
      throw error;
    },
  });

  const login = async (credentials: LoginRequest) => {
    await loginMutation.mutateAsync(credentials);
  };

  const register = async (userData: RegisterRequest) => {
    await registerMutation.mutateAsync(userData);
  };

  const logout = async () => {
    // Logout from server if possible
    try {
      const refreshToken = await secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (error) {
      console.warn('Failed to logout from server:', error);
    }
    
    await clearAuthData();
    securityManager.cleanup();
  };

  const enableBiometric = async () => {
    const success = await securityManager.enableBiometric();
    if (success) {
      await secureStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');
      setIsBiometricEnabled(true);
    }
  };

  const disableBiometric = async () => {
    await securityManager.disableBiometric();
    await secureStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'false');
    setIsBiometricEnabled(false);
  };

  const authenticateWithBiometric = async (): Promise<boolean> => {
    if (!isBiometricEnabled) {
      return false;
    }
    return await secureStorage.authenticateWithBiometric();
  };

  const resetActivity = () => {
    securityManager.resetAutoLogoutTimer();
  };

  const clearAllData = async () => {
    await securityManager.clearAllSecureData();
    await clearAuthData();
  };

  const getUserSessions = async () => {
    try {
      return await authApi.getUserSessions();
    } catch (error) {
      console.error('Failed to get user sessions:', error);
      return [];
    }
  };

  const logoutAllDevices = async () => {
    try {
      await authApi.logoutAllDevices();
      await clearAuthData();
    } catch (error) {
      console.error('Failed to logout all devices:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    enableBiometric,
    disableBiometric,
    isBiometricEnabled,
    authenticateWithBiometric,
    resetActivity,
    clearAllData,
    getUserSessions,
    logoutAllDevices,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};