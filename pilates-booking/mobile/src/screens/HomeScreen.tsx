import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/Navigation';

import { useAuth } from '../hooks/useAuth';
import { classesApi } from '../api/classes';
import { bookingsApi } from '../api/bookings';
import { packagesApi } from '../api/packages';
import { COLORS, SPACING } from '../utils/config';
import { ClassInstance, Booking, UserPackage } from '../types';

const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const {
    data: upcomingClasses,
    isLoading: classesLoading,
    refetch: refetchClasses,
  } = useQuery({
    queryKey: ['upcomingClasses'],
    queryFn: () => classesApi.getUpcomingClasses(3), // Next 3 days
  });

  const {
    data: userBookings,
    isLoading: bookingsLoading,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: ['userBookings'],
    queryFn: () => bookingsApi.getUserBookings(),
  });

  const {
    data: userPackages,
    isLoading: packagesLoading,
    refetch: refetchPackages,
  } = useQuery({
    queryKey: ['userPackages'],
    queryFn: () => packagesApi.getUserPackages(),
  });

  const isLoading = classesLoading || bookingsLoading || packagesLoading;

  const onRefresh = async () => {
    await Promise.all([
      refetchClasses(),
      refetchBookings(),
      refetchPackages(),
    ]);
  };

  const activePackage = userPackages?.find(pkg => pkg.is_valid);
  const nextBooking = userBookings?.[0];

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Hello, {user?.first_name}!</Text>
          <Text style={styles.subtitle}>Welcome to your pilates journey</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="card" size={24} color={COLORS.primary} />
            <Text style={styles.statNumber}>
              {activePackage?.credits_remaining || 0}
            </Text>
            <Text style={styles.statLabel}>Credits Left</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="calendar" size={24} color={COLORS.secondary} />
            <Text style={styles.statNumber}>
              {userBookings?.length || 0}
            </Text>
            <Text style={styles.statLabel}>Upcoming Classes</Text>
          </View>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => navigation.navigate('Packages' as never)}
          >
            <Ionicons name="add-circle" size={24} color={COLORS.success} />
            <Text style={styles.statNumber}>+</Text>
            <Text style={styles.statLabel}>Buy Credits</Text>
          </TouchableOpacity>
        </View>

        {/* Next Class */}
        {nextBooking && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Class</Text>
            <TouchableOpacity
              style={styles.nextClassCard}
              onPress={() =>
                navigation.navigate('ClassDetails', {
                  classId: nextBooking.class_instance.id,
                })
              }
            >
              <View style={styles.nextClassInfo}>
                <Text style={styles.nextClassName}>
                  {nextBooking.class_instance.template.name}
                </Text>
                <Text style={styles.nextClassInstructor}>
                  with {nextBooking.class_instance.instructor.first_name}{' '}
                  {nextBooking.class_instance.instructor.last_name}
                </Text>
                <View style={styles.nextClassTime}>
                  <Ionicons name="time" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.nextClassTimeText}>
                    {formatDateTime(nextBooking.class_instance.start_datetime).date}{' '}
                    at {formatDateTime(nextBooking.class_instance.start_datetime).time}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Upcoming Classes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Classes</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Schedule' as never)}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {upcomingClasses?.slice(0, 3).map((classInstance: ClassInstance) => (
            <TouchableOpacity
              key={classInstance.id}
              style={styles.classCard}
              onPress={() =>
                navigation.navigate('ClassDetails', {
                  classId: classInstance.id,
                })
              }
            >
              <View style={styles.classCardContent}>
                <View style={styles.classInfo}>
                  <Text style={styles.className}>{classInstance.template.name}</Text>
                  <Text style={styles.classInstructor}>
                    {classInstance.instructor.first_name} {classInstance.instructor.last_name}
                  </Text>
                  <View style={styles.classDetails}>
                    <View style={styles.classDetailItem}>
                      <Ionicons name="time" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.classDetailText}>
                        {formatDateTime(classInstance.start_datetime).time}
                      </Text>
                    </View>
                    <View style={styles.classDetailItem}>
                      <Ionicons name="people" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.classDetailText}>
                        {classInstance.available_spots} spots left
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.classActions}>
                  {classInstance.is_full ? (
                    <Text style={styles.fullText}>Full</Text>
                  ) : (
                    <Ionicons name="add-circle" size={24} color={COLORS.primary} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Package Status */}
        {activePackage && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Package</Text>
            <View style={styles.packageCard}>
              <View style={styles.packageInfo}>
                <Text style={styles.packageName}>{activePackage.package.name}</Text>
                <Text style={styles.packageCredits}>
                  {activePackage.credits_remaining} credits remaining
                </Text>
                <Text style={styles.packageExpiry}>
                  Expires in {activePackage.days_until_expiry} days
                </Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Packages' as never)}>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
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
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  nextClassCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextClassInfo: {
    flex: 1,
  },
  nextClassName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  nextClassInstructor: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  nextClassTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextClassTimeText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  classCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
  },
  classCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginBottom: SPACING.xs,
  },
  classDetails: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  classDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classDetailText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  classActions: {
    alignItems: 'center',
  },
  fullText: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '600',
  },
  packageCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  packageCredits: {
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  packageExpiry: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

export default HomeScreen;