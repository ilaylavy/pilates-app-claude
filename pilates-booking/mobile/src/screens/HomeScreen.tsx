import React, { useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
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
import ClassCard from '../components/ClassCard';
import ClassDetailsModal from '../components/ClassDetailsModal';

const HomeScreen: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [selectedClass, setSelectedClass] = useState<ClassInstance | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const previousReservedPackageIdsRef = React.useRef<number[]>([]);

  const {
    data: upcomingClasses,
    isLoading: classesLoading,
    refetch: refetchClasses,
  } = useQuery({
    queryKey: ['upcomingClasses'],
    queryFn: () => classesApi.getUpcomingClasses(7), // Next 7 days to get more classes
    enabled: isAuthenticated,
  });

  const {
    data: userBookings,
    isLoading: bookingsLoading,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: ['userBookings'],
    queryFn: () => bookingsApi.getUserBookings(true), // Include past bookings for accurate count
    enabled: isAuthenticated,
  });

  // Create a set of booked class IDs for quick lookup
  const bookedClassIds = new Set(
    userBookings?.filter(booking => booking.status === 'confirmed')
      .map(booking => booking.class_instance_id) || []
  );

  const {
    data: userPackages,
    isLoading: packagesLoading,
    refetch: refetchPackages,
  } = useQuery({
    queryKey: ['userPackages'],
    queryFn: () => packagesApi.getUserPackages(),
    staleTime: 30000, // Cache for 30 seconds only for packages due to cash payment updates
    enabled: isAuthenticated,
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
  const reservedPackages = userPackages?.filter(pkg => pkg.status === 'reserved');
  
  // Detect when reserved packages become active and show notification
  React.useEffect(() => {
    if (userPackages) {
      const currentReservedIds = reservedPackages?.map(pkg => pkg.id) || [];
      const previousReservedIds = previousReservedPackageIdsRef.current;
      
      // Check if any previously reserved packages are now active
      if (previousReservedIds.length > 0) {
        const nowActivePackages = userPackages.filter(pkg => 
          previousReservedIds.includes(pkg.id) && 
          pkg.status === 'active' && 
          pkg.is_valid
        );
        
        if (nowActivePackages.length > 0) {
          const totalCredits = nowActivePackages.reduce((sum, pkg) => sum + pkg.credits_remaining, 0);
          Alert.alert(
            'Package Activated! 🎉',
            `Your cash payment has been confirmed. ${totalCredits} credits are now available for booking classes.`,
            [{ text: 'Great!', style: 'default' }]
          );
        }
      }
      
      // Update ref with current reserved IDs
      previousReservedPackageIdsRef.current = currentReservedIds;
    }
  }, [userPackages, reservedPackages]);

  // Poll for package updates when there are reserved packages
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (reservedPackages && reservedPackages.length > 0) {
      // Poll every 10 seconds when there are reserved packages
      interval = setInterval(() => {
        refetchPackages();
      }, 10000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [reservedPackages?.length, refetchPackages]);
  
  // Get next confirmed upcoming booking
  const upcomingBookings = userBookings?.filter(booking => 
    booking.status === 'confirmed' && 
    new Date(booking.class_instance.start_datetime) > new Date()
  ).sort((a, b) => 
    new Date(a.class_instance.start_datetime).getTime() - new Date(b.class_instance.start_datetime).getTime()
  );
  const nextBooking = upcomingBookings?.[0];

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
            {reservedPackages && reservedPackages.length > 0 && (
              <View style={styles.pendingIndicator}>
                <Ionicons name="time" size={12} color={COLORS.warning} />
                <Text style={styles.pendingText}>{reservedPackages.length} pending</Text>
              </View>
            )}
          </View>

          <View style={styles.statCard}>
            <Ionicons name="calendar" size={24} color={COLORS.secondary} />
            <Text style={styles.statNumber}>
              {upcomingBookings?.length || 0}
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
              onPress={() => {
                setSelectedClass(nextBooking.class_instance);
                setDetailsModalVisible(true);
              }}
            >
              <View style={styles.nextClassInfo}>
                <Text style={styles.nextClassName}>
                  {nextBooking.class_instance?.template?.name || 'Unknown Class'}
                </Text>
                <Text style={styles.nextClassInstructor}>
                  with {nextBooking.class_instance?.instructor?.first_name || 'Unknown'}{' '}
                  {nextBooking.class_instance?.instructor?.last_name || 'Instructor'}
                </Text>
                <View style={styles.nextClassTime}>
                  <Ionicons name="time" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.nextClassTimeText}>
                    {formatDateTime(nextBooking.class_instance?.start_datetime || new Date().toISOString()).date}{' '}
                    at {formatDateTime(nextBooking.class_instance?.start_datetime || new Date().toISOString()).time}
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
            <ClassCard
              key={classInstance.id}
              classInstance={classInstance}
              variant="list"
              isBooked={bookedClassIds.has(classInstance.id)}
              availableSpots={classInstance.available_spots}
              showActions={false}
              onPress={() => {
                setSelectedClass(classInstance);
                setDetailsModalVisible(true);
              }}
            />
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

      <ClassDetailsModal
        visible={detailsModalVisible}
        classInstance={selectedClass}
        onClose={() => {
          setDetailsModalVisible(false);
          setSelectedClass(null);
        }}
      />
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