import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { COLORS, SPACING } from '../../utils/config';
import { packagesApi } from '../../api/packages';
import { useAuth } from '../../hooks/useAuth';
import PaymentStatusBadge from '../../components/PaymentStatusBadge';
// import EnhancedPackageCard from '../../components/packages/EnhancedPackageCard';
import type { UserPackagesResponse, UserPackage } from '../../types';

const PackageHistoryScreen: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: userPackagesData } = useQuery<UserPackagesResponse>({
    queryKey: ['userPackages'],
    queryFn: () => packagesApi.getUserPackages(),
    enabled: isAuthenticated,
  });

  const historicalPackages = userPackagesData?.historical_packages || [];

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['userPackages'] });
    setRefreshing(false);
  };

  const getStatusText = (pkg: any) => {
    if (pkg.payment_status === 'rejected') return 'Payment Rejected';
    if (pkg.is_expired) return 'Expired';
    if (pkg.credits_remaining === 0) return 'Fully Used';
    return 'Inactive';
  };

  const getStatusColor = (pkg: any) => {
    if (pkg.payment_status === 'rejected') return COLORS.error;
    if (pkg.is_expired) return COLORS.warning;
    if (pkg.credits_remaining === 0) return COLORS.success;
    return COLORS.textSecondary;
  };

  const calculateDaysExpired = (expiryDate: string): number => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = now.getTime() - expiry.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const renderHistoryItem = (pkg: UserPackage) => {
    const daysExpired = pkg.is_expired ? calculateDaysExpired(pkg.expiry_date) : 0;
    
    return (
      <View key={pkg.id} style={styles.activePackageCard}>
        <View style={styles.activePackageHeader}>
          <View style={styles.activePackageIcon}>
            <Ionicons 
              name={pkg.package.is_unlimited ? "infinite" : "flash"} 
              size={20} 
              color={pkg.is_expired ? COLORS.error : COLORS.primary} 
            />
          </View>
          <View style={styles.activePackageInfo}>
            <Text style={styles.activePackageName}>{pkg.package.name}</Text>
            <Text style={styles.activePackageCredits}>
              {pkg.package.is_unlimited ? '∞' : `${pkg.credits_remaining} of ${pkg.package.credits}`} credits
            </Text>
          </View>
          <PaymentStatusBadge status={pkg.payment_status} size="small" />
        </View>
        
        {!pkg.package.is_unlimited && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { 
                    width: `${((pkg.package.credits - pkg.credits_remaining) / pkg.package.credits) * 100}%`,
                    backgroundColor: pkg.is_expired ? COLORS.error : COLORS.primary
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round(((pkg.package.credits - pkg.credits_remaining) / pkg.package.credits) * 100)}% used
            </Text>
          </View>
        )}
        
        <View style={styles.activePackageFooter}>
          <Text style={[
            styles.expiryText,
            pkg.is_expired && { color: COLORS.error }
          ]}>
            {pkg.is_expired 
              ? daysExpired > 0 
                ? `Expired ${daysExpired} days ago`
                : 'Expired today'
              : pkg.days_until_expiry > 0 
                ? `Expires in ${pkg.days_until_expiry} days`
                : 'Expired'
            }
          </Text>
          <Text style={styles.purchaseDate}>
            Purchased {new Date(pkg.purchase_date).toLocaleDateString()}
          </Text>
        </View>

        {pkg.rejection_reason && (
          <View style={styles.rejectionNotice}>
            <Ionicons name="warning" size={16} color={COLORS.error} />
            <Text style={styles.rejectionText}>{pkg.rejection_reason}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderAnalytics = () => {
    if (historicalPackages.length === 0) return null;

    const totalSpent = historicalPackages.reduce((sum, pkg) => sum + pkg.package.price, 0);
    const totalCreditsUsed = historicalPackages.reduce(
      (sum, pkg) => sum + (pkg.package.credits - pkg.credits_remaining), 
      0
    );

    return (
      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsTitle}>Package History Summary</Text>
        <View style={styles.analyticsGrid}>
          <View style={styles.analyticsItem}>
            <Text style={styles.analyticsNumber}>{historicalPackages.length}</Text>
            <Text style={styles.analyticsLabel}>Total Packages</Text>
          </View>
          <View style={styles.analyticsItem}>
            <Text style={styles.analyticsNumber}>₪{totalSpent}</Text>
            <Text style={styles.analyticsLabel}>Total Spent</Text>
          </View>
          <View style={styles.analyticsItem}>
            <Text style={styles.analyticsNumber}>{totalCreditsUsed}</Text>
            <Text style={styles.analyticsLabel}>Classes Taken</Text>
          </View>
        </View>
      </View>
    );
  };

  if (historicalPackages.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.emptyContainer}
        >
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No Package History</Text>
            <Text style={styles.emptySubtext}>
              Your completed and expired packages will appear here
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {renderAnalytics()}
        
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Package History</Text>
          {historicalPackages.map(renderHistoryItem)}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  emptySubtext: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  analyticsCard: {
    backgroundColor: COLORS.card,
    margin: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  analyticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  analyticsItem: {
    alignItems: 'center',
  },
  analyticsNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  analyticsLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  historySection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  activePackageCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activePackageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  activePackageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  activePackageInfo: {
    flex: 1,
  },
  activePackageName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  activePackageCredits: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  progressContainer: {
    marginBottom: SPACING.md,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  activePackageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expiryText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  purchaseDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  packageInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  packageName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  packageDetails: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  rejectionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error + '10',
    borderRadius: 8,
    padding: SPACING.sm,
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  rejectionText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '500',
  },
});

export default PackageHistoryScreen;