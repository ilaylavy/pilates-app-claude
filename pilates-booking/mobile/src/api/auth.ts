import { apiClient } from './client';
import { User, AuthTokens, LoginRequest, RegisterRequest } from '../types';

export const authApi = {
  login: async (credentials: LoginRequest): Promise<AuthTokens> => {
    const response = await apiClient.post<AuthTokens>('/api/v1/auth/login', credentials);
    return response.data;
  },

  register: async (userData: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>('/api/v1/auth/register', userData);
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<AuthTokens> => {
    const response = await apiClient.post<AuthTokens>('/api/v1/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/api/v1/users/me');
    return response.data;
  },

  updateProfile: async (userData: Partial<User>): Promise<User> => {
    const response = await apiClient.put<User>('/api/v1/users/me', userData);
    return response.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post('/api/v1/auth/logout', { refresh_token: refreshToken });
  },

  verifyEmail: async (token: string): Promise<void> => {
    await apiClient.post('/api/v1/auth/verify-email', { token });
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/api/v1/auth/forgot-password', { email });
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await apiClient.post('/api/v1/auth/reset-password', {
      token,
      new_password: newPassword,
    });
  },

  getUserSessions: async (): Promise<any[]> => {
    const response = await apiClient.get('/api/v1/auth/sessions');
    return response.data.sessions;
  },

  logoutAllDevices: async (): Promise<void> => {
    await apiClient.post('/api/v1/auth/logout-all-devices');
  },

  validatePasswordStrength: async (password: string): Promise<any> => {
    const response = await apiClient.post('/api/v1/auth/validate-password', {
      password,
    });
    return response.data;
  },
};