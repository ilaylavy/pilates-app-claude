import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { COLORS, SPACING } from '../utils/config';
import { packagesApi } from '../api/packages';
import { UserPackage } from '../types';
import PendingApprovalCard from '../components/PendingApprovalCard';
import CashPaymentInstructions from '../components/CashPaymentInstructions';

const PendingApprovalsScreen: React.FC = () => {
  const [showInstructions, setShowInstructions] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<UserPackage | null>(null);

  const {
    data: userPackages = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['userPackages'],
    queryFn: packagesApi.getUserPackages,
  });

  // Filter packages that are pending approval or authorized (payment pending)
  const pendingPackages = userPackages.filter(
    (pkg) => pkg.is_pending_approval || 
             pkg.payment_status === 'pending_approval' ||
             pkg.payment_status === 'authorized'
  );

  const handleShowInstructions = useCallback((userPackage: UserPackage) => {
    setSelectedPackage(userPackage);
    setShowInstructions(true);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading pending approvals...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to Load Packages</Text>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Please try again later'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Pending Payments</Text>
          <Text style={styles.subtitle}>
            Complete your cash payments at reception to fully confirm your packages
          </Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
          >
            <Ionicons name="refresh" size={20} color={COLORS.primary} />
            <Text style={styles.refreshText}>Check Status</Text>
          </TouchableOpacity>
        </View>

        {pendingPackages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptyText}>
              You don't have any packages pending payment approval.
            </Text>
          </View>
        ) : (
          <View style={styles.packagesContainer}>
            {pendingPackages.map((userPackage) => (
              <PendingApprovalCard
                key={userPackage.id}
                userPackage={userPackage}
                onShowInstructions={() => handleShowInstructions(userPackage)}
                onRefresh={handleRefresh}
              />
            ))}

            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>Payment Process</Text>
              <Text style={styles.infoText}>
                • <Text style={styles.infoTextBold}>Step 1:</Text> Admin authorizes your payment - you can use credits immediately{'\n'}
                • <Text style={styles.infoTextBold}>Step 2:</Text> Visit reception to complete cash payment{'\n'}
                • Show your reference code to the staff{'\n'}
                • Payment will be fully confirmed within 2 hours{'\n'}
                • Use "Check Status" button to see updates{'\n'}{'\n'}
                <Text style={styles.infoTextBold}>📍 Can I use my credits?</Text> Yes! Once authorized (orange status), you can start booking classes immediately.{'\n'}{'\n'}
                <Text style={styles.infoTextBold}>Need help?</Text> Contact reception if payment isn't processed within 2 hours.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Cash Payment Instructions Modal */}
      {selectedPackage && selectedPackage.payment_reference && (
        <CashPaymentInstructions
          visible={showInstructions}
          instructions={{
            message: 'Package reserved for cash payment',
            status: 'pending_approval',
            package_id: selectedPackage.package_id,
            package_name: selectedPackage.package.name,
            user_package_id: selectedPackage.id,
            price: selectedPackage.package.price,
            currency: 'ILS',
            payment_method: 'cash',
            reference_code: selectedPackage.payment_reference,
            payment_instructions: [
              'Visit the studio reception desk',
              `Pay ₪${selectedPackage.package.price} in cash`,
              `Show reference code: ${selectedPackage.payment_reference}`,
              'Credits will be activated after payment confirmation',
            ],
            reservation_expires_at: selectedPackage.reservation_expires_at || '',
            estimated_approval_time: 'Usually approved within 2 hours during business hours',
          }}
          onClose={() => {
            setShowInstructions(false);
            setSelectedPackage(null);
          }}
        />
      )}
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
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.error,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '20',
    borderRadius: 8,
    padding: SPACING.sm,
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  refreshText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  packagesContainer: {
    gap: SPACING.lg,
  },
  infoSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  infoTextBold: {
    fontWeight: '600',
    color: COLORS.text,
  },
});

export default PendingApprovalsScreen;