import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, SPACING } from '../utils/config';
import { packagesApi } from '../api/packages';
import { adminApi } from '../api/admin';
import { PendingApproval, PaymentApprovalRequest, PaymentRejectionRequest, Package } from '../types';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import EnhancedPackageCard from '../components/packages/EnhancedPackageCard';
import Button from '../components/common/Button';
import { useTranslation } from '../hooks/useTranslation';
import { StyleUtils } from '../utils/styleUtils';

const AdminPackagesScreen: React.FC = () => {
  const { t, pluralize, rtlText, formatCurrency: formatCurrencyI18n } = useTranslation();
  const [currentTab, setCurrentTab] = useState<'approvals' | 'packages'>('approvals');
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCreatePackageModal, setShowCreatePackageModal] = useState(false);
  const [approvalData, setApprovalData] = useState<PaymentApprovalRequest>({
    payment_reference: '',
    admin_notes: '',
  });
  const [rejectionData, setRejectionData] = useState<PaymentRejectionRequest>({
    rejection_reason: '',
    admin_notes: '',
  });
  const [createPackageForm, setCreatePackageForm] = useState({
    name: '',
    description: '',
    price: '',
    credits: '',
    validity_days: '',
    is_unlimited: false,
    is_active: true,
  });

  const queryClient = useQueryClient();

  // Queries for approvals
  const {
    data: pendingApprovals = [],
    isLoading: approvalsLoading,
    error: approvalsError,
    refetch: refetchApprovals,
  } = useQuery({
    queryKey: ['pendingApprovals'],
    queryFn: packagesApi.getPendingApprovals,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const {
    data: approvalStats,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: ['approvalStats'],
    queryFn: packagesApi.getApprovalStats,
    refetchInterval: 30000,
  });

  // Queries for packages
  const { data: availablePackages = [], isLoading: packagesLoading, refetch: refetchPackages } = useQuery({
    queryKey: ['packages', 'all'],
    queryFn: async () => {
      const response = await adminApi.getAllPackages();
      return response;
    },
  });

  // Mutations for approvals
  const approveMutation = useMutation({
    mutationFn: ({ packageId, data }: { packageId: number; data: PaymentApprovalRequest }) =>
      packagesApi.confirmPayment(packageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      queryClient.invalidateQueries({ queryKey: ['approvalStats'] });
      queryClient.invalidateQueries({ queryKey: ['userPackages'] });
      setShowApproveModal(false);
      setSelectedApproval(null);
      setApprovalData({ payment_reference: '', admin_notes: '' });
      Alert.alert(t('common.success'), t('admin.paymentApprovedSuccessfully'));
    },
    onError: (error: any) => {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('admin.paymentApproveFailed'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ packageId, data }: { packageId: number; data: PaymentRejectionRequest }) =>
      packagesApi.rejectPackage(packageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      queryClient.invalidateQueries({ queryKey: ['approvalStats'] });
      queryClient.invalidateQueries({ queryKey: ['userPackages'] });
      setShowRejectModal(false);
      setSelectedApproval(null);
      setRejectionData({ rejection_reason: '', admin_notes: '' });
      Alert.alert(t('common.success'), t('admin.paymentRejectedSuccessfully'));
    },
    onError: (error: any) => {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('admin.paymentRejectFailed'));
    },
  });

  // Mutations for packages
  const createPackageMutation = useMutation({
    mutationFn: (packageData: any) => adminApi.createPackage(packageData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      setShowCreatePackageModal(false);
      resetCreateForm();
      Alert.alert(t('common.success'), t('admin.packageCreatedSuccessfully'));
    },
    onError: (error: any) => {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('admin.packageCreateFailed'));
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: (packageId: number) => adminApi.deletePackage(packageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      Alert.alert(t('common.success'), t('admin.packageDeletedSuccessfully'));
    },
    onError: (error: any) => {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('admin.packageDeleteFailed'));
    },
  });

  const handleRefresh = useCallback(() => {
    if (currentTab === 'approvals') {
      refetchApprovals();
    } else {
      refetchPackages();
    }
  }, [currentTab, refetchApprovals, refetchPackages]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      handleRefresh();
    }, [handleRefresh])
  );

  const handleApprove = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setApprovalData({
      payment_reference: approval.payment_reference || `CASH-${approval.id}-${approval.user_id}`,
      admin_notes: '',
    });
    setShowApproveModal(true);
  };

  const handleReject = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setRejectionData({
      rejection_reason: '',
      admin_notes: '',
    });
    setShowRejectModal(true);
  };

  const handleConfirmApprove = () => {
    if (!selectedApproval) return;
    
    approveMutation.mutate({
      packageId: selectedApproval.id,
      data: approvalData,
    });
  };

  const handleConfirmReject = () => {
    if (!selectedApproval || !rejectionData.rejection_reason.trim()) {
      Alert.alert(t('common.error'), t('admin.rejectionReasonRequired'));
      return;
    }
    
    rejectMutation.mutate({
      packageId: selectedApproval.id,
      data: rejectionData,
    });
  };

  const resetCreateForm = () => {
    setCreatePackageForm({
      name: '',
      description: '',
      price: '',
      credits: '',
      validity_days: '',
      is_unlimited: false,
      is_active: true,
    });
  };

  const handleCreatePackage = () => {
    const { name, description, price, credits, validity_days, is_unlimited, is_active } = createPackageForm;
    
    if (!name.trim() || !price || (!is_unlimited && !credits) || !validity_days) {
      Alert.alert(t('common.error'), t('validation.allFieldsRequired'));
      return;
    }

    const packageData = {
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      credits: is_unlimited ? 0 : parseInt(credits),
      validity_days: parseInt(validity_days),
      is_unlimited,
      is_active,
    };

    createPackageMutation.mutate(packageData);
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

  const formatTimeWaiting = (hours: number) => {
    if (hours < 1) return t('time.lessThanHour');
    if (hours < 24) return pluralize(Math.floor(hours), 'time.hours');
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days}${t('time.dayShort')} ${remainingHours}${t('time.hourShort')}`;
  };

  const getUrgencyColor = (hours: number) => {
    if (hours > 24) return COLORS.error;
    if (hours > 12) return COLORS.warning;
    return COLORS.textSecondary;
  };

  // Render tab header
  const renderTabHeader = () => (
    <View style={styles.tabHeader}>
      <Text style={[styles.headerTitle, rtlText()]}>{t('screens.adminPackages.title')}</Text>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, currentTab === 'approvals' && styles.tabButtonActive]}
          onPress={() => setCurrentTab('approvals')}
        >
          <Ionicons 
            name="checkmark-circle" 
            size={16} 
            color={currentTab === 'approvals' ? COLORS.background : COLORS.textSecondary} 
          />
          <Text style={[
            styles.tabButtonText,
            currentTab === 'approvals' && styles.tabButtonTextActive
          ]}>
            {t('sections.paymentApprovals')}
          </Text>
          {approvalStats && approvalStats.total_pending > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{approvalStats.total_pending}</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, currentTab === 'packages' && styles.tabButtonActive]}
          onPress={() => setCurrentTab('packages')}
        >
          <Ionicons 
            name="cube" 
            size={16} 
            color={currentTab === 'packages' ? COLORS.background : COLORS.textSecondary} 
          />
          <Text style={[
            styles.tabButtonText,
            currentTab === 'packages' && styles.tabButtonTextActive
          ]}>
            {t('packages.title')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render approvals tab
  const renderApprovalsTab = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={approvalsLoading} onRefresh={handleRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Stats Header */}
      {approvalStats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{approvalStats.total_pending}</Text>
            <Text style={styles.statLabel}>{t('stats.totalPending')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{approvalStats.pending_over_24h}</Text>
            <Text style={[styles.statLabel, { color: COLORS.error }]}>{t('stats.over24h')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{approvalStats.total_approved_today}</Text>
            <Text style={[styles.statLabel, { color: COLORS.success }]}>{t('stats.approvedToday')}</Text>
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, rtlText()]}>{t('sections.paymentApprovals')}</Text>
        <Text style={[styles.sectionSubtitle, rtlText()]}>
          {t('admin.reviewApprovePayments')}
        </Text>
      </View>

      {approvalsError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>{t('status.unableToLoad')}</Text>
          <Text style={styles.errorText}>
            {approvalsError instanceof Error ? approvalsError.message : t('errors.tryAgain')}
          </Text>
        </View>
      )}

      {pendingApprovals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyTitle}>{t('status.allCaughtUp')}</Text>
          <Text style={styles.emptyText}>
            {t('admin.noPendingApprovals')}
          </Text>
        </View>
      ) : (
        <View style={styles.approvalsContainer}>
          {pendingApprovals.map((approval) => (
            <View key={approval.id} style={styles.activePackageCard}>
              <View style={styles.activePackageHeader}>
                <View style={styles.activePackageIcon}>
                  <Ionicons 
                    name="time" 
                    size={20} 
                    color={getUrgencyColor(approval.hours_waiting)} 
                  />
                </View>
                <View style={styles.activePackageInfo}>
                  <Text style={styles.activePackageName}>{approval.package_name}</Text>
                  <Text style={styles.activePackageCredits}>
                    {approval.package_credits} credits • ₪{approval.package_price}
                  </Text>
                </View>
                <PaymentStatusBadge 
                  status={approval.payment_status || 'pending_approval'} 
                  size="small" 
                />
              </View>

              {/* Customer info section */}
              <View style={styles.customerSection}>
                <View style={styles.customerRow}>
                  <Ionicons name="person" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.customerName}>{approval.user_name}</Text>
                </View>
                <View style={styles.customerRow}>
                  <Ionicons name="mail" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.customerEmail}>{approval.user_email}</Text>
                </View>
                {approval.payment_reference && (
                  <View style={styles.customerRow}>
                    <Ionicons name="card" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.referenceCode}>{approval.payment_reference}</Text>
                  </View>
                )}
              </View>

              <View style={styles.activePackageFooter}>
                <Text style={[
                  styles.expiryText,
                  { color: getUrgencyColor(approval.hours_waiting) }
                ]}>
                  Waiting: {formatTimeWaiting(approval.hours_waiting)}
                </Text>
                <View style={styles.approvalActions}>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleReject(approval)}
                  >
                    <Ionicons name="close" size={14} color={COLORS.white} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleApprove(approval)}
                  >
                    <Ionicons name="checkmark" size={14} color={COLORS.white} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  // Render packages tab
  const renderPackagesTab = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={packagesLoading} onRefresh={handleRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Package Management</Text>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => setShowCreatePackageModal(true)}
        >
          <Ionicons name="add" size={20} color={COLORS.background} />
          <Text style={styles.createButtonText}>Create Package</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.packagesGrid}>
        {availablePackages.map((pkg) => (
          <View key={pkg.id} style={styles.activePackageCard}>
            <View style={styles.activePackageHeader}>
              <View style={styles.activePackageIcon}>
                <Ionicons 
                  name={pkg.is_unlimited ? "infinite" : "flash"} 
                  size={20} 
                  color={pkg.is_active ? COLORS.primary : COLORS.textSecondary} 
                />
              </View>
              <View style={styles.activePackageInfo}>
                <Text style={styles.activePackageName}>{pkg.name}</Text>
                <Text style={styles.activePackageCredits}>
                  {pkg.is_unlimited ? '∞' : pkg.credits} credits • ₪{pkg.price}
                </Text>
              </View>
              <View style={[styles.statusIndicator, { 
                backgroundColor: pkg.is_active ? COLORS.success : COLORS.error 
              }]} />
            </View>
            
            {pkg.description && (
              <View style={styles.packageDescription}>
                <Text style={styles.descriptionText}>{pkg.description}</Text>
              </View>
            )}
            
            <View style={styles.activePackageFooter}>
              <Text style={styles.purchaseDate}>
                Valid for {pkg.validity_days} days
              </Text>
              <View style={styles.packageActions}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {/* TODO: Add edit functionality */}}
                >
                  <Ionicons name="pencil" size={14} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeletePackage(pkg)}
                >
                  <Ionicons name="trash" size={14} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderTabHeader()}
      
      {currentTab === 'approvals' ? renderApprovalsTab() : renderPackagesTab()}

      {/* Approve Modal */}
      <Modal
        visible={showApproveModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowApproveModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowApproveModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Approve Payment</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedApproval && (
              <>
                <View style={styles.approvalSummary}>
                  <Text style={styles.summaryTitle}>Payment Details</Text>
                  <Text style={styles.summaryItem}>Customer: {selectedApproval.user_name}</Text>
                  <Text style={styles.summaryItem}>Package: {selectedApproval.package_name}</Text>
                  <Text style={styles.summaryItem}>Amount: ₪{selectedApproval.package_price}</Text>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Payment Reference</Text>
                  <TextInput
                    style={styles.textInput}
                    value={approvalData.payment_reference}
                    onChangeText={(text) => setApprovalData({ ...approvalData, payment_reference: text })}
                    placeholder="Enter payment reference"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Admin Notes (Optional)</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={approvalData.admin_notes}
                    onChangeText={(text) => setApprovalData({ ...approvalData, admin_notes: text })}
                    placeholder="Add any notes about this approval"
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              title="Approve Payment"
              onPress={handleConfirmApprove}
              loading={approveMutation.isPending}
              disabled={approveMutation.isPending}
            />
          </View>
        </View>
      </Modal>

      {/* Reject Modal */}
      <Modal
        visible={showRejectModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowRejectModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reject Payment</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedApproval && (
              <>
                <View style={styles.approvalSummary}>
                  <Text style={styles.summaryTitle}>Payment Details</Text>
                  <Text style={styles.summaryItem}>Customer: {selectedApproval.user_name}</Text>
                  <Text style={styles.summaryItem}>Package: {selectedApproval.package_name}</Text>
                  <Text style={styles.summaryItem}>Amount: ₪{selectedApproval.package_price}</Text>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Rejection Reason *</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={rejectionData.rejection_reason}
                    onChangeText={(text) => setRejectionData({ ...rejectionData, rejection_reason: text })}
                    placeholder="Enter reason for rejection (required)"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Admin Notes (Optional)</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={rejectionData.admin_notes}
                    onChangeText={(text) => setRejectionData({ ...rejectionData, admin_notes: text })}
                    placeholder="Add any additional notes"
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              title="Reject Payment"
              onPress={handleConfirmReject}
              loading={rejectMutation.isPending}
              disabled={rejectMutation.isPending || !rejectionData.rejection_reason.trim()}
              style={styles.rejectButtonStyle}
            />
          </View>
        </View>
      </Modal>

      {/* Create Package Modal */}
      <Modal
        visible={showCreatePackageModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreatePackageModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreatePackageModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create New Package</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Package Name *</Text>
              <TextInput
                style={styles.textInput}
                value={createPackageForm.name}
                onChangeText={(text) => setCreatePackageForm({ ...createPackageForm, name: text })}
                placeholder="Enter package name"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={createPackageForm.description}
                onChangeText={(text) => setCreatePackageForm({ ...createPackageForm, description: text })}
                placeholder="Enter package description"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Price (₪) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={createPackageForm.price}
                  onChangeText={(text) => setCreatePackageForm({ ...createPackageForm, price: text })}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Validity Days *</Text>
                <TextInput
                  style={styles.textInput}
                  value={createPackageForm.validity_days}
                  onChangeText={(text) => setCreatePackageForm({ ...createPackageForm, validity_days: text })}
                  placeholder="30"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.switchContainer}>
              <Text style={styles.inputLabel}>Unlimited Package</Text>
              <Switch
                value={createPackageForm.is_unlimited}
                onValueChange={(value) => setCreatePackageForm({ ...createPackageForm, is_unlimited: value })}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={createPackageForm.is_unlimited ? COLORS.background : COLORS.textSecondary}
              />
            </View>

            {!createPackageForm.is_unlimited && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Credits *</Text>
                <TextInput
                  style={styles.textInput}
                  value={createPackageForm.credits}
                  onChangeText={(text) => setCreatePackageForm({ ...createPackageForm, credits: text })}
                  placeholder="10"
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.switchContainer}>
              <Text style={styles.inputLabel}>Active Package</Text>
              <Switch
                value={createPackageForm.is_active}
                onValueChange={(value) => setCreatePackageForm({ ...createPackageForm, is_active: value })}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={createPackageForm.is_active ? COLORS.background : COLORS.textSecondary}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              title="Create Package"
              onPress={handleCreatePackage}
              loading={createPackageMutation.isPending}
              disabled={createPackageMutation.isPending}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabHeader: {
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    gap: SPACING.xs,
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabButtonTextActive: {
    color: COLORS.background,
  },
  badge: {
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.xs,
  },
  badgeText: {
    fontSize: 12,
    color: COLORS.background,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginTop: SPACING.xs,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    gap: SPACING.xs,
  },
  createButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
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
  approvalsContainer: {
    gap: SPACING.md,
  },
  approvalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  approvalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  customerEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  timeInfo: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  timeWaiting: {
    fontSize: 12,
    fontWeight: '600',
  },
  packageInfo: {
    marginBottom: SPACING.md,
  },
  packageName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  packageDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  packageCredits: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  referenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  referenceLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  referenceCode: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    fontFamily: 'monospace',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  rejectButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packagesGrid: {
    gap: SPACING.md,
  },
  packageContainer: {
    marginBottom: SPACING.md,
  },
  packageCard: {
    marginBottom: SPACING.sm,
  },
  packageActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  editButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  placeholder: {
    width: 24,
  },
  modalContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  approvalSummary: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  summaryItem: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    marginBottom: SPACING.lg,
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  textInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  modalFooter: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  rejectButtonStyle: {
    backgroundColor: COLORS.error,
  },
  // Active package card styles (shared for both approvals and packages)
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
  // Customer section for approvals
  customerSection: {
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: SPACING.md,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  // Admin action buttons
  approvalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  // Package status indicator
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  packageDescription: {
    marginBottom: SPACING.md,
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
});

export default AdminPackagesScreen;