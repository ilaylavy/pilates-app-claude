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
    const response = await apiClient.get('/admin/users', { params });
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
    const response = await apiClient.patch(`/admin/users/${userId}`, updates);
    return response.data;
  },

  deactivateUser: async (userId: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/admin/users/${userId}`);
    return response.data;
  },

  // Analytics
  getDashboardAnalytics: async (): Promise<DashboardAnalytics> => {
    const response = await apiClient.get('/admin/analytics/dashboard');
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
    const response = await apiClient.post('/admin/packages', packageData);
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
    const response = await apiClient.patch(`/admin/packages/${packageId}`, updates);
    return response.data;
  },

  deletePackage: async (packageId: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/admin/packages/${packageId}`);
    return response.data;
  },

  // Reports
  getRevenueReport: async (startDate?: string, endDate?: string): Promise<RevenueReport> => {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    const response = await apiClient.get('/admin/reports/revenue', { params });
    return response.data;
  },

  getAttendanceReport: async (startDate?: string, endDate?: string): Promise<AttendanceReport> => {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    const response = await apiClient.get('/admin/reports/attendance', { params });
    return response.data;
  },
};