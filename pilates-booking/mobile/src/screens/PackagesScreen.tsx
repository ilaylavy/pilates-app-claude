import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { COLORS, SPACING } from '../utils/config';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { packagesApi } from '../api/packages';
import { useUserRole } from '../hooks/useUserRole';
import { useAuth } from '../hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import PackageCard from '../components/PackageCard';
import PackageEditModal from '../components/PackageEditModal';
import Button from '../components/common/Button';
import PurchaseModal from '../components/PurchaseModal';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import PendingApprovalCard from '../components/PendingApprovalCard';
import type { Package, UserPackage, UserPackagesResponse } from '../types';


type RootStackParamList = {
  Payment: {
    packageId: number;
    packageName: string;
    price: number;
    currency: string;
  };
  Profile: undefined;
  BookClass: undefined;
};

type PackagesScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const PackagesScreen: React.FC = () => {
  const { isAdmin } = useUserRole();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation<PackagesScreenNavigationProp>();
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [packageToPurchase, setPackageToPurchase] = useState<Package | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Queries
  const { data: availablePackages, isLoading: packagesLoading } = useQuery<Package[]>({
    queryKey: ['packages', isAdminMode ? 'all' : 'available'],
    queryFn: async () => {
      const endpoint = isAdminMode ? '/api/v1/packages/' : '/api/v1/packages/catalog';
      const response = await apiClient.get(endpoint);
      return response.data;
    },
    enabled: isAuthenticated,
  });

  const { data: userPackagesData, isLoading: userPackagesLoading } = useQuery<UserPackagesResponse>({
    queryKey: ['userPackages'],
    queryFn: () => packagesApi.getUserPackages(),
    enabled: isAuthenticated,
  });

  // Extract organized data from the new response structure
  const activePackages = userPackagesData?.active_packages || [];
  const pendingPackages = userPackagesData?.pending_packages || [];
  const historicalPackages = userPackagesData?.historical_packages || [];
  const primaryPackage = activePackages.find(pkg => pkg.is_primary);
  const totalCredits = userPackagesData?.total_credits || 0;
  const hasUnlimited = userPackagesData?.has_unlimited || false;

  // Mutations
  const togglePackageMutation = useMutation({
    mutationFn: async (packageId: number) => {
      await apiClient.patch(`/api/v1/packages/${packageId}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: async (packageId: number) => {
      await apiClient.delete(`/api/v1/packages/${packageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['packages'] });
    await queryClient.invalidateQueries({ queryKey: ['userPackages'] });
    setRefreshing(false);
  };

  const handleEditPackage = (pkg: Package) => {
    setSelectedPackage(pkg);
    setShowEditModal(true);
  };

  const handlePurchasePackage = (pkg: Package) => {
    setPackageToPurchase(pkg);
    setShowPurchaseModal(true);
  };

  const handleNavigateToPayment = (packageData: { packageId: number; packageName: string; price: number; currency: string }) => {
    navigation.navigate('Payment', packageData);
  };

  const handleDeletePackage = (pkg: Package) => {
    Alert.alert(
      'Delete Package',
      `Are you sure you want to delete "${pkg.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePackageMutation.mutate(pkg.id),
        },
      ]
    );
  };

  const handleTogglePackage = (pkg: Package) => {
    togglePackageMutation.mutate(pkg.id);
  };

  const formatExpiry = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires tomorrow';
    return `Expires in ${diffDays} days`;
  };

  const getHistoryStatusText = (userPackage: UserPackage) => {
    if (userPackage.payment_status === 'rejected') return 'Rejected';
    if (userPackage.credits_remaining === 0) return 'Completed';
    if (userPackage.is_expired) return 'Expired';
    return 'Inactive';
  };

  const renderCurrentBalance = () => {
    if (activePackages.length === 0) {
      return (
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Ionicons name="card" size={24} color={COLORS.textSecondary} />
            <Text style={styles.balanceTitle}>No Active Packages</Text>
          </View>
          <Text style={styles.balanceSubtitle}>
            Purchase a package to start booking classes
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <Ionicons name="card" size={24} color={COLORS.primary} />
          <Text style={styles.balanceTitle}>Total Balance</Text>
        </View>
        
        <View style={styles.balanceContent}>
          <Text style={styles.creditsNumber}>
            {hasUnlimited ? '∞' : totalCredits}
          </Text>
          <Text style={styles.creditsLabel}>Credits Available</Text>
        </View>
        
        {primaryPackage && (
          <View style={styles.balanceFooter}>
            <Text style={styles.primaryPackageText}>
              Primary: {primaryPackage.package.name}
            </Text>
            <Text style={styles.expiryText}>{formatExpiry(primaryPackage.expiry_date)}</Text>
          </View>
        )}
        
        {activePackages.length > 1 && (
          <Text style={styles.multiplePackagesText}>
            +{activePackages.length - 1} more package{activePackages.length > 2 ? 's' : ''}
          </Text>
        )}
      </View>
    );
  };

  const renderPendingPackages = () => {
    if (pendingPackages.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pending Payments</Text>
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation.navigate('PendingApprovals' as any)}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        
        {pendingPackages.slice(0, 2).map((userPackage) => (
          <PendingApprovalCard
            key={userPackage.id}
            userPackage={userPackage}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ['userPackages'] });
            }}
          />
        ))}
      </View>
    );
  };

  const renderPackageHistory = () => {
    if (historicalPackages.length === 0) return null;

    return (
      <View style={styles.section}>
        <TouchableOpacity style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Package History ({historicalPackages.length})</Text>
          <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        
        {historicalPackages.slice(0, 3).map((userPackage) => (
          <View key={userPackage.id} style={styles.historyItem}>
            <View style={styles.historyContent}>
              <Text style={styles.historyName}>{userPackage.package.name}</Text>
              <Text style={styles.historyDate}>
                Purchased {new Date(userPackage.purchase_date).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.historyStatusContainer}>
              {userPackage.payment_status && (
                <PaymentStatusBadge 
                  status={userPackage.payment_status}
                  size="small"
                />
              )}
              <Text style={[styles.historyStatus, { color: COLORS.textSecondary }]}>
                {getHistoryStatusText(userPackage)}
              </Text>
            </View>
          </View>
        ))}
        
        {historicalPackages.length > 3 && (
          <TouchableOpacity style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>
              View all {historicalPackages.length} packages
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Admin Toggle */}
        {isAdmin && (
          <View style={styles.adminHeader}>
            <Text style={styles.adminTitle}>Package Management</Text>
            <TouchableOpacity
              style={[styles.adminToggle, isAdminMode && styles.adminToggleActive]}
              onPress={() => setIsAdminMode(!isAdminMode)}
            >
              <Text style={[styles.adminToggleText, isAdminMode && styles.adminToggleTextActive]}>
                {isAdminMode ? 'Admin View' : 'Student View'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!isAdminMode && (
          <>
            {/* Current Balance Card */}
            {renderCurrentBalance()}

            {/* Pending Packages */}
            {renderPendingPackages()}

            {/* Available Packages */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Available Packages</Text>
              <FlatList
                data={availablePackages}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <PackageCard
                    package={item}
                    onPress={() => handlePurchasePackage(item)}
                    onPurchase={() => handlePurchasePackage(item)}
                    style={styles.packageCardHorizontal}
                  />
                )}
                contentContainerStyle={styles.horizontalList}
              />
            </View>

            {/* Package History */}
            {renderPackageHistory()}
          </>
        )}

        {/* Admin View */}
        {isAdminMode && (
          <View style={styles.adminSection}>
            <View style={styles.adminActions}>
              <Button
                title="Add New Package"
                onPress={() => {
                  setSelectedPackage(null);
                  setShowEditModal(true);
                }}
                style={styles.addButton}
              />
            </View>

            <FlatList
              data={availablePackages}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <PackageCard
                  package={item}
                  isAdminMode
                  onEdit={() => handleEditPackage(item)}
                  onDelete={() => handleDeletePackage(item)}
                  onToggle={() => handleTogglePackage(item)}
                  style={styles.adminPackageCard}
                />
              )}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      {showEditModal && (
        <PackageEditModal
          visible={showEditModal}
          package={selectedPackage}
          onClose={() => {
            setShowEditModal(false);
            setSelectedPackage(null);
          }}
          onSave={() => {
            setShowEditModal(false);
            setSelectedPackage(null);
            queryClient.invalidateQueries({ queryKey: ['packages'] });
          }}
        />
      )}

      {showPurchaseModal && packageToPurchase && (
        <PurchaseModal
          visible={showPurchaseModal}
          package={packageToPurchase}
          onClose={() => {
            setShowPurchaseModal(false);
            setPackageToPurchase(null);
          }}
          onPurchase={() => {
            setShowPurchaseModal(false);
            setPackageToPurchase(null);
            queryClient.invalidateQueries({ queryKey: ['userPackages'] });
          }}
          onNavigateToPayment={handleNavigateToPayment}
        />
      )}
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
  adminHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  adminTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  adminToggle: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 16,
  },
  adminToggleActive: {
    backgroundColor: COLORS.primary,
  },
  adminToggleText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  adminToggleTextActive: {
    color: COLORS.background,
  },
  balanceCard: {
    backgroundColor: COLORS.card,
    margin: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  balanceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  balanceContent: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  creditsNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  creditsLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  balanceFooter: {
    gap: SPACING.sm,
  },
  expiryText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  balanceSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  horizontalList: {
    paddingLeft: SPACING.lg,
  },
  packageCardHorizontal: {
    marginRight: SPACING.md,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  },
  historyContent: {
    flex: 1,
  },
  historyName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  historyDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  historyStatusContainer: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  viewAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  adminSection: {
    padding: SPACING.lg,
  },
  adminActions: {
    marginBottom: SPACING.lg,
  },
  addButton: {
    marginBottom: SPACING.md,
  },
  adminPackageCard: {
    marginBottom: SPACING.md,
  },
  primaryPackageText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  multiplePackagesText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  viewAllButton: {
    padding: SPACING.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
  },
  viewAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
});

export default PackagesScreen;