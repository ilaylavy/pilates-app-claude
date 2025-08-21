import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { COLORS, SPACING } from '../utils/config';
import { paymentsApi, PaymentMethod, PaymentHistory } from '../api/payments';
import Button from '../components/common/Button';

const PaymentMethodsScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'card' | 'cash'>('all');
  const queryClient = useQueryClient();

  // Fetch saved payment methods
  const {
    data: paymentMethods,
    isLoading: methodsLoading,
    error: methodsError,
  } = useQuery({
    queryKey: ['paymentMethods'],
    queryFn: paymentsApi.getPaymentMethods,
  });

  // Fetch payment history
  const {
    data: paymentHistory,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['paymentHistory'],
    queryFn: () => paymentsApi.getPaymentHistory(1, 50),
  });

  // Remove payment method mutation
  const removePaymentMethodMutation = useMutation({
    mutationFn: (methodId: string) => paymentsApi.removePaymentMethod(methodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
      Alert.alert('Success', 'Payment method removed successfully');
    },
    onError: (error: any) => {
      console.error('Remove payment method error:', error);
      Alert.alert('Error', 'Failed to remove payment method');
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] }),
      refetchHistory(),
    ]);
    setRefreshing(false);
  };

  const handleRemovePaymentMethod = (methodId: string, lastFour: string) => {
    Alert.alert(
      'Remove Payment Method',
      `Are you sure you want to remove the card ending in ${lastFour}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removePaymentMethodMutation.mutate(methodId),
        },
      ]
    );
  };

  const getCardBrandIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa':
        return '💳';
      case 'mastercard':
        return '💳';
      case 'amex':
        return '💳';
      default:
        return '💳';
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return COLORS.success;
      case 'pending':
        return COLORS.warning;
      case 'failed':
      case 'cancelled':
        return COLORS.error;
      default:
        return COLORS.textSecondary;
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'cash':
        return '💵';
      case 'stripe':
      case 'credit_card':
        return '💳';
      default:
        return '💰';
    }
  };

  const filteredHistory = paymentHistory?.payments.filter((payment) => {
    if (filter === 'all') return true;
    if (filter === 'card') return ['stripe', 'credit_card'].includes(payment.payment_method);
    if (filter === 'cash') return payment.payment_method === 'cash';
    return true;
  });

  const renderSavedCards = () => {
    if (methodsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading payment methods...</Text>
        </View>
      );
    }

    if (!paymentMethods || paymentMethods.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💳</Text>
          <Text style={styles.emptyTitle}>No Saved Cards</Text>
          <Text style={styles.emptyText}>
            Your saved payment methods will appear here
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved Cards</Text>
        {paymentMethods.map((method) => (
          <View key={method.id} style={styles.paymentMethodCard}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardIcon}>
                {getCardBrandIcon(method.card.brand)}
              </Text>
              <View style={styles.cardDetails}>
                <Text style={styles.cardBrand}>
                  {method.card.brand.toUpperCase()} •••• {method.card.last4}
                </Text>
                <Text style={styles.cardExpiry}>
                  Expires {method.card.exp_month.toString().padStart(2, '0')}/
                  {method.card.exp_year.toString().slice(-2)}
                </Text>
                <Text style={styles.cardAdded}>
                  Added {formatDate(method.created)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemovePaymentMethod(method.id, method.card.last4)}
            >
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  const renderPaymentHistory = () => {
    if (historyLoading) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading payment history...</Text>
        </View>
      );
    }

    if (!filteredHistory || filteredHistory.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Payment History</Text>
          <Text style={styles.emptyText}>
            Your payment history will appear here
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          <View style={styles.filterContainer}>
            {(['all', 'card', 'cash'] as const).map((filterOption) => (
              <TouchableOpacity
                key={filterOption}
                style={[
                  styles.filterButton,
                  filter === filterOption && styles.filterButtonActive,
                ]}
                onPress={() => setFilter(filterOption)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filter === filterOption && styles.filterButtonTextActive,
                  ]}
                >
                  {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {filteredHistory.map((payment) => (
          <View key={payment.id} style={styles.historyItem}>
            <View style={styles.historyIcon}>
              <Text style={styles.historyIconText}>
                {getPaymentMethodIcon(payment.payment_method)}
              </Text>
            </View>
            <View style={styles.historyDetails}>
              <Text style={styles.historyDescription}>
                {payment.description || 'Package Purchase'}
              </Text>
              <Text style={styles.historyDate}>
                {payment.payment_date
                  ? formatDate(new Date(payment.payment_date).getTime() / 1000)
                  : formatDate(new Date(payment.created_at).getTime() / 1000)}
              </Text>
              <View style={styles.historyMeta}>
                <Text
                  style={[
                    styles.historyStatus,
                    { color: getStatusColor(payment.status) },
                  ]}
                >
                  {payment.status.toUpperCase()}
                </Text>
                <Text style={styles.historyMethod}>
                  {payment.payment_method === 'cash' ? 'Cash' : 'Card'}
                </Text>
              </View>
            </View>
            <View style={styles.historyAmount}>
              <Text style={styles.historyAmountText}>
                ₪{payment.amount.toFixed(2)}
              </Text>
              {payment.status === 'completed' && payment.is_refundable && (
                <Text style={styles.refundableText}>Refundable</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderSavedCards()}
        {renderPaymentHistory()}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Add New Payment Method"
          onPress={() => {
            Alert.alert(
              'Add Payment Method',
              'Add a new card by making a purchase and selecting "Save card for future use"'
            );
          }}
          style={styles.addButton}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
    padding: SPACING.md,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  paymentMethodCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: SPACING.md,
  },
  cardDetails: {
    flex: 1,
  },
  cardBrand: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  cardExpiry: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  cardAdded: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  removeButton: {
    backgroundColor: COLORS.error + '15',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
  },
  removeButtonText: {
    fontSize: 14,
    color: COLORS.error,
    fontWeight: '500',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 2,
  },
  filterButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: COLORS.white,
  },
  historyItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  historyIconText: {
    fontSize: 18,
  },
  historyDetails: {
    flex: 1,
  },
  historyDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  historyDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: SPACING.sm,
  },
  historyMethod: {
    fontSize: 12,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.border + '30',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyAmount: {
    alignItems: 'flex-end',
  },
  historyAmountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  refundableText: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: '500',
  },
  footer: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  addButton: {
    backgroundColor: COLORS.primary,
  },
});

export default PaymentMethodsScreen;