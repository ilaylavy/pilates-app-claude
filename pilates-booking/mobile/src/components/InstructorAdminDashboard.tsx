import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';
import { apiClient } from '../api/client';
import { useUserRole } from '../hooks/useUserRole';
import ProgressRing from './ProgressRing';
import MotivationalMessage from './MotivationalMessage';
import AnnouncementBanner, { Announcement } from './AnnouncementBanner';

interface TodaySchedule {
  id: number;
  class_name: string;
  start_time: string;
  end_time: string;
  current_bookings: number;
  capacity: number;
  waitlist_count: number;
  status: 'scheduled' | 'cancelled' | 'completed';
}

interface DashboardMetrics {
  weekly_capacity_utilization: number;
  active_users_count: number;
  active_users_growth: number;
  today_classes: TodaySchedule[];
  waitlist_notifications: Array<{
    class_id: number;
    class_name: string;
    start_time: string;
    waitlist_count: number;
  }>;
}

interface InstructorAdminDashboardProps {
  userRole: 'instructor' | 'admin';
}

const InstructorAdminDashboard: React.FC<InstructorAdminDashboardProps> = ({ userRole }) => {
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [showAnnouncementModal, setShowAnnouncementModal] = React.useState(false);
  const [announcementTitle, setAnnouncementTitle] = React.useState('');
  const [announcementMessage, setAnnouncementMessage] = React.useState('');
  const [announcementType, setAnnouncementType] = React.useState<'info' | 'warning' | 'success' | 'urgent'>('info');

  const { data: dashboardMetrics } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const endpoint = userRole === 'admin' ? '/api/v1/admin/dashboard/metrics' : '/api/v1/instructors/dashboard/metrics';
      const response = await apiClient.get(endpoint);
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ['user-announcements'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/users/me/announcements');
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: extendedStats } = useQuery({
    queryKey: ['user-extended-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/users/me/stats/extended');
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const createAnnouncementMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      message: string;
      type: string;
    }) => {
      const response = await apiClient.post('/api/v1/admin/announcements', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-announcements'] });
      setShowAnnouncementModal(false);
      setAnnouncementTitle('');
      setAnnouncementMessage('');
      Alert.alert('Success', 'Announcement sent to all students!');
    },
    onError: (error: any) => {
      Alert.alert('Error', 'Failed to send announcement. Please try again.');
    },
  });

  const handleSendAnnouncement = () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      Alert.alert('Error', 'Please fill in both title and message.');
      return;
    }

    createAnnouncementMutation.mutate({
      title: announcementTitle.trim(),
      message: announcementMessage.trim(),
      type: announcementType,
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`2024-01-01T${timeString}`).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getCapacityColor = (utilization: number) => {
    if (utilization >= 0.8) return COLORS.success;
    if (utilization >= 0.6) return COLORS.primary;
    if (utilization >= 0.4) return COLORS.warning;
    return COLORS.error;
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return 'trending-up';
    if (growth < 0) return 'trending-down';
    return 'remove';
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return COLORS.success;
    if (growth < 0) return COLORS.error;
    return COLORS.textSecondary;
  };

  return (
    <View style={styles.container}>
      {/* Announcements */}
      {announcements && announcements.length > 0 && (
        <AnnouncementBanner announcements={announcements} />
      )}

      {/* Key Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Studio Overview</Text>
        <View style={styles.metricsContainer}>
          <View style={styles.metricCard}>
            <ProgressRing
              progress={(dashboardMetrics?.weekly_capacity_utilization || 0) / 100}
              value={`${Math.round(dashboardMetrics?.weekly_capacity_utilization || 0)}%`}
              label="Weekly Capacity"
              color={getCapacityColor((dashboardMetrics?.weekly_capacity_utilization || 0) / 100)}
              size={80}
            />
          </View>
          
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="people" size={24} color={COLORS.primary} />
              <Ionicons 
                name={getGrowthIcon(dashboardMetrics?.active_users_growth || 0)} 
                size={16} 
                color={getGrowthColor(dashboardMetrics?.active_users_growth || 0)}
                style={styles.growthIcon}
              />
            </View>
            <Text style={styles.metricNumber}>
              {dashboardMetrics?.active_users_count || 0}
            </Text>
            <Text style={styles.metricLabel}>Active Users</Text>
            {dashboardMetrics?.active_users_growth !== 0 && (
              <Text style={[styles.growthText, { 
                color: getGrowthColor(dashboardMetrics?.active_users_growth || 0) 
              }]}>
                {dashboardMetrics?.active_users_growth > 0 ? '+' : ''}
                {dashboardMetrics?.active_users_growth} this week
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Today's Schedule */}
      {dashboardMetrics?.today_classes && dashboardMetrics.today_classes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Classes</Text>
          {dashboardMetrics.today_classes.map((classItem) => (
            <View key={classItem.id} style={styles.classCard}>
              <View style={styles.classInfo}>
                <Text style={styles.className}>{classItem.class_name}</Text>
                <Text style={styles.classTime}>
                  {formatTime(classItem.start_time)} - {formatTime(classItem.end_time)}
                </Text>
                <Text style={styles.classCapacity}>
                  {classItem.current_bookings}/{classItem.capacity} booked
                  {classItem.waitlist_count > 0 && (
                    <Text style={styles.waitlistText}> • {classItem.waitlist_count} waiting</Text>
                  )}
                </Text>
              </View>
              <View style={styles.capacityIndicator}>
                <View style={[
                  styles.capacityBar,
                  { width: `${(classItem.current_bookings / classItem.capacity) * 100}%` }
                ]} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Waitlist Notifications */}
      {dashboardMetrics?.waitlist_notifications && dashboardMetrics.waitlist_notifications.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Waitlist Alerts</Text>
          {dashboardMetrics.waitlist_notifications.map((notification, index) => (
            <View key={index} style={styles.waitlistAlert}>
              <Ionicons name="people" size={16} color={COLORS.warning} />
              <Text style={styles.waitlistText}>
                {notification.waitlist_count} people waiting for {notification.class_name} 
                at {formatTime(notification.start_time)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Admin Controls */}
      {isAdmin && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.announcementButton}
            onPress={() => setShowAnnouncementModal(true)}
          >
            <Ionicons name="megaphone" size={20} color={COLORS.white} />
            <Text style={styles.announcementButtonText}>Send Announcement</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Personal Progress (for instructors/admins who also attend classes) */}
      {extendedStats && (
        <View style={styles.section}>
          <MotivationalMessage type="tip" />
        </View>
      )}

      {/* Announcement Modal */}
      <Modal
        visible={showAnnouncementModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAnnouncementModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Announcement</Text>
            <TouchableOpacity onPress={handleSendAnnouncement}>
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <TextInput
              style={styles.titleInput}
              placeholder="Announcement title..."
              value={announcementTitle}
              onChangeText={setAnnouncementTitle}
              maxLength={100}
            />
            
            <TextInput
              style={styles.messageInput}
              placeholder="Write your message here..."
              value={announcementMessage}
              onChangeText={setAnnouncementMessage}
              multiline
              textAlignVertical="top"
              maxLength={500}
            />
            
            <View style={styles.typeSelector}>
              <Text style={styles.typeSelectorLabel}>Type:</Text>
              {(['info', 'success', 'warning', 'urgent'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    announcementType === type && styles.typeButtonSelected
                  ]}
                  onPress={() => setAnnouncementType(type)}
                >
                  <Text style={[
                    styles.typeButtonText,
                    announcementType === type && styles.typeButtonTextSelected
                  ]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: SPACING.xs,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  growthIcon: {
    marginLeft: SPACING.xs,
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  growthText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: SPACING.xs,
  },
  classCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
  },
  classInfo: {
    marginBottom: SPACING.sm,
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  classTime: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  classCapacity: {
    fontSize: 12,
    color: COLORS.text,
  },
  waitlistText: {
    color: COLORS.warning,
    fontWeight: '500',
  },
  capacityIndicator: {
    height: 4,
    backgroundColor: COLORS.background,
    borderRadius: 2,
    overflow: 'hidden',
  },
  capacityBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  waitlistAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '15',
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.xs,
  },
  announcementButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: 12,
  },
  announcementButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  sendText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: SPACING.md,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: 16,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: 14,
    height: 120,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  typeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  typeSelectorLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginRight: SPACING.md,
  },
  typeButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.surface,
    marginRight: SPACING.sm,
  },
  typeButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeButtonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  typeButtonTextSelected: {
    color: COLORS.white,
  },
});

export default InstructorAdminDashboard;