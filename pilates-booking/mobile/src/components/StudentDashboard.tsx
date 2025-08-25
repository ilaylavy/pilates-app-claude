import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';
import { apiClient } from '../api/client';
import ProgressRing from './ProgressRing';
import StreakCounter from './StreakCounter';
import MotivationalMessage from './MotivationalMessage';
import AnnouncementBanner, { Announcement } from './AnnouncementBanner';

interface ExtendedUserStats {
  total_bookings: number;
  bookings_this_month: number;
  monthly_goal: number;
  attendance_rate: number;
  member_since: string;
  week_streak: number;
  last_class_date?: string;
  days_since_last_class: number;
}

interface StudentDashboardProps {
  userPackages: any[];
  activePackage?: any;
  reservedPackages?: any[];
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({
  userPackages,
  activePackage,
  reservedPackages,
}) => {
  const [milestoneShown, setMilestoneShown] = useState<number | null>(null);

  const { data: extendedStats } = useQuery<ExtendedUserStats>({
    queryKey: ['user-extended-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/users/me/stats/extended');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ['user-announcements'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/users/me/announcements');
      return response.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Check for milestone celebrations
  React.useEffect(() => {
    if (extendedStats && extendedStats.week_streak > 0) {
      const milestones = [1, 2, 4, 8, 12, 16, 20, 24];
      const currentMilestone = milestones.find(m => m === extendedStats.week_streak);
      
      if (currentMilestone && currentMilestone !== milestoneShown) {
        setMilestoneShown(currentMilestone);
        showMilestoneAlert(currentMilestone);
      }
    }
  }, [extendedStats?.week_streak, milestoneShown]);

  const showMilestoneAlert = (weeks: number) => {
    const messages = {
      1: "Congratulations on completing your first week! 🎉",
      2: "Two weeks in a row - you're building momentum! 🚀",
      4: "One month of consistency - amazing work! ⭐",
      8: "Two months strong - you're a pilates warrior! 💪",
      12: "Three months of dedication - incredible! 🏆",
      16: "Four months streak - you're unstoppable! 🔥",
      20: "Five months - you're a pilates champion! 👑",
      24: "Six months streak - absolutely legendary! 🌟",
    };

    Alert.alert(
      `${weeks} Week${weeks !== 1 ? 's' : ''} Streak! 🎉`,
      messages[weeks as keyof typeof messages] || `${weeks} weeks of consistency - keep it up! 🎯`,
      [{ text: 'Amazing!', style: 'default' }]
    );
  };

  const getCreditsExpiryColor = () => {
    if (!activePackage) return COLORS.textSecondary;
    
    const daysUntilExpiry = activePackage.days_until_expiry;
    if (daysUntilExpiry <= 3) return COLORS.error;
    if (daysUntilExpiry <= 7) return COLORS.warning;
    return COLORS.success;
  };

  const getCreditsExpiryMessage = () => {
    if (!activePackage) return 'No active package';
    
    const daysUntilExpiry = activePackage.days_until_expiry;
    if (daysUntilExpiry <= 0) return 'Expired';
    if (daysUntilExpiry === 1) return 'Expires tomorrow!';
    if (daysUntilExpiry <= 3) return `Expires in ${daysUntilExpiry} days!`;
    if (daysUntilExpiry <= 7) return `${daysUntilExpiry} days left`;
    return `${daysUntilExpiry} days left`;
  };

  const monthlyProgress = extendedStats ? 
    Math.min(extendedStats.bookings_this_month / extendedStats.monthly_goal, 1) : 0;

  const getTimeMessage = () => {
    if (!extendedStats?.days_since_last_class) return null;
    
    const days = extendedStats.days_since_last_class;
    if (days === 0) return "You have a class today! 🎯";
    if (days === 1) return "Your last class was yesterday";
    if (days <= 3) return `${days} days since your last class`;
    if (days <= 7) return `${days} days since your last class - time to book!`;
    return `It's been ${days} days - we miss you! 💙`;
  };

  return (
    <View style={styles.container}>
      {/* Announcements */}
      {announcements && announcements.length > 0 && (
        <AnnouncementBanner announcements={announcements} />
      )}

      {/* Progress Rings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Progress</Text>
        <View style={styles.progressContainer}>
          <ProgressRing
            progress={monthlyProgress}
            value={`${extendedStats?.bookings_this_month || 0}`}
            label={`of ${extendedStats?.monthly_goal || 12} this month`}
            color={COLORS.primary}
            size={100}
          />
          
          <View style={styles.streakContainer}>
            <StreakCounter 
              weekStreak={extendedStats?.week_streak || 0}
              isActive={extendedStats?.week_streak > 0}
            />
          </View>
        </View>
      </View>

      {/* Enhanced Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="card" size={24} color={getCreditsExpiryColor()} />
          <Text style={[styles.statNumber, { color: getCreditsExpiryColor() }]}>
            {activePackage?.credits_remaining || 0}
          </Text>
          <Text style={styles.statLabel}>Credits Left</Text>
          <Text style={[styles.expiryText, { color: getCreditsExpiryColor() }]}>
            {getCreditsExpiryMessage()}
          </Text>
          {reservedPackages && reservedPackages.length > 0 && (
            <View style={styles.pendingIndicator}>
              <Ionicons name="time" size={12} color={COLORS.warning} />
              <Text style={styles.pendingText}>{reservedPackages.length} pending</Text>
            </View>
          )}
        </View>

        {extendedStats && (
          <View style={styles.statCard}>
            <Ionicons name="time" size={24} color={COLORS.secondary} />
            <Text style={styles.statNumber}>
              {extendedStats.days_since_last_class}
            </Text>
            <Text style={styles.statLabel}>
              {extendedStats.days_since_last_class === 1 ? 'Day' : 'Days'} Ago
            </Text>
            <Text style={styles.timeMessage}>
              {getTimeMessage()}
            </Text>
          </View>
        )}
      </View>

      {/* Motivational Message */}
      <MotivationalMessage type="quote" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
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
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streakContainer: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: SPACING.xs,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  expiryText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  timeMessage: {
    fontSize: 10,
    color: COLORS.primary,
    marginTop: SPACING.xs,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  pendingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    backgroundColor: COLORS.warning + '15',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pendingText: {
    fontSize: 10,
    color: COLORS.warning,
    marginLeft: 2,
    fontWeight: '500',
  },
});

export default StudentDashboard;