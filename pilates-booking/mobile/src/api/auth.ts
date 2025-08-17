import { apiClient } from './client';
import { User, AuthTokens, LoginRequest, RegisterRequest } from '../types';

export const authApi = {
  login: async (credentials: LoginRequest): Promise<AuthTokens> => {
    const response = await apiClient.post<AuthTokens>('/auth/login', credentials);
    return response.data;
  },

  register: async (userData: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>('/auth/register', userData);
    return response.data;
  },

  refreshToken: async (refreshToken: string): Promise<AuthTokens> => {
    const response = await apiClient.post<AuthTokens>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/users/me');
    return response.data;
  },

  updateProfile: async (userData: Partial<User>): Promise<User> => {
    const response = await apiClient.put<User>('/users/me', userData);
    return response.data;
  },
};