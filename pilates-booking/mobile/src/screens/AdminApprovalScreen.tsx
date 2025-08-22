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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';
import { packagesApi } from '../api/packages';
import { PendingApproval, PaymentApprovalRequest, PaymentRejectionRequest } from '../types';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import Button from '../components/common/Button';

const AdminApprovalScreen: React.FC = () => {
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approvalData, setApprovalData] = useState<PaymentApprovalRequest>({
    payment_reference: '',
    admin_notes: '',
  });
  const [rejectionData, setRejectionData] = useState<PaymentRejectionRequest>({
    rejection_reason: '',
    admin_notes: '',
  });

  const queryClient = useQueryClient();

  // Queries
  const {
    data: pendingApprovals = [],
    isLoading,
    error,
    refetch,
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

  // Mutations
  const approveMutation = useMutation({
    mutationFn: ({ packageId, data }: { packageId: number; data: PaymentApprovalRequest }) =>
      packagesApi.approvePackage(packageId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      queryClient.invalidateQueries({ queryKey: ['approvalStats'] });
      queryClient.invalidateQueries({ queryKey: ['userPackages'] });
      setShowApproveModal(false);
      setSelectedApproval(null);
      setApprovalData({ payment_reference: '', admin_notes: '' });
      Alert.alert('Success', 'Package payment approved successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to approve payment');
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
      Alert.alert('Success', 'Package payment rejected successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to reject payment');
    },
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
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
      Alert.alert('Error', 'Please provide a rejection reason');
      return;
    }
    
    rejectMutation.mutate({
      packageId: selectedApproval.id,
      data: rejectionData,
    });
  };

  const formatTimeWaiting = (hours: number) => {
    if (hours < 1) return 'Less than 1 hour';
    if (hours < 24) return `${Math.floor(hours)} hours`;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days}d ${remainingHours}h`;
  };

  const getUrgencyColor = (hours: number) => {
    if (hours > 24) return COLORS.error;
    if (hours > 12) return COLORS.warning;
    return COLORS.textSecondary;
  };

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
          <Text style={styles.errorTitle}>Unable to Load Approvals</Text>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : 'Please try again later'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Stats Header */}
      {approvalStats && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{approvalStats.total_pending}</Text>
            <Text style={styles.statLabel}>Total Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{approvalStats.pending_over_24h}</Text>
            <Text style={[styles.statLabel, { color: COLORS.error }]}>Over 24h</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{approvalStats.total_approved_today}</Text>
            <Text style={[styles.statLabel, { color: COLORS.success }]}>Approved Today</Text>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Payment Approvals</Text>
          <Text style={styles.subtitle}>
            Review and approve cash payments from customers
          </Text>
        </View>

        {pendingApprovals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptyText}>
              No pending payment approvals at the moment.
            </Text>
          </View>
        ) : (
          <View style={styles.approvalsContainer}>
            {pendingApprovals.map((approval) => (
              <View key={approval.id} style={styles.approvalCard}>
                <View style={styles.approvalHeader}>
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName}>{approval.user_name}</Text>
                    <Text style={styles.customerEmail}>{approval.user_email}</Text>
                  </View>
                  <View style={styles.timeInfo}>
                    <Text style={[
                      styles.timeWaiting,
                      { color: getUrgencyColor(approval.hours_waiting) }
                    ]}>
                      {formatTimeWaiting(approval.hours_waiting)}
                    </Text>
                    <PaymentStatusBadge status="pending_approval" size="small" />
                  </View>
                </View>

                <View style={styles.packageInfo}>
                  <Text style={styles.packageName}>{approval.package_name}</Text>
                  <View style={styles.packageDetails}>
                    <Text style={styles.packagePrice}>₪{approval.package_price}</Text>
                    <Text style={styles.packageCredits}>{approval.package_credits} credits</Text>
                  </View>
                </View>

                {approval.payment_reference && (
                  <View style={styles.referenceContainer}>
                    <Text style={styles.referenceLabel}>Reference:</Text>
                    <Text style={styles.referenceCode}>{approval.payment_reference}</Text>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => handleReject(approval)}
                  >
                    <Ionicons name="close" size={20} color={COLORS.white} />
                    <Text style={styles.rejectButtonText}>Reject</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleApprove(approval)}
                  >
                    <Ionicons name="checkmark" size={20} color={COLORS.white} />
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.xl,
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    borderRadius: 8,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  rejectButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    borderRadius: 8,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  approveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
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
  modalFooter: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  rejectButtonStyle: {
    backgroundColor: COLORS.error,
  },
});

export default AdminApprovalScreen;