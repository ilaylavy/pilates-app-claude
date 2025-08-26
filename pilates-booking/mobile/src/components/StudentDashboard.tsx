import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, API_ENDPOINTS } from '../utils/config';
import { apiClient } from '../api/client';
import ProgressRing from './ProgressRing';
import StreakCounter from './StreakCounter';
import MotivationalMessage from './MotivationalMessage';
import AnnouncementBanner, { Announcement } from './AnnouncementBanner';
import { useTranslation } from '../hooks/useTranslation';

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
  const { t, pluralize, rtlText } = useTranslation();

  const { data: extendedStats } = useQuery<ExtendedUserStats>({
    queryKey: ['user-extended-stats'],
    queryFn: async () => {
      const response = await apiClient.get(API_ENDPOINTS.USERS.STATS_EXTENDED);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ['user-announcements'],
    queryFn: async () => {
      const response = await apiClient.get(API_ENDPOINTS.USERS.ANNOUNCEMENTS);
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
      1: t('milestones.week1'),
      2: t('milestones.week2'),
      4: t('milestones.month1'),
      8: t('milestones.month2'),
      12: t('milestones.month3'),
      16: t('milestones.month3'), // Fallback to month3
      20: t('milestones.month3'), // Fallback to month3  
      24: t('milestones.month3'), // Fallback to month3
    };

    Alert.alert(
      `${t('time.week', { count: weeks })} ${t('streak.title')} 🎉`,
      messages[weeks as keyof typeof messages] || `${t('time.week', { count: weeks })} - ${t('motivational.quotes.consistency')}`,
      [{ text: t('common.success'), style: 'default' }]
    );
  };

  // Calculate total credits from all active packages (same as packages screen)
  const activeUserPackages = userPackages.filter(pkg => pkg.is_valid);
  const totalCredits = activeUserPackages.reduce((sum, pkg) => sum + (pkg.credits_remaining || 0), 0);
  const hasUnlimited = activeUserPackages.some(pkg => pkg.package?.is_unlimited);

  const getCreditsExpiryColor = () => {
    if (activeUserPackages.length === 0) return COLORS.textSecondary;
    if (totalCredits <= 2 && !hasUnlimited) return COLORS.warning;
    if (totalCredits === 0 && !hasUnlimited) return COLORS.error;
    
    // Check earliest expiry among active packages
    const earliestExpiry = Math.min(...activeUserPackages.map(pkg => pkg.days_until_expiry || 0));
    if (earliestExpiry <= 3) return COLORS.error;
    if (earliestExpiry <= 7) return COLORS.warning;
    return COLORS.success;
  };

  const getCreditsExpiryMessage = () => {
    if (activeUserPackages.length === 0) return t('progress.noActivePackage');
    
    // Find the package expiring soonest
    const earliestExpiryPackage = activeUserPackages.reduce((earliest, current) => 
      (current.days_until_expiry || 0) < (earliest.days_until_expiry || 0) ? current : earliest
    );
    
    const daysUntilExpiry = earliestExpiryPackage?.days_until_expiry || 0;
    if (daysUntilExpiry <= 0) return t('progress.expired');
    if (daysUntilExpiry === 1) return t('progress.expiresTomorrow');
    if (daysUntilExpiry <= 3) return pluralize(daysUntilExpiry, 'progress.expiresInDays');
    if (daysUntilExpiry <= 7) return pluralize(daysUntilExpiry, 'progress.daysLeft');
    return pluralize(daysUntilExpiry, 'progress.daysLeft');
  };

  const monthlyProgress = extendedStats ? 
    Math.min(extendedStats.bookings_this_month / extendedStats.monthly_goal, 1) : 0;

  const getTimeMessage = () => {
    if (!extendedStats?.days_since_last_class) return null;
    
    const days = extendedStats.days_since_last_class;
    if (days === 0) return t('progress.classToday');
    if (days === 1) return t('progress.lastClassYesterday');
    if (days <= 3) return pluralize(days, 'progress.daysSinceLastClass');
    if (days <= 7) return pluralize(days, 'progress.timeToBook');
    return pluralize(days, 'progress.missYou');
  };

  return (
    <View style={styles.container}>
      {/* Announcements */}
      {announcements && announcements.length > 0 && (
        <AnnouncementBanner announcements={announcements} />
      )}

      {/* Progress Rings Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, rtlText()]}>{t('sections.yourProgress')}</Text>
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
            {hasUnlimited ? '∞' : totalCredits}
          </Text>
          <Text style={[styles.statLabel, { textAlign: 'center' }]}>{t('stats.creditsAvailable')}</Text>
          <Text style={[styles.expiryText, { color: getCreditsExpiryColor() }]}>
            {getCreditsExpiryMessage()}
          </Text>
          {reservedPackages && reservedPackages.length > 0 && (
            <View style={styles.pendingIndicator}>
              <Ionicons name="time" size={12} color={COLORS.warning} />
              <Text style={styles.pendingText}>{reservedPackages.length} {t('stats.pending')}</Text>
            </View>
          )}
        </View>

        {extendedStats && (
          <View style={styles.statCard}>
            <Ionicons name="time" size={24} color={COLORS.secondary} />
            <Text style={styles.statNumber}>
              {extendedStats.days_since_last_class}
            </Text>
            <Text style={[styles.statLabel, { textAlign: 'center' }]}>
              {extendedStats.days_since_last_class === 1 ? t('stats.dayAgo') : t('stats.daysAgo')}
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