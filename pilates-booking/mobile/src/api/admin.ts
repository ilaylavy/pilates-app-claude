import { apiClient } from './client';
import { UserListItem, DashboardAnalytics, RevenueReport, AttendanceReport, Package } from '../types';

export const adminApi = {
  // User management
  getUsers: async (params?: {
    skip?: number;
    limit?: number;
    search?: string;
    role?: string;
    active_only?: boolean;
  }): Promise<UserListItem[]> => {
    const response = await apiClient.get('/api/v1/admin/users', { params });
    return response.data;
  },

  updateUser: async (userId: number, updates: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    role?: string;
    is_active?: boolean;
    is_verified?: boolean;
  }): Promise<UserListItem> => {
    const response = await apiClient.patch(`/api/v1/admin/users/${userId}`, updates);
    return response.data;
  },

  deactivateUser: async (userId: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/v1/admin/users/${userId}`);
    return response.data;
  },

  getUserPackages: async (userId: number) => {
    const response = await apiClient.get(`/api/v1/admin/users/${userId}/packages`);
    return response.data;
  },

  getUserBookings: async (userId: number) => {
    const response = await apiClient.get(`/api/v1/admin/users/${userId}/bookings`);
    return response.data;
  },

  // Analytics
  getDashboardAnalytics: async (): Promise<DashboardAnalytics> => {
    const response = await apiClient.get('/api/v1/admin/analytics/dashboard');
    return response.data;
  },

  // Package management
  createPackage: async (packageData: {
    name: string;
    description?: string;
    price: number;
    credits?: number;
    is_unlimited?: boolean;
    validity_days: number;
    is_active?: boolean;
  }): Promise<Package> => {
    const response = await apiClient.post('/api/v1/admin/packages', packageData);
    return response.data;
  },

  updatePackage: async (packageId: number, updates: {
    name?: string;
    description?: string;
    price?: number;
    credits?: number;
    is_unlimited?: boolean;
    validity_days?: number;
    is_active?: boolean;
  }): Promise<Package> => {
    const response = await apiClient.patch(`/api/v1/admin/packages/${packageId}`, updates);
    return response.data;
  },

  deletePackage: async (packageId: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/v1/admin/packages/${packageId}`);
    return response.data;
  },

  // Reports
  getRevenueReport: async (startDate?: string, endDate?: string): Promise<RevenueReport> => {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    const response = await apiClient.get('/api/v1/admin/reports/revenue', { params });
    return response.data;
  },

  getAttendanceReport: async (startDate?: string, endDate?: string): Promise<AttendanceReport> => {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    const response = await apiClient.get('/api/v1/admin/reports/attendance', { params });
    return response.data;
  },
};