import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { authApi } from '../api/auth';
import { User, AuthTokens, LoginRequest, RegisterRequest } from '../types';
import { STORAGE_KEYS } from '../utils/config';

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

  // Check for stored authentication on app start
  useEffect(() => {
    checkStoredAuth();
    checkBiometricSettings();
  }, []);

  const checkStoredAuth = async () => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);

      if (token && userData) {
        setUser(JSON.parse(userData));
        // Optionally validate token with server
        await fetchCurrentUser();
      }
    } catch (error) {
      console.error('Error checking stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkBiometricSettings = async () => {
    const biometricEnabled = await AsyncStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
    setIsBiometricEnabled(biometricEnabled === 'true');
  };

  const fetchCurrentUser = async () => {
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(currentUser));
    } catch (error) {
      // Token might be invalid, clear storage
      await clearAuthData();
    }
  };

  const clearAuthData = async () => {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.ACCESS_TOKEN,
      STORAGE_KEYS.REFRESH_TOKEN,
      STORAGE_KEYS.USER_DATA,
    ]);
    setUser(null);
    queryClient.clear();
  };

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (tokens: AuthTokens) => {
      // Store tokens
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
      
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
    await clearAuthData();
  };

  const enableBiometric = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!hasHardware || !isEnrolled) {
        throw new Error('Biometric authentication not available');
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric authentication',
        fallbackLabel: 'Use password',
      });

      if (result.success) {
        await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');
        setIsBiometricEnabled(true);
      }
    } catch (error) {
      console.error('Error enabling biometric:', error);
      throw error;
    }
  };

  const disableBiometric = async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'false');
    setIsBiometricEnabled(false);
  };

  const authenticateWithBiometric = async (): Promise<boolean> => {
    try {
      if (!isBiometricEnabled) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access the app',
        fallbackLabel: 'Use password',
      });

      return result.success;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
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