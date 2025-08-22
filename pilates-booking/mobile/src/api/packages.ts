import { apiClient } from './client';
import { 
  Package, 
  UserPackage, 
  PaymentMethodType, 
  PendingApproval, 
  PaymentApprovalRequest, 
  PaymentRejectionRequest, 
  ApprovalStats,
  CashPaymentInstructions 
} from '../types';

export const packagesApi = {
  getAvailablePackages: async (): Promise<Package[]> => {
    const response = await apiClient.get<Package[]>('/api/v1/packages');
    return response.data;
  },

  purchasePackage: async (packageId: number, paymentMethod: PaymentMethodType = 'CREDIT_CARD', paymentReference?: string): Promise<UserPackage | CashPaymentInstructions> => {
    const response = await apiClient.post('/api/v1/packages/purchase', {
      package_id: packageId,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
    });
    return response.data;
  },

  getUserPackages: async (): Promise<UserPackage[]> => {
    const response = await apiClient.get<UserPackage[]>('/api/v1/packages/my-packages');
    return response.data;
  },

  // Admin approval endpoints
  getPendingApprovals: async (): Promise<PendingApproval[]> => {
    const response = await apiClient.get<PendingApproval[]>('/api/v1/admin/packages/pending-approvals');
    return response.data;
  },

  approvePackage: async (packageId: number, data: PaymentApprovalRequest): Promise<void> => {
    await apiClient.post(`/api/v1/admin/packages/${packageId}/approve`, data);
  },

  rejectPackage: async (packageId: number, data: PaymentRejectionRequest): Promise<void> => {
    await apiClient.post(`/api/v1/admin/packages/${packageId}/reject`, data);
  },

  getApprovalStats: async (): Promise<ApprovalStats> => {
    const response = await apiClient.get<ApprovalStats>('/api/v1/admin/packages/approval-stats');
    return response.data;
  },

  adminCancelPackage: async (packageId: number, reason: string): Promise<void> => {
    await apiClient.delete(`/api/v1/admin/packages/${packageId}/admin-cancel?reason=${encodeURIComponent(reason)}`);
  },
};