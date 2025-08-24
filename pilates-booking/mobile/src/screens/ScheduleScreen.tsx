import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Animated,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/Navigation';
import { COLORS, SPACING } from '../utils/config';
import ClassCard from '../components/ClassCard';
import CalendarView from '../components/CalendarView';
import ClassDetailsModal from '../components/ClassDetailsModal';
import BookingConfirmationModal from '../components/BookingConfirmationModal';
import EditClassModal from '../components/schedule/EditClassModal';
import QuickAddClassModal from '../components/schedule/QuickAddClassModal';
import FloatingActionButton from '../components/FloatingActionButton';
import { ClassCardSkeleton } from '../components/SkeletonLoader';
import { useUserRole } from '../hooks/useUserRole';
import { useAuth } from '../hooks/useAuth';
import { useCancelBooking } from '../hooks/useBookings';
import { classesApi } from '../api/classes';
import { bookingsApi } from '../api/bookings';
import { packagesApi } from '../api/packages';
import { getFriendlyErrorMessage, getErrorAlertTitle } from '../utils/errorMessages';
import { ClassInstance } from '../types';

type ScheduleScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Main'>;

const ScheduleScreen: React.FC = () => {
  const navigation = useNavigation<ScheduleScreenNavigationProp>();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showCalendarView, setShowCalendarView] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassInstance | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [filterInstructor, setFilterInstructor] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [completedBooking, setCompletedBooking] = useState<any>(null);
  const [bookedClassInstance, setBookedClassInstance] = useState<ClassInstance | null>(null);
  const [bookingInProgressId, setBookingInProgressId] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const { isAdmin, isStudent } = useUserRole();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const slideAnimation = useRef(new Animated.Value(0)).current;

  // Get start of current week (Monday)
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const weekStart = getWeekStart(currentWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const formatWeekRange = () => {
    const start = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  };

  // Fetch classes for current week
  const {
    data: classes = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['classes', 'week', weekStart.toISOString().split('T')[0]],
    queryFn: () => classesApi.getWeekClasses(weekStart.toISOString().split('T')[0]),
    enabled: isAuthenticated,
  });

  // Fetch user bookings to show booking status
  const { data: userBookings = [] } = useQuery({
    queryKey: ['userBookings'],
    queryFn: () => bookingsApi.getUserBookings(),
    enabled: isAuthenticated,
  });

  // Fetch user packages to check credit availability
  const { data: userPackagesResponse } = useQuery({
    queryKey: ['userPackages'],
    queryFn: () => packagesApi.getUserPackages(),
    enabled: isAuthenticated && isStudent,
  });

  // Flatten all packages into a single array for backwards compatibility
  const userPackages = userPackagesResponse 
    ? [...userPackagesResponse.active_packages, ...userPackagesResponse.pending_packages, ...userPackagesResponse.historical_packages]
    : [];

  // Create a set of booked class IDs for quick lookup
  const bookedClassIds = React.useMemo(() => {
    return new Set(
      userBookings?.filter(booking => booking.status === 'confirmed')
        .map(booking => booking.class_instance_id) || []
    );
  }, [userBookings]);

  const activePackage = userPackages?.find(pkg => pkg.is_valid);

  // Cancel booking mutation with immediate updates after server confirmation
  const cancelBookingMutation = useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: number; reason?: string }) =>
      bookingsApi.cancelBooking(bookingId, reason),
    onMutate: async ({ bookingId }: { bookingId: number }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['userBookings'] });
      
      // Snapshot the previous value for error rollback
      const previousBookings = queryClient.getQueryData(['userBookings']);
      
      return { previousBookings, bookingId };
    },
    onSuccess: (result, { bookingId }) => {
      // Immediately remove cancelled booking from cache after server confirms
      queryClient.setQueryData(['userBookings'], (oldBookings: any[]) => {
        if (!oldBookings) return [];
        return oldBookings.filter(booking => booking.id !== bookingId);
      });
      
      // Force immediate credit update by invalidating userPackages with forced refetch
      queryClient.invalidateQueries({ 
        queryKey: ['userPackages'],
        refetchType: 'all' 
      });
      
      // Invalidate all related queries to refetch updated data from server
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['classes'] });
        queryClient.invalidateQueries({ queryKey: ['userBookings'] });
        queryClient.invalidateQueries({ queryKey: ['user-bookings'] });
        queryClient.invalidateQueries({ queryKey: ['upcomingClasses'] });
        // Force another userPackages refetch after delay to catch any delayed server updates
        queryClient.invalidateQueries({ 
          queryKey: ['userPackages'],
          refetchType: 'all' 
        });
      }, 300);
    },
    onError: (error: any, variables, context) => {
      // Revert optimistic update
      if (context?.previousBookings) {
        queryClient.setQueryData(['userBookings'], context.previousBookings);
      }
      
      const errorMessage = error.message || 'Failed to cancel booking';
      const friendlyMessage = getFriendlyErrorMessage(errorMessage);
      const alertTitle = getErrorAlertTitle(errorMessage);
      Alert.alert(alertTitle, friendlyMessage);
    },
  });

  // Book class mutation
  const bookClassMutation = useMutation({
    mutationFn: async (classInstanceId: number) => {
      const result = await bookingsApi.bookClass(classInstanceId, activePackage?.id);
      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
    onMutate: async (classInstanceId) => {
      setBookingInProgressId(classInstanceId);
      
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['userBookings'] });
      
      // Snapshot the previous value
      const previousBookings = queryClient.getQueryData(['userBookings']);
      
      return { previousBookings, classInstanceId };
    },
    onSuccess: (result, classInstanceId) => {
      setBookingInProgressId(null);
      
      // Only update if booking was successful and we have real booking data
      if (result.success && result.booking) {
        // Immediately update cache with real booking data from server
        queryClient.setQueryData(['userBookings'], (oldBookings: any[]) => {
          if (!oldBookings) return [result.booking];
          // Make sure we don't duplicate bookings
          const filtered = oldBookings.filter(booking => 
            booking.class_instance_id !== classInstanceId
          );
          return [...filtered, result.booking];
        });
      }
      
      // Force immediate credit update by invalidating userPackages with forced refetch
      queryClient.invalidateQueries({ 
        queryKey: ['userPackages'],
        refetchType: 'all' 
      });
      
      // Invalidate all related queries to refetch updated data from server
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['classes'] });
        queryClient.invalidateQueries({ queryKey: ['userBookings'] });
        queryClient.invalidateQueries({ queryKey: ['user-bookings'] });
        queryClient.invalidateQueries({ queryKey: ['upcomingClasses'] });
        // Force another userPackages refetch after delay to catch any delayed server updates
        queryClient.invalidateQueries({ 
          queryKey: ['userPackages'],
          refetchType: 'all' 
        });
      }, 300);
      
      // Show booking confirmation modal for successful bookings
      if (result.booking && result.success) {
        // Find the class instance to show in the modal
        const classInstance = classes?.find(cls => cls.id === classInstanceId);
        if (classInstance) {
          setCompletedBooking(result.booking);
          setBookedClassInstance(classInstance);
          setShowBookingModal(true);
        }
      }
    },
    onError: (error: any, classInstanceId, context) => {
      setBookingInProgressId(null);
      
      // Revert optimistic update if any
      if (context?.previousBookings) {
        queryClient.setQueryData(['userBookings'], context.previousBookings);
      }
      
      const errorMessage = error.message || 'Failed to book class';
      const friendlyMessage = getFriendlyErrorMessage(errorMessage);
      const alertTitle = getErrorAlertTitle(errorMessage);
      Alert.alert(alertTitle, friendlyMessage);
    },
  });

  // Join waitlist mutation
  const joinWaitlistMutation = useMutation({
    mutationFn: async (classInstanceId: number) => {
      const result = await bookingsApi.joinWaitlist(classInstanceId);
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.waitlist_entry;
    },
    onMutate: (classInstanceId) => {
      setBookingInProgressId(classInstanceId);
    },
    onSuccess: (result, classInstanceId) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['userBookings'] });
      setBookingInProgressId(null);
      Alert.alert('Success', 'Added to waitlist successfully!');
    },
    onError: (error: any, classInstanceId) => {
      setBookingInProgressId(null);
      const errorMessage = error.message || 'Failed to join waitlist';
      const friendlyMessage = getFriendlyErrorMessage(errorMessage);
      const alertTitle = getErrorAlertTitle(errorMessage);
      Alert.alert(alertTitle, friendlyMessage);
    },
  });

  const handlePreviousWeek = () => {
    Animated.timing(slideAnimation, {
      toValue: -1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      const prevWeek = new Date(currentWeek);
      prevWeek.setDate(currentWeek.getDate() - 7);
      setCurrentWeek(prevWeek);
      slideAnimation.setValue(1);
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNextWeek = () => {
    Animated.timing(slideAnimation, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      const nextWeek = new Date(currentWeek);
      nextWeek.setDate(currentWeek.getDate() + 7);
      setCurrentWeek(nextWeek);
      slideAnimation.setValue(-1);
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleClassPress = (classInstance: ClassInstance) => {
    setSelectedClass(classInstance);
    setDetailsModalVisible(true);
  };

  const handleEditClass = (classInstance: ClassInstance) => {
    setSelectedClass(classInstance);
    setDetailsModalVisible(false);
    setShowEditModal(true);
  };

  // Booking action handlers
  const handleBookClass = (classInstance: ClassInstance) => {
    // Check if user has available credits first
    if (isStudent && !activePackage?.credits_remaining) {
      Alert.alert(
        'No Credits Available',
        'You need to purchase a package or top up your credits to book this class.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Buy Package', onPress: () => {
            // Navigate to packages screen - you might need to adjust navigation
            console.log('Navigate to packages');
          }}
        ]
      );
      return;
    }

    bookClassMutation.mutate(classInstance.id);
  };

  const handleJoinWaitlist = (classInstance: ClassInstance) => {
    joinWaitlistMutation.mutate(classInstance.id);
  };

  const handleCancelBooking = (classInstance: ClassInstance) => {
    const userBooking = userBookings?.find(
      booking => booking.class_instance_id === classInstance.id && booking.status === 'confirmed'
    );
    
    if (!userBooking) return;
    
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel your booking for this class?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            cancelBookingMutation.mutate({
              bookingId: userBooking.id,
              reason: 'User cancelled'
            });
          }
        }
      ]
    );
  };


  const handleDeleteClass = (classInstance: ClassInstance) => {
    Alert.alert(
      'Delete Class',
      'Are you sure you want to delete this class? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await classesApi.deleteClass(classInstance.id);
              queryClient.invalidateQueries({ queryKey: ['classes'] });
              Alert.alert('Success', 'Class deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete class');
            }
          }
        }
      ]
    );
  };

  const handleAddClass = () => {
    setShowQuickAdd(true);
  };

  const handleManageTemplates = () => {
    Alert.alert('Templates', 'Template management will be available in the next update!');
  };

  const handleBulkOperations = () => {
    Alert.alert('Bulk Operations', 'Bulk operations will be available in the next update!');
  };

  const filterClasses = (classes: ClassInstance[]) => {
    let filtered = classes;
    
    if (filterLevel) {
      filtered = filtered.filter(cls => cls.template.level === filterLevel);
    }
    
    if (filterInstructor) {
      filtered = filtered.filter(cls => 
        `${cls.instructor.first_name} ${cls.instructor.last_name}`.toLowerCase()
        .includes(filterInstructor.toLowerCase())
      );
    }
    
    return filtered;
  };

  const getUniqueInstructors = (classes: ClassInstance[]) => {
    const instructors = new Set<string>();
    classes.forEach(cls => {
      instructors.add(`${cls.instructor.first_name} ${cls.instructor.last_name}`);
    });
    return Array.from(instructors).sort();
  };

  const getUniqueLevels = (classes: ClassInstance[]) => {
    const levels = new Set<string>();
    classes.forEach(cls => {
      levels.add(cls.template.level);
    });
    return Array.from(levels).sort();
  };

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={COLORS.error} />
          <Text style={styles.errorText}>Failed to load classes</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.weekNavigation}>
          <TouchableOpacity onPress={handlePreviousWeek} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          
          <Animated.View 
            style={[
              styles.weekInfo,
              {
                transform: [
                  {
                    translateX: slideAnimation.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [-50, 0, 50],
                    }),
                  },
                ],
                opacity: slideAnimation.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [0.5, 1, 0.5],
                }),
              },
            ]}
          >
            <Text style={styles.weekTitle}>Week of</Text>
            <Text style={styles.weekRange}>{formatWeekRange()}</Text>
          </Animated.View>
          
          <TouchableOpacity onPress={handleNextWeek} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setShowCalendarView(!showCalendarView)}
            style={[styles.toggleButton, showCalendarView && styles.toggleButtonActive]}
          >
            <Ionicons 
              name={showCalendarView ? "list" : "calendar"} 
              size={20} 
              color={showCalendarView ? COLORS.white : COLORS.primary} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={[styles.toggleButton, showFilters && styles.toggleButtonActive]}
          >
            <Ionicons 
              name="filter" 
              size={20} 
              color={showFilters ? COLORS.white : COLORS.primary} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      {showFilters && !showCalendarView && (
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
            <TouchableOpacity
              style={[styles.filterChip, !filterLevel && styles.filterChipActive]}
              onPress={() => setFilterLevel(null)}
            >
              <Text style={[styles.filterChipText, !filterLevel && styles.filterChipTextActive]}>All Levels</Text>
            </TouchableOpacity>
            
            {getUniqueLevels(classes).map(level => (
              <TouchableOpacity
                key={level}
                style={[styles.filterChip, filterLevel === level && styles.filterChipActive]}
                onPress={() => setFilterLevel(filterLevel === level ? null : level)}
              >
                <Text style={[styles.filterChipText, filterLevel === level && styles.filterChipTextActive]}>
                  {level.charAt(0).toUpperCase() + level.slice(1).replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
            
            <View style={styles.filterDivider} />
            
            <TouchableOpacity
              style={[styles.filterChip, !filterInstructor && styles.filterChipActive]}
              onPress={() => setFilterInstructor(null)}
            >
              <Text style={[styles.filterChipText, !filterInstructor && styles.filterChipTextActive]}>All Instructors</Text>
            </TouchableOpacity>
            
            {getUniqueInstructors(classes).map(instructor => (
              <TouchableOpacity
                key={instructor}
                style={[styles.filterChip, filterInstructor === instructor && styles.filterChipActive]}
                onPress={() => setFilterInstructor(filterInstructor === instructor ? null : instructor)}
              >
                <Text style={[styles.filterChipText, filterInstructor === instructor && styles.filterChipTextActive]}>
                  {instructor}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      {showCalendarView ? (
        <CalendarView
          onClassPress={handleClassPress}
          onEditClass={handleEditClass}
          onDeleteClass={handleDeleteClass}
          onBook={handleBookClass}
          onJoinWaitlist={handleJoinWaitlist}
          onCancel={handleCancelBooking}
          bookedClassIds={bookedClassIds}
          hasAvailableCredits={!!activePackage && (activePackage.credits_remaining > 0 || activePackage.package.is_unlimited)}
          isBookingInProgress={(classId) => bookingInProgressId === classId}
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
          }
        >
          {isLoading ? (
            <View style={styles.skeletonContainer}>
              <ClassCardSkeleton />
              <ClassCardSkeleton />
              <ClassCardSkeleton />
            </View>
          ) : filterClasses(classes).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {classes.length === 0 
                  ? "No classes scheduled for this week"
                  : "No classes match your filters"
                }
              </Text>
              {isAdmin && classes.length === 0 && (
                <TouchableOpacity onPress={handleAddClass} style={styles.addFirstClassButton}>
                  <Text style={styles.addFirstClassButtonText}>Add First Class</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {/* Group classes by day */}
              {(() => {
                const filteredClasses = filterClasses(classes);
                const groupedClasses = filteredClasses.reduce((groups: { [key: string]: ClassInstance[] }, classInstance) => {
                  const date = new Date(classInstance.start_datetime).toDateString();
                  if (!groups[date]) {
                    groups[date] = [];
                  }
                  groups[date].push(classInstance);
                  return groups;
                }, {});

                return Object.entries(groupedClasses)
                  .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                  .map(([date, dayClasses]) => (
                    <View key={date} style={styles.daySection}>
                      <Text style={styles.dayHeader}>
                        {new Date(date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </Text>
                      {dayClasses
                        .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
                        .map((classInstance) => (
                          <ClassCard
                            key={classInstance.id}
                            classInstance={classInstance}
                            variant="list"
                            isBooked={bookedClassIds.has(classInstance.id)}
                            availableSpots={classInstance.available_spots}
                            showActions={isStudent}
                            hasAvailableCredits={!!activePackage && (activePackage.credits_remaining > 0 || activePackage.package.is_unlimited)}
                            isBookingInProgress={bookingInProgressId === classInstance.id}
                            onPress={() => {
                              setSelectedClass(classInstance);
                              setDetailsModalVisible(true);
                            }}
                            onEdit={() => handleEditClass(classInstance)}
                            onDelete={() => handleDeleteClass(classInstance)}
                            onBook={() => handleBookClass(classInstance)}
                            onJoinWaitlist={() => handleJoinWaitlist(classInstance)}
                            onCancel={() => handleCancelBooking(classInstance)}
                          />
                        ))
                      }
                    </View>
                  ));
              })()}
            </>
          )}
        </ScrollView>
      )}
      
      {/* Class Details Modal */}
      <ClassDetailsModal
        visible={detailsModalVisible}
        classInstance={selectedClass}
        onClose={() => {
          setDetailsModalVisible(false);
          setSelectedClass(null);
        }}
        onEdit={() => {
          setDetailsModalVisible(false);
          if (selectedClass) {
            handleEditClass(selectedClass);
          }
        }}
        onDelete={() => {
          setDetailsModalVisible(false);
          if (selectedClass) {
            handleDeleteClass(selectedClass);
          }
        }}
        onBookingSuccess={(booking, classInstance) => {
          setCompletedBooking(booking);
          setBookedClassInstance(classInstance);
          setShowBookingModal(true);
        }}
      />


      {/* Booking Confirmation Modal */}
      {completedBooking && bookedClassInstance && (
        <BookingConfirmationModal
          visible={showBookingModal}
          onClose={() => {
            setShowBookingModal(false);
            setCompletedBooking(null);
            setBookedClassInstance(null);
          }}
          booking={completedBooking}
          classInstance={bookedClassInstance}
          onViewSchedule={() => {
            setShowBookingModal(false);
            setCompletedBooking(null);
            setBookedClassInstance(null);
          }}
        />
      )}

      {/* Edit Class Modal */}
      {selectedClass && (
        <EditClassModal
          visible={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedClass(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedClass(null);
            handleRefresh();
          }}
          classInstance={selectedClass}
        />
      )}

      {/* Quick Add Class Modal */}
      <QuickAddClassModal
        visible={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSuccess={() => {
          setShowQuickAdd(false);
          handleRefresh();
        }}
      />

      {/* Floating Action Button (Admin Only) */}
      {isAdmin && !showCalendarView && (
        <FloatingActionButton
          onAddClass={handleAddClass}
          onManageTemplates={handleManageTemplates}
          onBatchOperations={handleBulkOperations}
          onCopyClass={() => Alert.alert('Copy Class', 'Feature coming soon!')}
          onCreateRecurring={() => Alert.alert('Recurring Class', 'Feature coming soon!')}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  navButton: {
    padding: SPACING.xs,
  },
  weekInfo: {
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  weekRange: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  toggleButton: {
    padding: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.sm,
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  daySection: {
    marginBottom: SPACING.lg,
  },
  dayHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
    paddingLeft: SPACING.sm,
  },
  filtersContainer: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    paddingVertical: SPACING.sm,
  },
  filtersContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  filterDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.lightGray,
    alignSelf: 'center',
    marginHorizontal: SPACING.sm,
  },
  skeletonContainer: {
    paddingVertical: SPACING.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  addFirstClassButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 8,
  },
  addFirstClassButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  errorText: {
    fontSize: 18,
    color: COLORS.error,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ScheduleScreen;