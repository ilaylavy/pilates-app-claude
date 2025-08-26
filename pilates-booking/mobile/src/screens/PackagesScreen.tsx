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
  // Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { COLORS, SPACING } from '../utils/config';
import { packagesApi } from '../api/packages';
import { apiClient } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useUserRole } from '../hooks/useUserRole';
import type { UserPackagesResponse, Package } from '../types';
import EnhancedPackageCard from '../components/packages/EnhancedPackageCard';
import QuickPurchaseModal from '../components/packages/QuickPurchaseModal';
import SimplePendingCard from '../components/SimplePendingCard';
import PackageEditModal from '../components/PackageEditModal';
import Button from '../components/common/Button';
import PurchaseModal from '../components/PurchaseModal';

// const { width } = Dimensions.get('window');

type RootStackParamList = {
  PackageHistory: undefined;
  Payment: {
    packageId: number;
    packageName: string;
    price: number;
    currency: string;
  };
};

type PackagesScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const PackagesScreen: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const navigation = useNavigation<PackagesScreenNavigationProp>();
  const [refreshing, setRefreshing] = useState(false);
  const [currentView, setCurrentView] = useState<'active' | 'browse'>('active');
  const [packageToPurchase, setPackageToPurchase] = useState<Package | null>(null);
  const [showAllPending, setShowAllPending] = useState(false);
  
  // Admin states
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Queries
  const { data: userPackagesData, isLoading: userPackagesLoading } = useQuery<UserPackagesResponse>({
    queryKey: ['userPackages'],
    queryFn: () => packagesApi.getUserPackages(),
    enabled: isAuthenticated && !isAdminMode,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });

  const { data: availablePackages } = useQuery<Package[]>({
    queryKey: ['packages', isAdminMode ? 'all' : 'available'],
    queryFn: async () => {
      const endpoint = isAdminMode ? '/api/v1/packages/' : '/api/v1/packages/catalog';
      const response = await apiClient.get(endpoint);
      return response.data;
    },
    enabled: isAuthenticated,
  });

  const activePackages = userPackagesData?.active_packages || [];
  const pendingPackages = userPackagesData?.pending_packages || [];
  const historicalPackages = userPackagesData?.historical_packages || [];
  const totalCredits = userPackagesData?.total_credits || 0;
  const hasUnlimited = userPackagesData?.has_unlimited || false;
  const primaryPackage = activePackages.find(pkg => pkg.is_primary);


  // Mutations for admin
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
    await queryClient.invalidateQueries({ queryKey: ['userPackages'] });
    await queryClient.invalidateQueries({ queryKey: ['packages'] });
    setRefreshing(false);
  };

  const handlePurchase = (pkg: Package) => {
    setPackageToPurchase(pkg);
  };

  const handleViewHistory = () => {
    navigation.navigate('PackageHistory');
  };

  // Admin handlers
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

  // Header with toggle buttons (for student view) or admin toggle
  const renderHeader = () => (
    <View style={styles.header}>
      {isAdmin ? (
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
      ) : (
        <>
          <Text style={styles.headerTitle}>My Packages</Text>
          
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, currentView === 'active' && styles.toggleButtonActive]}
              onPress={() => setCurrentView('active')}
            >
              <Ionicons 
                name="flash" 
                size={16} 
                color={currentView === 'active' ? COLORS.background : COLORS.textSecondary} 
              />
              <Text style={[
                styles.toggleButtonText,
                currentView === 'active' && styles.toggleButtonTextActive
              ]}>
                My Packages
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.toggleButton, currentView === 'browse' && styles.toggleButtonActive]}
              onPress={() => setCurrentView('browse')}
            >
              <Ionicons 
                name="storefront" 
                size={16} 
                color={currentView === 'browse' ? COLORS.background : COLORS.textSecondary} 
              />
              <Text style={[
                styles.toggleButtonText,
                currentView === 'browse' && styles.toggleButtonTextActive
              ]}>
                Buy Packages
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  // Credits overview card
  const renderCreditsOverview = () => {
    if (activePackages.length === 0) return null;
    
    const isLowCredits = totalCredits <= 2 && !hasUnlimited;
    
    return (
      <View style={[styles.creditsCard, isLowCredits && styles.lowCreditsCard]}>
        <View style={styles.creditsHeader}>
          <View style={styles.creditsIconContainer}>
            <Ionicons 
              name={hasUnlimited ? "infinite" : "flash"} 
              size={28} 
              color={isLowCredits ? COLORS.warning : COLORS.primary} 
            />
          </View>
          <View style={styles.creditsContent}>
            <Text style={[styles.creditsNumber, isLowCredits && { color: COLORS.warning }]}>
              {hasUnlimited ? '∞' : totalCredits}
            </Text>
            <Text style={styles.creditsLabel}>Credits Available</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
        
        {primaryPackage && (
          <View style={styles.primaryInfo}>
            <Text style={styles.primaryLabel}>Primary Package</Text>
            <Text style={styles.primaryName}>{primaryPackage.package.name}</Text>
            <Text style={styles.primaryExpiry}>
              {primaryPackage.days_until_expiry > 0 
                ? `Expires in ${primaryPackage.days_until_expiry} days`
                : 'Expired'}
            </Text>
          </View>
        )}
        
        {isLowCredits && (
          <View style={styles.lowCreditsAlert}>
            <Ionicons name="warning" size={16} color={COLORS.warning} />
            <Text style={styles.lowCreditsText}>Running low! Consider purchasing more credits.</Text>
          </View>
        )}
      </View>
    );
  };

  // Pending packages section
  const renderPendingPackages = () => {
    if (pendingPackages.length === 0) return null;

    const displayedPackages = showAllPending ? pendingPackages : pendingPackages.slice(0, 2);
    const hasMorePending = pendingPackages.length > 2;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pending Payments ({pendingPackages.length})</Text>
          {hasMorePending && (
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => setShowAllPending(!showAllPending)}
            >
              <Text style={styles.viewAllText}>
                {showAllPending ? 'Show Less' : 'View All'}
              </Text>
              <Ionicons 
                name={showAllPending ? "chevron-up" : "chevron-down"} 
                size={16} 
                color={COLORS.primary} 
              />
            </TouchableOpacity>
          )}
        </View>
        
        {displayedPackages.map((userPackage) => (
          <SimplePendingCard
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

  // Active packages view (student)
  const renderActiveView = () => (
    <ScrollView
      style={styles.scrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {renderCreditsOverview()}
      
      {/* Pending Packages Section */}
      {renderPendingPackages()}
      
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Packages ({activePackages.length})</Text>
          <TouchableOpacity style={styles.historyButton} onPress={handleViewHistory}>
            <Ionicons name="time" size={16} color={COLORS.primary} />
            <Text style={styles.historyButtonText}>History</Text>
          </TouchableOpacity>
        </View>
        
        {userPackagesLoading ? (
          <View style={styles.loadingState}>
            <Text style={styles.loadingText}>Loading packages...</Text>
          </View>
        ) : activePackages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No Active Packages</Text>
            <Text style={styles.emptySubtext}>Purchase a package to start booking classes</Text>
            <TouchableOpacity 
              style={styles.browseButton}
              onPress={() => setCurrentView('browse')}
            >
              <Text style={styles.browseButtonText}>Browse Packages</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.packageGrid}>
            {activePackages.map((userPackage) => (
              <View key={userPackage.id} style={styles.activePackageCard}>
                <View style={styles.activePackageHeader}>
                  <View style={styles.activePackageIcon}>
                    <Ionicons 
                      name={userPackage.package.is_unlimited ? "infinite" : "flash"} 
                      size={20} 
                      color={COLORS.primary} 
                    />
                  </View>
                  <View style={styles.activePackageInfo}>
                    <Text style={styles.activePackageName}>{userPackage.package.name}</Text>
                    <Text style={styles.activePackageCredits}>
                      {userPackage.package.is_unlimited ? '∞' : userPackage.credits_remaining} of {userPackage.package.is_unlimited ? '∞' : userPackage.package.credits} credits
                    </Text>
                  </View>
                  {userPackage.is_primary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>PRIMARY</Text>
                    </View>
                  )}
                </View>
                
                {!userPackage.package.is_unlimited && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill,
                          { width: `${(userPackage.credits_remaining / userPackage.package.credits) * 100}%` }
                        ]} 
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {Math.round((userPackage.credits_remaining / userPackage.package.credits) * 100)}% remaining
                    </Text>
                  </View>
                )}
                
                <View style={styles.activePackageFooter}>
                  <Text style={styles.expiryText}>
                    {userPackage.days_until_expiry > 0 
                      ? `Expires in ${userPackage.days_until_expiry} days`
                      : 'Expired'}
                  </Text>
                  <Text style={styles.purchaseDate}>
                    Purchased {new Date(userPackage.purchase_date).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );

  // Browse packages view (student)
  const renderBrowseView = () => (
    <ScrollView
      style={styles.scrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Packages</Text>
        <Text style={styles.sectionSubtitle}>
          Choose the perfect package for your fitness journey
        </Text>
        
        <FlatList
          data={availablePackages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <EnhancedPackageCard
              package={item}
              onQuickPurchase={() => handlePurchase(item)}
              style={styles.packageCard}
            />
          )}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </ScrollView>
  );

  // Admin view
  const renderAdminView = () => (
    <ScrollView
      style={styles.scrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
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
            <EnhancedPackageCard
              package={item}
              style={styles.adminPackageCard}
            />
          )}
          scrollEnabled={false}
        />
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      
      {isAdminMode ? (
        renderAdminView()
      ) : (
        currentView === 'active' ? renderActiveView() : renderBrowseView()
      )}
      
      {/* Purchase Modal */}
      {packageToPurchase && !showPurchaseModal && (
        <QuickPurchaseModal
          visible={!!packageToPurchase}
          package={packageToPurchase}
          onClose={() => setPackageToPurchase(null)}
          onPurchase={() => {
            setPackageToPurchase(null);
            queryClient.invalidateQueries({ queryKey: ['userPackages'] });
            setCurrentView('active'); // Switch to active view after purchase
          }}
        />
      )}

      {/* Admin Modals */}
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
  header: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    gap: SPACING.xs,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  toggleButtonTextActive: {
    color: COLORS.background,
  },
  adminHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  scrollView: {
    flex: 1,
  },
  creditsCard: {
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
  lowCreditsCard: {
    borderWidth: 2,
    borderColor: COLORS.warning,
    backgroundColor: COLORS.warning + '05',
  },
  creditsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  creditsIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  creditsContent: {
    flex: 1,
  },
  creditsNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  creditsLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  refreshButton: {
    padding: SPACING.sm,
  },
  primaryInfo: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  primaryLabel: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  primaryName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 2,
  },
  primaryExpiry: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  lowCreditsAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    borderRadius: 8,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  lowCreditsText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.warning,
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    gap: SPACING.xs,
  },
  historyButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
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
    marginBottom: SPACING.lg,
  },
  browseButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 12,
  },
  browseButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '600',
  },
  packageGrid: {
    gap: SPACING.md,
  },
  activePackageCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  primaryBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.background,
    letterSpacing: 0.5,
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
  packageCard: {
    marginBottom: SPACING.md,
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
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});

export default PackagesScreen;