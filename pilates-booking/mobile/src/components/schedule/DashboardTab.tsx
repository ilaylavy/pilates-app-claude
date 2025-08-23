import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../utils/config';
import { classesApi } from '../../api/classes';
import { adminApi } from '../../api/admin';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  subtitle?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, subtitle, trend }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <View style={styles.statHeader}>
      <View style={styles.statInfo}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      </View>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
    </View>
    {trend && (
      <View style={styles.trendContainer}>
        <Ionicons 
          name={trend.positive ? 'trending-up' : 'trending-down'} 
          size={16} 
          color={trend.positive ? COLORS.success : COLORS.error} 
        />
        <Text style={[styles.trendText, { color: trend.positive ? COLORS.success : COLORS.error }]}>
          {trend.value}
        </Text>
      </View>
    )}
  </View>
);

interface QuickActionProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
}

const QuickAction: React.FC<QuickActionProps> = ({ title, icon, color, onPress }) => (
  <TouchableOpacity style={styles.quickAction} onPress={onPress}>
    <View style={[styles.quickActionIcon, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon as any} size={24} color={color} />
    </View>
    <Text style={styles.quickActionTitle}>{title}</Text>
  </TouchableOpacity>
);

const DashboardTab: React.FC = () => {
  // Fetch dashboard stats
  const {
    data: dashboardStats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => adminApi.getDashboardAnalytics(),
  });

  // Fetch upcoming classes
  const {
    data: upcomingClasses = [],
    isLoading: classesLoading,
    refetch: refetchClasses,
  } = useQuery({
    queryKey: ['upcomingClasses'],
    queryFn: () => classesApi.getUpcomingClasses(3),
  });

  // Fetch templates count
  const {
    data: templates = [],
    refetch: refetchTemplates,
  } = useQuery({
    queryKey: ['classTemplates'],
    queryFn: () => classesApi.getTemplates(),
  });

  const isLoading = statsLoading || classesLoading;

  const handleRefresh = async () => {
    await Promise.all([
      refetchStats(),
      refetchClasses(),
      refetchTemplates(),
    ]);
  };

  const quickActions = [
    {
      title: 'Add Class',
      icon: 'add-circle',
      color: COLORS.primary,
      onPress: () => {
        // Navigate to add class or show modal
      },
    },
    {
      title: 'Bulk Create',
      icon: 'copy',
      color: COLORS.secondary,
      onPress: () => {
        // Switch to bulk actions tab
      },
    },
    {
      title: 'Templates',
      icon: 'layers',
      color: COLORS.warning,
      onPress: () => {
        // Switch to templates tab
      },
    },
    {
      title: 'Reports',
      icon: 'analytics',
      color: COLORS.success,
      onPress: () => {
        // Navigate to reports
      },
    },
  ];

  const todayClasses = upcomingClasses.filter(cls => {
    const today = new Date();
    const classDate = new Date(cls.start_datetime);
    return classDate.toDateString() === today.toDateString();
  });

  const tomorrowClasses = upcomingClasses.filter(cls => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const classDate = new Date(cls.start_datetime);
    return classDate.toDateString() === tomorrow.toDateString();
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map((action, index) => (
            <QuickAction
              key={index}
              title={action.title}
              icon={action.icon}
              color={action.color}
              onPress={action.onPress}
            />
          ))}
        </View>
      </View>

      {/* Stats Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="Today's Classes"
            value={todayClasses.length}
            icon="today"
            color={COLORS.primary}
            subtitle={`${todayClasses.reduce((sum, cls) => sum + (cls.participant_count || 0), 0)} participants`}
          />
          <StatCard
            title="Tomorrow's Classes"
            value={tomorrowClasses.length}
            icon="calendar"
            color={COLORS.secondary}
            subtitle={`${tomorrowClasses.reduce((sum, cls) => sum + (cls.participant_count || 0), 0)} participants`}
          />
          <StatCard
            title="Active Templates"
            value={templates.filter(t => t.is_active).length}
            icon="layers"
            color={COLORS.warning}
            subtitle={`${templates.length} total`}
          />
          <StatCard
            title="This Week"
            value={upcomingClasses.length}
            icon="trending-up"
            color={COLORS.success}
            subtitle="upcoming classes"
          />
        </View>
      </View>

      {/* Today's Schedule */}
      {todayClasses.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Classes</Text>
            <TouchableOpacity>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.classesContainer}>
            {todayClasses.slice(0, 3).map((classInstance) => (
              <TouchableOpacity key={classInstance.id} style={styles.classCard}>
                <View style={styles.classTime}>
                  <Text style={styles.classTimeText}>
                    {new Date(classInstance.start_datetime).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </Text>
                </View>
                <View style={styles.classInfo}>
                  <Text style={styles.className}>{classInstance.template?.name}</Text>
                  <Text style={styles.classInstructor}>
                    {classInstance.instructor?.first_name} {classInstance.instructor?.last_name}
                  </Text>
                </View>
                <View style={styles.classStats}>
                  <Text style={styles.classCapacity}>
                    {classInstance.participant_count || 0}/{(classInstance.participant_count || 0) + (classInstance.available_spots || 0)}
                  </Text>
                  <View style={[
                    styles.statusDot,
                    {
                      backgroundColor: classInstance.is_full 
                        ? COLORS.error 
                        : (classInstance.participant_count || 0) > ((classInstance.participant_count || 0) + (classInstance.available_spots || 0)) * 0.8 
                          ? COLORS.warning 
                          : COLORS.success
                    }
                  ]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityContainer}>
          <Text style={styles.noActivity}>Activity tracking coming soon...</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  section: {
    marginBottom: SPACING.xl,
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
    marginBottom: SPACING.md,
  },
  viewAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  quickAction: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  statsGrid: {
    gap: SPACING.md,
  },
  statCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statInfo: {
    flex: 1,
  },
  statTitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  statSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  classesContainer: {
    gap: SPACING.sm,
  },
  classCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  classTime: {
    marginRight: SPACING.md,
    minWidth: 70,
  },
  classTimeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  classInstructor: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  classStats: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  classCapacity: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noActivity: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
});

export default DashboardTab;