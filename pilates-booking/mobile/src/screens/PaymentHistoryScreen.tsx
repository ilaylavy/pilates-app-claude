import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, SPACING } from '../utils/config';
import { paymentsApi, PaymentHistoryItem } from '../api/payments';

const PaymentHistoryScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const {
    data: paymentHistory,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['paymentHistory', page],
    queryFn: () => paymentsApi.getPaymentHistory(page, 10),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await refetch();
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (!paymentHistory || loadingMore) return;
    
    const hasMore = page * 10 < paymentHistory.total_count;
    if (!hasMore) return;

    setLoadingMore(true);
    setPage(prev => prev + 1);
    setLoadingMore(false);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return COLORS.success;
      case 'pending':
        return COLORS.warning;
      case 'failed':
        return COLORS.error;
      case 'refunded':
        return COLORS.textSecondary;
      case 'cancelled':
        return COLORS.disabled;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'failed':
        return 'close-circle';
      case 'refunded':
        return 'return-down-back';
      case 'cancelled':
        return 'ban';
      default:
        return 'help-circle';
    }
  };

  const formatPaymentType = (type: string) => {
    switch (type) {
      case 'package_purchase':
        return 'Package Purchase';
      case 'single_class':
        return 'Single Class';
      case 'late_cancellation_fee':
        return 'Late Cancellation Fee';
      case 'no_show_fee':
        return 'No Show Fee';
      case 'refund':
        return 'Refund';
      default:
        return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewInvoice = async (payment: PaymentHistoryItem) => {
    if (!payment.external_payment_id) {
      Alert.alert('Info', 'No invoice available for this payment.');
      return;
    }

    try {
      const invoice = await paymentsApi.getInvoice(payment.external_payment_id);
      if (invoice.hosted_invoice_url) {
        // Open invoice URL - you might want to use a WebView or external browser
        Alert.alert(
          'Invoice',
          'Invoice URL: ' + invoice.hosted_invoice_url,
          [
            { text: 'OK' }
          ]
        );
      } else {
        Alert.alert('Info', 'Invoice not available.');
      }
    } catch (error) {
      console.error('Failed to get invoice:', error);
      Alert.alert('Error', 'Failed to retrieve invoice.');
    }
  };

  const renderPaymentItem = ({ item }: { item: PaymentHistoryItem }) => (
    <TouchableOpacity 
      style={styles.paymentItem}
      onPress={() => handleViewInvoice(item)}
      activeOpacity={0.7}
    >
      <View style={styles.paymentHeader}>
        <View style={styles.paymentInfo}>
          <Text style={styles.paymentDescription}>
            {item.description || formatPaymentType(item.payment_type)}
          </Text>
          <Text style={styles.paymentDate}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={styles.paymentAmount}>
          <Text style={styles.amountText}>
            {item.currency === 'ils' ? '₪' : item.currency.toUpperCase()}{item.amount}
          </Text>
          <View style={[styles.statusContainer, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Ionicons 
              name={getStatusIcon(item.status) as any} 
              size={14} 
              color={getStatusColor(item.status)} 
            />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      {item.refund_amount && (
        <View style={styles.refundInfo}>
          <Text style={styles.refundText}>
            Refund: ₪{item.refund_amount} on {formatDate(item.refund_date!)}
          </Text>
        </View>
      )}

      <View style={styles.paymentDetails}>
        <Text style={styles.paymentMethod}>
          {item.payment_method.replace('_', ' ').toUpperCase()}
        </Text>
        {item.external_transaction_id && (
          <Text style={styles.transactionId}>
            ID: {item.external_transaction_id.slice(-8)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="card-outline" size={64} color={COLORS.disabled} />
      <Text style={styles.emptyTitle}>No Payment History</Text>
      <Text style={styles.emptyMessage}>
        Your payment history will appear here once you make your first purchase.
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading payment history...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={64} color={COLORS.error} />
        <Text style={styles.errorTitle}>Failed to load payment history</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={paymentHistory?.payments || []}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderPaymentItem}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContainer: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.error,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 8,
  },
  retryText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  paymentItem: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  paymentDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  paymentAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  refundInfo: {
    backgroundColor: COLORS.warning + '10',
    borderRadius: 6,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  refundText: {
    fontSize: 14,
    color: COLORS.warning,
    fontWeight: '500',
  },
  paymentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  paymentMethod: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  transactionId: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  loadingFooter: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptyMessage: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default PaymentHistoryScreen;