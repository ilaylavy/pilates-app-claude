import { apiClient } from './client';
import { Package, UserPackage } from '../types';

export const packagesApi = {
  getAvailablePackages: async (): Promise<Package[]> => {
    const response = await apiClient.get<Package[]>('/api/v1/packages');
    return response.data;
  },

  purchasePackage: async (packageId: number): Promise<UserPackage> => {
    const response = await apiClient.post<UserPackage>('/api/v1/packages/purchase', {
      package_id: packageId,
    });
    return response.data;
  },

  getUserPackages: async (): Promise<UserPackage[]> => {
    const response = await apiClient.get<UserPackage[]>('/api/v1/packages/my-packages');
    return response.data;
  },
};