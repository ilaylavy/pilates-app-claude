import { apiClient } from './client';

// Types for payment API
export interface PaymentIntent {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  created: number;
}

export interface PaymentHistoryItem {
  id: number;
  user_id: number;
  package_id?: number;
  user_package_id?: number;
  amount: number;
  currency: string;
  payment_type: string;
  payment_method: string;
  status: string;
  external_transaction_id?: string;
  external_payment_id?: string;
  payment_date?: string;
  refund_date?: string;
  refund_amount?: number;
  extra_data?: string;
  is_successful: boolean;
  is_refundable: boolean;
  created_at: string;
  updated_at: string;
  description?: string;
}

export interface PaymentHistory {
  payments: PaymentHistoryItem[];
  total_count: number;
  page: number;
  per_page: number;
}

export interface Subscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  client_secret?: string;
}

export interface Invoice {
  id: string;
  number?: string;
  amount_paid: number;
  currency: string;
  status: string;
  created: number;
  invoice_pdf?: string;
  hosted_invoice_url?: string;
}

// API calls
export const paymentsApi = {
  // Create payment intent for package purchase
  createPaymentIntent: async (packageId: number, currency: string = 'ils'): Promise<PaymentIntent> => {
    const response = await apiClient.post<PaymentIntent>('/api/v1/payments/create-payment-intent', {
      package_id: packageId,
      currency,
      save_payment_method: true
    });
    return response.data;
  },

  // Confirm payment after successful card processing
  confirmPayment: async (paymentIntentId: string) => {
    const response = await apiClient.post('/api/v1/payments/confirm-payment', {
      payment_intent_id: paymentIntentId
    });
    return response.data;
  },

  // Create cash reservation
  createCashReservation: async (packageId: number) => {
    const response = await apiClient.post('/api/v1/payments/reserve-cash', {
      package_id: packageId
    });
    return response.data;
  },

  // Get saved payment methods
  getPaymentMethods: async (): Promise<PaymentMethod[]> => {
    const response = await apiClient.get<PaymentMethod[]>('/api/v1/payments/methods');
    return response.data;
  },

  // Remove saved payment method
  removePaymentMethod: async (methodId: string) => {
    const response = await apiClient.delete(`/api/v1/payments/methods/${methodId}`);
    return response.data;
  },

  // Get payment history
  getPaymentHistory: async (page: number = 1, perPage: number = 10): Promise<PaymentHistory> => {
    const response = await apiClient.get<PaymentHistory>('/api/v1/payments/history', {
      params: { page, per_page: perPage }
    });
    return response.data;
  },

  // Get invoice details
  getInvoice: async (invoiceId: string): Promise<Invoice> => {
    const response = await apiClient.get<Invoice>(`/api/v1/payments/invoices/${invoiceId}`);
    return response.data;
  },

  // Subscription management
  createSubscription: async (priceId?: string, paymentMethodId?: string): Promise<Subscription> => {
    const response = await apiClient.post<Subscription>('/api/v1/payments/subscriptions', {
      price_id: priceId,
      payment_method_id: paymentMethodId
    });
    return response.data;
  },

  cancelSubscription: async (subscriptionId: string) => {
    const response = await apiClient.delete(`/api/v1/payments/subscriptions/${subscriptionId}`);
    return response.data;
  },

  // Admin-only endpoints (will fail for non-admin users)
  processRefund: async (paymentId: number, amount?: number, reason?: string) => {
    const response = await apiClient.post(`/api/v1/payments/refund/${paymentId}`, {
      payment_id: paymentId,
      amount,
      reason: reason || 'requested_by_customer'
    });
    return response.data;
  }
};