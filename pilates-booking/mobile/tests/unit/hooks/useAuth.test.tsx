/**
 * Unit tests for useAuth hook.
 * Tests authentication state management and context functionality.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { useAuth, AuthProvider } from '../../../src/hooks/useAuth';
import { UserRole } from '../../../src/types';
import { mockUsers, mockApiResponses } from '../../testUtils/testData';

// Mock the API client
jest.mock('../../../src/api/client', () => ({
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
}));

import apiClient from '../../../src/api/client';

describe('useAuth Hook', () => {
  const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.clear as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  describe('Initial State', () => {
    it('should start with unauthenticated state', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(true); // Loading while checking stored tokens
    });

    it('should load user from stored tokens on mount', async () => {
      // Mock stored tokens
      (SecureStore.getItemAsync as jest.Mock)
        .mockResolvedValueOnce('mock_access_token')
        .mockResolvedValueOnce('mock_refresh_token');
      
      mockApiClient.get.mockResolvedValueOnce({
        data: mockUsers.student
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for async initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.user).toEqual(mockUsers.student);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Login', () => {
    it('should login successfully with valid credentials', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: mockApiResponses.loginSuccess
      });
      
      mockApiClient.get.mockResolvedValueOnce({
        data: mockUsers.student
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.user).toEqual(mockUsers.student);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);

      // Should store tokens securely
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'access_token',
        mockApiResponses.loginSuccess.access_token
      );
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'refresh_token',
        mockApiResponses.loginSuccess.refresh_token
      );
    });

    it('should handle login failure', async () => {
      mockApiClient.post.mockRejectedValueOnce({
        response: { 
          status: 401,
          data: mockApiResponses.loginError
        }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.login('wrong@example.com', 'wrongpassword');
        })
      ).rejects.toThrow();

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it('should handle network errors during login', async () => {
      mockApiClient.post.mockRejectedValueOnce(new Error('Network Error'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.login('test@example.com', 'password123');
        })
      ).rejects.toThrow('Network Error');

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Register', () => {
    it('should register successfully with valid data', async () => {
      const registerData = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        first_name: 'New',
        last_name: 'User',
        phone_number: '+1234567890'
      };

      mockApiClient.post.mockResolvedValueOnce({
        data: {
          message: 'User registered successfully',
          user: { ...mockUsers.student, ...registerData }
        }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.register(registerData);
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/register', registerData);
    });

    it('should handle registration with duplicate email', async () => {
      const registerData = {
        email: 'existing@example.com',
        password: 'SecurePassword123!',
        first_name: 'New',
        last_name: 'User'
      };

      mockApiClient.post.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { detail: 'Email already registered' }
        }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.register(registerData);
        })
      ).rejects.toThrow();
    });
  });

  describe('Logout', () => {
    it('should logout and clear stored data', async () => {
      // First login
      mockApiClient.post.mockResolvedValueOnce({
        data: mockApiResponses.loginSuccess
      });
      mockApiClient.get.mockResolvedValueOnce({
        data: mockUsers.student
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.isAuthenticated).toBe(true);

      // Now logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      
      // Should clear stored tokens
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('access_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('refresh_token');
      expect(AsyncStorage.clear).toHaveBeenCalled();
    });
  });

  describe('Token Refresh', () => {
    it('should refresh tokens automatically', async () => {
      const newTokens = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        token_type: 'bearer',
        expires_in: 3600
      };

      mockApiClient.post.mockResolvedValueOnce({ data: newTokens });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.refreshToken();
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/refresh', expect.any(Object));
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('access_token', newTokens.access_token);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('refresh_token', newTokens.refresh_token);
    });

    it('should logout on refresh failure', async () => {
      mockApiClient.post.mockRejectedValueOnce({
        response: { status: 401 }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.refreshToken();
        } catch (error) {
          // Expected to fail
        }
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('Profile Update', () => {
    it('should update user profile successfully', async () => {
      // First login
      mockApiClient.post.mockResolvedValueOnce({
        data: mockApiResponses.loginSuccess
      });
      mockApiClient.get.mockResolvedValueOnce({
        data: mockUsers.student
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      const updatedUser = {
        ...mockUsers.student,
        first_name: 'Updated',
        last_name: 'Name'
      };

      mockApiClient.put.mockResolvedValueOnce({
        data: updatedUser
      });

      const updateData = {
        first_name: 'Updated',
        last_name: 'Name'
      };

      await act(async () => {
        await result.current.updateProfile(updateData);
      });

      expect(result.current.user).toEqual(updatedUser);
      expect(mockApiClient.put).toHaveBeenCalledWith('/users/me', updateData);
    });

    it('should handle profile update failure', async () => {
      // First login
      mockApiClient.post.mockResolvedValueOnce({
        data: mockApiResponses.loginSuccess
      });
      mockApiClient.get.mockResolvedValueOnce({
        data: mockUsers.student
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      mockApiClient.put.mockRejectedValueOnce({
        response: { status: 400 }
      });

      await expect(
        act(async () => {
          await result.current.updateProfile({ first_name: 'Updated' });
        })
      ).rejects.toThrow();

      // User should remain unchanged
      expect(result.current.user).toEqual(mockUsers.student);
    });
  });

  describe('User Role Checks', () => {
    it('should correctly identify admin users', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: mockApiResponses.loginSuccess
      });
      mockApiClient.get.mockResolvedValueOnce({
        data: mockUsers.admin
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('admin@example.com', 'password123');
      });

      expect(result.current.user?.role).toBe(UserRole.ADMIN);
    });

    it('should correctly identify instructor users', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: mockApiResponses.loginSuccess
      });
      mockApiClient.get.mockResolvedValueOnce({
        data: mockUsers.instructor
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login('instructor@example.com', 'password123');
      });

      expect(result.current.user?.role).toBe(UserRole.INSTRUCTOR);
    });
  });

  describe('Loading States', () => {
    it('should show loading during login', async () => {
      let resolveLogin: (value: any) => void;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      mockApiClient.post.mockReturnValue(loginPromise as any);

      const { result } = renderHook(() => useAuth(), { wrapper });

      act(() => {
        result.current.login('test@example.com', 'password123');
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveLogin!({ data: mockApiResponses.loginSuccess });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication context errors gracefully', () => {
      // Test using hook outside of provider
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });
  });
});