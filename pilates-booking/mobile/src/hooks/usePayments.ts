import { useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '../api/payments';
import { packagesApi } from '../api/packages';
import { NOTIFICATION_QUERY_KEYS } from './useNotifications';
import { Logger } from '../services/LoggingService';
import { PaymentMethodType } from '../types';

// Payment hooks with notification triggers
export const useCreatePaymentIntent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: { packageId: number; currency: string }) => 
      paymentsApi.createPaymentIntent(params.packageId, params.currency),
    onSuccess: (data, variables) => {
      Logger.info('Payment intent created successfully', {
        paymentIntentId: data.payment_intent_id,
        packageId: variables.packageId,
        amount: data.amount
      });
      
      Logger.trackEvent('payment.intent_created', {
        paymentIntentId: data.payment_intent_id,
        packageId: variables.packageId,
        amount: data.amount,
        currency: data.currency
      });
    },
    onError: (error: any, variables) => {
      Logger.error('Failed to create payment intent', error, {
        packageId: variables.packageId,
        currency: variables.currency
      });
      
      Logger.trackEvent('payment.intent_failed', {
        packageId: variables.packageId,
        error: error.message
      });
    }
  });
};

export const useConfirmPayment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (paymentIntentId: string) => paymentsApi.confirmPayment(paymentIntentId),
    onSuccess: (data, paymentIntentId) => {
      // Invalidate queries to refresh package data
      queryClient.invalidateQueries({ queryKey: ['userPackages'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      queryClient.invalidateQueries({ queryKey: ['packages', 'balance'] });
      
      // Trigger notification refresh after successful payment
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount });
      
      Logger.info('Payment confirmed successfully - notifications will be refreshed', {
        paymentId: data.payment_id,
        paymentIntentId,
        credits: data.credits,
        expiryDate: data.expiry_date
      });
      
      Logger.trackEvent('payment.success_notification_trigger', {
        paymentId: data.payment_id,
        paymentIntentId,
        credits: data.credits,
        packageActivated: !!data.expiry_date
      });
    },
    onError: (error: any, paymentIntentId) => {
      // Also trigger notification refresh on payment failure to catch any failure notifications
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount });
      
      Logger.error('Payment confirmation failed - checking for failure notifications', error, {
        paymentIntentId
      });
      
      Logger.trackEvent('payment.failure_notification_trigger', {
        paymentIntentId,
        error: error.message
      });
    }
  });
};

export const useCreateCashReservation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (packageId: number) => paymentsApi.createCashReservation(packageId),
    onSuccess: (data, packageId) => {
      // Invalidate queries to refresh package data
      queryClient.invalidateQueries({ queryKey: ['userPackages'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      
      // Trigger notification refresh after cash reservation
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount });
      
      Logger.info('Cash reservation created - notifications will be refreshed', {
        reservationId: data.reservation_id,
        packageId,
        status: data.status
      });
      
      Logger.trackEvent('payment.cash_reservation_notification_trigger', {
        reservationId: data.reservation_id,
        packageId,
        status: data.status
      });
    },
    onError: (error: any, packageId) => {
      Logger.error('Failed to create cash reservation', error, {
        packageId
      });
      
      Logger.trackEvent('payment.cash_reservation_failed', {
        packageId,
        error: error.message
      });
    }
  });
};

// Package purchase hook with notification triggers
export const usePurchasePackage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: { 
      packageId: number; 
      paymentMethod: PaymentMethodType; 
      paymentReference?: string;
    }) => packagesApi.purchasePackage(
      params.packageId, 
      params.paymentMethod, 
      params.paymentReference
    ),
    onSuccess: (data, variables) => {
      // Invalidate queries to refresh package data
      queryClient.invalidateQueries({ queryKey: ['userPackages'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      queryClient.invalidateQueries({ queryKey: ['packages', 'balance'] });
      
      // Trigger notification refresh after package purchase
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount });
      
      // Check if this is a UserPackage (activated) or CashPaymentInstructions (pending)
      const isActivated = 'id' in data && 'credits' in data;
      
      Logger.info('Package purchased - notifications will be refreshed', {
        packageId: variables.packageId,
        paymentMethod: variables.paymentMethod,
        isActivated,
        userPackageId: isActivated ? (data as any).id : undefined
      });
      
      Logger.trackEvent('package.purchase_notification_trigger', {
        packageId: variables.packageId,
        paymentMethod: variables.paymentMethod,
        isActivated,
        userPackageId: isActivated ? (data as any).id : undefined
      });
    },
    onError: (error: any, variables) => {
      Logger.error('Package purchase failed', error, {
        packageId: variables.packageId,
        paymentMethod: variables.paymentMethod
      });
      
      Logger.trackEvent('package.purchase_failed', {
        packageId: variables.packageId,
        paymentMethod: variables.paymentMethod,
        error: error.message
      });
    }
  });
};

