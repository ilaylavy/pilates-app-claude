import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { COLORS, SPACING } from '../utils/config';
import { UserListItem, UserPackage, Booking } from '../types';
import { adminApi } from '../api/admin';

interface StudentDetailModalProps {
  visible: boolean;
  student: UserListItem | null;
  onClose: () => void;
}

const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  visible,
  student,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'packages' | 'cancellations'>('overview');

  // Get student's packages
  const {
    data: studentPackages = [],
    isLoading: packagesLoading,
  } = useQuery({
    queryKey: ['adminStudentPackages', student?.id],
    queryFn: () => student ? adminApi.getUserPackages(student.id) : Promise.resolve([]),
    enabled: !!student && visible,
  });

  // Get student's bookings
  const {
    data: studentBookings = [],
    isLoading: bookingsLoading,
  } = useQuery({
    queryKey: ['adminStudentBookings', student?.id],
    queryFn: () => student ? adminApi.getUserBookings(student.id) : Promise.resolve([]),
    enabled: !!student && visible,
  });

  if (!student) {
    return null;
  }

  // Calculate cancellation statistics
  const cancelledBookings = studentBookings.filter(booking => booking.status === 'cancelled');
  const totalBookings = studentBookings.length;
  const cancellationRate = totalBookings > 0 ? (cancelledBookings.length / totalBookings * 100).toFixed(1) : '0';
  
  // Calculate recent cancellations (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCancellations = cancelledBookings.filter(booking => 
    booking.cancellation_date && new Date(booking.cancellation_date) >= thirtyDaysAgo
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'confirmed':
        return COLORS.success;
      case 'expired':
      case 'cancelled':
        return COLORS.error;
      case 'pending_approval':
        return COLORS.warning;
      default:
        return COLORS.textSecondary;
    }
  };

  const renderPackageItem = ({ item }: { item: any }) => (
    <View style={styles.packageCard}>
      <View style={styles.packageHeader}>
        <Text style={styles.packageName}>{item.package_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.packageDetails}>
        <View style={styles.packageStat}>
          <Text style={styles.statLabel}>Credits</Text>
          <Text style={styles.statValue}>{item.credits_remaining}/{item.total_credits}</Text>
        </View>
        <View style={styles.packageStat}>
          <Text style={styles.statLabel}>Expires</Text>
          <Text style={styles.statValue}>{item.expires_at ? formatDate(item.expires_at) : 'Never'}</Text>
        </View>
        <View style={styles.packageStat}>
          <Text style={styles.statLabel}>Price</Text>
          <Text style={styles.statValue}>${item.price}</Text>
        </View>
      </View>
      {item.package_description && (
        <Text style={styles.packageDescription}>{item.package_description}</Text>
      )}
    </View>
  );

  const renderCancellationItem = ({ item }: { item: any }) => (
    <View style={styles.cancellationCard}>
      <View style={styles.cancellationHeader}>
        <Text style={styles.cancellationClass}>{item.class_name}</Text>
        <Text style={styles.cancellationDate}>
          {item.cancelled_at ? formatDate(item.cancelled_at) : 'N/A'}
        </Text>
      </View>
      <View style={styles.cancellationDetails}>
        <View style={styles.cancellationRow}>
          <Ionicons name="calendar" size={16} color={COLORS.textSecondary} />
          <Text style={styles.cancellationText}>
            Original Date: {new Date(item.class_date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.cancellationRow}>
          <Ionicons name="time" size={16} color={COLORS.textSecondary} />
          <Text style={styles.cancellationText}>
            Time: {new Date(item.class_date).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={styles.cancellationRow}>
          <Ionicons name="person" size={16} color={COLORS.textSecondary} />
          <Text style={styles.cancellationText}>
            Instructor: {item.instructor_name}
          </Text>
        </View>
        {item.cancelled_at && (
          <View style={styles.cancellationRow}>
            <Ionicons name="time-outline" size={16} color={COLORS.error} />
            <Text style={styles.cancellationText}>
              Cancelled: {formatDateTime(item.cancelled_at)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderBookingItem = ({ item }: { item: any }) => (
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <Text style={styles.bookingClass}>{item.class_name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.bookingDetails}>
        <View style={styles.bookingRow}>
          <Ionicons name="calendar" size={16} color={COLORS.textSecondary} />
          <Text style={styles.bookingText}>
            {new Date(item.class_date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.bookingRow}>
          <Ionicons name="time" size={16} color={COLORS.textSecondary} />
          <Text style={styles.bookingText}>
            {new Date(item.class_date).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={styles.bookingRow}>
          <Ionicons name="person" size={16} color={COLORS.textSecondary} />
          <Text style={styles.bookingText}>
            {item.instructor_name}
          </Text>
        </View>
        {item.location && (
          <View style={styles.bookingRow}>
            <Ionicons name="location" size={16} color={COLORS.textSecondary} />
            <Text style={styles.bookingText}>
              {item.location}
            </Text>
          </View>
        )}
      </View>
      {item.is_cancelled && (
        <Text style={styles.cancellationReason}>
          Cancelled: {item.cancelled_at ? formatDate(item.cancelled_at) : 'N/A'}
        </Text>
      )}
    </View>
  );

  const renderOverview = () => (
    <View style={styles.overviewContainer}>
      {/* Student Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Student Information</Text>
        <View style={styles.studentInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{student.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role:</Text>
            <Text style={[styles.infoValue, { color: COLORS.primary }]}>
              {student.role.charAt(0).toUpperCase() + student.role.slice(1)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[styles.infoValue, { color: student.is_active ? COLORS.success : COLORS.error }]}>
              {student.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Verified:</Text>
            <Text style={[styles.infoValue, { color: student.is_verified ? COLORS.success : COLORS.warning }]}>
              {student.is_verified ? 'Yes' : 'No'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member Since:</Text>
            <Text style={styles.infoValue}>{formatDate(student.created_at)}</Text>
          </View>
        </View>
      </View>

      {/* Booking & Cancellation Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Booking Statistics</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{student.total_bookings}</Text>
            <Text style={styles.statLabel}>Total{'\n'}Bookings</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: COLORS.error }]}>{cancelledBookings.length}</Text>
            <Text style={styles.statLabel}>Cancellations</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: cancellationRate > 20 ? COLORS.error : cancellationRate > 10 ? COLORS.warning : COLORS.success }]}>
              {cancellationRate}%
            </Text>
            <Text style={styles.statLabel}>Cancel{'\n'}Rate</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{recentCancellations.length}</Text>
            <Text style={styles.statLabel}>Recent{'\n'}Cancels</Text>
          </View>
        </View>
      </View>

      {/* Package & Credits Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Package & Credits</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{student.active_packages}</Text>
            <Text style={styles.statLabel}>Active{'\n'}Packages</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {studentPackages.reduce((sum, pkg) => sum + (pkg.credits_remaining || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Credits{'\n'}Remaining</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {studentPackages.reduce((sum, pkg) => sum + (pkg.total_credits || 0), 0)}
            </Text>
            <Text style={styles.statLabel}>Total{'\n'}Purchased</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {studentPackages.reduce((sum, pkg) => sum + ((pkg.total_credits || 0) - (pkg.credits_remaining || 0)), 0)}
            </Text>
            <Text style={styles.statLabel}>Credits{'\n'}Used</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'packages':
        const recentBookings = studentBookings.slice(0, 5); // Show last 5 bookings
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            {/* Packages Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Packages</Text>
              {packagesLoading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
              ) : studentPackages.length === 0 ? (
                <Text style={styles.emptyText}>No packages found</Text>
              ) : (
                studentPackages.map((item) => (
                  <View key={item.id}>
                    {renderPackageItem({ item })}
                  </View>
                ))
              )}
            </View>
            
            {/* Recent Activity Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              {bookingsLoading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
              ) : recentBookings.length === 0 ? (
                <Text style={styles.emptyText}>No recent bookings</Text>
              ) : (
                recentBookings.map((item) => (
                  <View key={item.id} style={styles.recentBooking}>
                    <Text style={styles.recentBookingTitle}>{item.class_name}</Text>
                    <Text style={styles.recentBookingDate}>
                      {formatDate(item.class_date)} • {item.status}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        );
      case 'cancellations':
        return (
          <View style={styles.tabContent}>
            {bookingsLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
            ) : cancelledBookings.length === 0 ? (
              <Text style={styles.emptyText}>No cancellations found</Text>
            ) : (
              <>
                <View style={styles.cancellationStats}>
                  <Text style={styles.statsTitle}>Cancellation Overview</Text>
                  <View style={styles.statsRow}>
                    <Text style={styles.statsText}>
                      {cancelledBookings.length} of {totalBookings} bookings cancelled ({cancellationRate}%)
                    </Text>
                  </View>
                  <View style={styles.statsRow}>
                    <Text style={styles.statsText}>
                      {recentCancellations.length} cancellations in the last 30 days
                    </Text>
                  </View>
                </View>
                <FlatList
                  data={cancelledBookings}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderCancellationItem}
                  showsVerticalScrollIndicator={false}
                />
              </>
            )}
          </View>
        );
      default:
        return renderOverview();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Student Details</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Student Profile */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {student.avatar_url ? (
              <Image source={{ uri: student.avatar_url }} style={styles.avatarLarge} />
            ) : (
              <View style={styles.avatarLargePlaceholder}>
                <Text style={styles.avatarLargeInitials}>
                  {student.first_name[0]}{student.last_name[0]}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.studentName}>
            {student.first_name} {student.last_name}
          </Text>
          <Text style={styles.studentEmail}>{student.email}</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'packages', label: 'Packages & Activity' },
            { key: 'cancellations', label: 'Cancellations' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderContent()}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  profileSection: {
    backgroundColor: COLORS.white,
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  avatarContainer: {
    marginBottom: SPACING.md,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarLargePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLargeInitials: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  studentName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  overviewContainer: {
    padding: SPACING.lg,
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  studentInfo: {
    gap: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  packageCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  packageName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.white,
  },
  packageDetails: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  packageStat: {
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 2,
  },
  packageDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  bookingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  bookingClass: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  bookingDetails: {
    gap: SPACING.xs,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bookingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  cancellationReason: {
    fontSize: 12,
    color: COLORS.error,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  },
  loader: {
    marginTop: SPACING.xl,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: SPACING.xl,
  },
  // Cancellation styles
  cancellationSummary: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    padding: SPACING.md,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  cancellationCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  cancellationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cancellationClass: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  cancellationDate: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '600',
  },
  cancellationDetails: {
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  cancellationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cancellationText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  reasonContainer: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  cancellationStats: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  statsRow: {
    marginBottom: SPACING.xs,
  },
  statsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  recentBooking: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  recentBookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  recentBookingDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
});

export default StudentDetailModal;