// Admin approval hooks with notification triggers
export const useConfirmCashPayment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: { 
      packageId: number; 
      data: { 
        payment_reference: string; 
        notes?: string; 
        payment_date?: string;
      };
    }) => packagesApi.confirmPayment(params.packageId, params.data),
    onSuccess: (_, variables) => {
      // Invalidate all package-related queries
      queryClient.invalidateQueries({ queryKey: ['userPackages'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'approvals'] });
      
      // Trigger notification refresh after admin approval
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount });
      
      Logger.info('Cash payment confirmed by admin - notifications will be refreshed', {
        packageId: variables.packageId,
        paymentReference: variables.data.payment_reference
      });
      
      Logger.trackEvent('admin.payment_confirmed_notification_trigger', {
        packageId: variables.packageId,
        hasNotes: !!variables.data.notes
      });
    },
    onError: (error: any, variables) => {
      Logger.error('Failed to confirm cash payment', error, {
        packageId: variables.packageId,
        paymentReference: variables.data.payment_reference
      });
    }
  });
};

export const useRejectPackage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: { 
      packageId: number; 
      data: { 
        reason: string; 
        notes?: string;
      };
    }) => packagesApi.rejectPackage(params.packageId, params.data),
    onSuccess: (_, variables) => {
      // Invalidate all package-related queries
      queryClient.invalidateQueries({ queryKey: ['userPackages'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'approvals'] });
      
      // Trigger notification refresh after admin rejection
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount });
      
      Logger.info('Package rejected by admin - notifications will be refreshed', {
        packageId: variables.packageId,
        reason: variables.data.reason
      });
      
      Logger.trackEvent('admin.package_rejected_notification_trigger', {
        packageId: variables.packageId,
        hasNotes: !!variables.data.notes
      });
    },
    onError: (error: any, variables) => {
      Logger.error('Failed to reject package', error, {
        packageId: variables.packageId,
        reason: variables.data.reason
      });
    }
  });
};

// Combined payment hooks
export const usePaymentActions = () => {
  const createPaymentIntent = useCreatePaymentIntent();
  const confirmPayment = useConfirmPayment();
  const createCashReservation = useCreateCashReservation();
  const purchasePackage = usePurchasePackage();
  const confirmCashPayment = useConfirmCashPayment();
  const rejectPackage = useRejectPackage();
  
  return {
    // Payment actions
    createPaymentIntent: createPaymentIntent.mutate,
    confirmPayment: confirmPayment.mutate,
    createCashReservation: createCashReservation.mutate,
    purchasePackage: purchasePackage.mutate,
    
    // Admin actions
    confirmCashPayment: confirmCashPayment.mutate,
    rejectPackage: rejectPackage.mutate,
    
    // Loading states
    isCreatingIntent: createPaymentIntent.isPending,
    isConfirmingPayment: confirmPayment.isPending,
    isCreatingCashReservation: createCashReservation.isPending,
    isPurchasing: purchasePackage.isPending,
    isConfirmingCash: confirmCashPayment.isPending,
    isRejecting: rejectPackage.isPending,
    
    // Any action in progress
    isLoading: createPaymentIntent.isPending || 
               confirmPayment.isPending || 
               createCashReservation.isPending ||
               purchasePackage.isPending ||
               confirmCashPayment.isPending ||
               rejectPackage.isPending,
    
    // Error states
    paymentError: createPaymentIntent.error || confirmPayment.error,
    cashError: createCashReservation.error,
    purchaseError: purchasePackage.error,
    adminError: confirmCashPayment.error || rejectPackage.error,
    
    // Success states
    paymentSuccess: confirmPayment.isSuccess,
    cashSuccess: createCashReservation.isSuccess,
    purchaseSuccess: purchasePackage.isSuccess,
    adminSuccess: confirmCashPayment.isSuccess || rejectPackage.isSuccess
  };
};