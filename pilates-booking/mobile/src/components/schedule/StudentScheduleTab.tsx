import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  FlatList,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING } from '../../utils/config';
import { classesApi } from '../../api/classes';
import { bookingsApi } from '../../api/bookings';
import { packagesApi } from '../../api/packages';
import { getFriendlyErrorMessage, getErrorAlertTitle } from '../../utils/errorMessages';
import { ClassInstance, Booking } from '../../types';
import ClassCard from '../ClassCard';
import ClassDetailsModal from '../ClassDetailsModal';
import BookingConfirmationModal from '../BookingConfirmationModal';
import { useAuth } from '../../hooks/useAuth';

type ViewMode = 'week' | 'month';
type ScheduleMode = 'schedule' | 'bookings';

const StudentScheduleTab: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('schedule');
  const [selectedClass, setSelectedClass] = useState<ClassInstance | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [bookingInProgressId, setBookingInProgressId] = useState<number | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);
  const [bookedClassInstance, setBookedClassInstance] = useState<ClassInstance | null>(null);
  
  // Bookings-specific state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBookingTab, setActiveBookingTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  
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

  // Fetch classes for current week
  const {
    data: classes = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['student-classes', 'week', weekStart.toISOString().split('T')[0]],
    queryFn: () => classesApi.getWeekClasses(weekStart.toISOString().split('T')[0]),
  });

  // Fetch month classes for month view
  const { data: monthClasses = [], isLoading: monthLoading } = useQuery({
    queryKey: ['student-classes', 'month', currentMonth.getFullYear(), currentMonth.getMonth() + 1],
    queryFn: () => classesApi.getMonthClasses(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
    enabled: viewMode === 'month',
  });

  // Get user's bookings to check if they have a booking for classes
  const {
    data: userBookings = [],
    isLoading: bookingsLoading,
    refetch: refetchBookings,
  } = useQuery({
    queryKey: ['userBookings'],
    queryFn: () => bookingsApi.getUserBookings(true),
    enabled: isAuthenticated,
  });

  // Get detailed user bookings for bookings view
  const {
    data: detailedBookings = [],
    isLoading: detailedBookingsLoading,
    refetch: refetchDetailedBookings,
  } = useQuery({
    queryKey: ['user-bookings'],
    queryFn: () => bookingsApi.getUserBookings(),
    enabled: isAuthenticated && scheduleMode === 'bookings',
  });

  // Get user packages to check credit availability
  const {
    data: userPackagesResponse,
  } = useQuery({
    queryKey: ['userPackages'],
    queryFn: () => packagesApi.getUserPackages(),
    enabled: isAuthenticated,
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

  // Filter bookings for bookings view
  const filteredBookings = useMemo(() => {
    if (scheduleMode !== 'bookings') return [];
    
    let filtered = detailedBookings;

    // Filter by tab
    const now = new Date();
    switch (activeBookingTab) {
      case 'upcoming':
        filtered = detailedBookings.filter(booking => 
          booking.status === 'confirmed' && 
          new Date(booking.class_instance.start_datetime) >= now
        );
        break;
      case 'past':
        filtered = detailedBookings.filter(booking => 
          (booking.status === 'completed' || 
           (booking.status === 'confirmed' && new Date(booking.class_instance.start_datetime) < now))
        );
        break;
      case 'cancelled':
        filtered = detailedBookings.filter(booking => 
          booking.status === 'cancelled' || booking.status === 'no_show'
        );
        break;
    }

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(booking =>
        booking.class_instance.template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `${booking.class_instance.instructor.first_name} ${booking.class_instance.instructor.last_name}`
          .toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort by date (upcoming: earliest first, others: latest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.class_instance.start_datetime);
      const dateB = new Date(b.class_instance.start_datetime);
      return activeBookingTab === 'upcoming' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    });

    return filtered;
  }, [detailedBookings, activeBookingTab, searchQuery, scheduleMode]);

  // Calculate booking tab counts
  const bookingTabCounts = useMemo(() => {
    if (scheduleMode !== 'bookings') return { upcoming: 0, past: 0, cancelled: 0 };
    
    const now = new Date();
    return {
      upcoming: detailedBookings.filter(b => 
        b.status === 'confirmed' && 
        new Date(b.class_instance.start_datetime) >= now
      ).length,
      past: detailedBookings.filter(b => 
        b.status === 'completed' || 
        (b.status === 'confirmed' && new Date(b.class_instance.start_datetime) < now)
      ).length,
      cancelled: detailedBookings.filter(b => 
        b.status === 'cancelled' || b.status === 'no_show'
      ).length,
    };
  }, [detailedBookings, scheduleMode]);

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
      
      // Immediately update detailed bookings cache if in bookings mode
      if (scheduleMode === 'bookings') {
        queryClient.setQueryData(['user-bookings'], (oldBookings: any[]) => {
          if (!oldBookings) return [];
          return oldBookings.filter(booking => booking.id !== bookingId);
        });
      }

      // Force immediate credit update by invalidating userPackages with forced refetch
      queryClient.invalidateQueries({ 
        queryKey: ['userPackages'],
        refetchType: 'all' 
      });
      
      // Invalidate all related queries to refetch updated data from server
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['student-classes'] });
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
        queryClient.invalidateQueries({ queryKey: ['student-classes'] });
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
      queryClient.invalidateQueries({ queryKey: ['student-classes'] });
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

  // Booking action handlers
  const handleBookClass = (classInstance: ClassInstance) => {
    // Check if user has available credits first
    if (!activePackage || (activePackage.credits_remaining <= 0 && !activePackage.package.is_unlimited)) {
      Alert.alert(
        'No Credits Available',
        'You need to purchase a package or top up your credits to book this class.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Buy Package', onPress: () => {
            // TODO: Navigate to packages screen - would need navigation prop
            Alert.alert('Navigate to Packages', 'This would navigate to the packages screen in a full implementation');
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

  const handleCancelBooking = (classInstanceOrBookingId: ClassInstance | number) => {
    let userBooking: Booking | undefined;
    
    if (typeof classInstanceOrBookingId === 'number') {
      // Called from bookings view with booking ID
      userBooking = detailedBookings?.find(booking => booking.id === classInstanceOrBookingId);
    } else {
      // Called from schedule view with class instance
      userBooking = userBookings?.find(
        booking => booking.class_instance_id === classInstanceOrBookingId.id && booking.status === 'confirmed'
      );
    }
    
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
              bookingId: userBooking!.id,
              reason: 'User cancelled'
            });
          }
        }
      ]
    );
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newDate);
  };

  const formatWeekRange = () => {
    const start = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  };

  const getDaysOfWeek = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      day.setHours(0, 0, 0, 0);
      days.push(day);
    }
    return days;
  };

  const getClassesForDay = (date: Date) => {
    return classes.filter(cls => {
      const classDate = new Date(cls.start_datetime);
      return classDate.toDateString() === date.toDateString();
    });
  };

  const handleClassPress = (classInstance: ClassInstance) => {
    setSelectedClass(classInstance);
    setShowDetailsModal(true);
  };

  const handleBookingPress = (booking: Booking) => {
    setSelectedClass(booking.class_instance);
    setShowDetailsModal(true);
  };

  const handleMonthDayPress = (day: Date) => {
    // Switch to week view and navigate to the week containing this day
    setViewMode('week');
    setCurrentWeek(day);
  };

  const renderScheduleModeToggle = () => (
    <View style={styles.scheduleModeContainer}>
      {(['schedule', 'bookings'] as ScheduleMode[]).map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[styles.scheduleModeButton, scheduleMode === mode && styles.activeScheduleMode]}
          onPress={() => {
            setScheduleMode(mode);
            // Reset search when switching modes
            setSearchQuery('');
          }}
        >
          <Ionicons
            name={mode === 'schedule' ? 'calendar' : 'list'}
            size={18}
            color={scheduleMode === mode ? COLORS.white : COLORS.textSecondary}
          />
          <Text style={[styles.scheduleModeText, scheduleMode === mode && styles.activeScheduleModeText]}>
            {mode === 'schedule' ? 'Schedule' : 'My Bookings'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderBookingsTabs = () => (
    <View style={styles.bookingTabContainer}>
      {(['upcoming', 'past', 'cancelled'] as const).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.bookingTab, activeBookingTab === tab && styles.activeBookingTab]}
          onPress={() => setActiveBookingTab(tab)}
        >
          <Text style={[styles.bookingTabText, activeBookingTab === tab && styles.activeBookingTabText]}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({bookingTabCounts[tab]})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputContainer}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search classes or instructors..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderBookingsView = () => {
    const isLoading = detailedBookingsLoading;
    const refetch = refetchDetailedBookings;

    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your bookings...</Text>
        </View>
      );
    }

    return (
      <FlatList
        data={filteredBookings}
        renderItem={({ item }) => (
          <ClassCard
            classInstance={item.class_instance}
            booking={item}
            variant="list"
            onPress={() => handleBookingPress(item)}
            onCancel={item.status === 'confirmed' ? () => handleCancelBooking(item.id) : undefined}
            isBooked={item.status === 'confirmed'}
            availableSpots={item.class_instance.available_spots}
            showActions={true}
          />
        )}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyBookingsContainer}>
            <Ionicons name="calendar-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyBookingsTitle}>
              No {activeBookingTab === 'upcoming' ? 'upcoming' : activeBookingTab} bookings
            </Text>
            <Text style={styles.emptyBookingsSubtitle}>
              {activeBookingTab === 'upcoming' 
                ? 'Book a class to see it here'
                : `You don't have any ${activeBookingTab} bookings`
              }
            </Text>
          </View>
        }
        contentContainerStyle={filteredBookings.length === 0 ? styles.emptyBookingsList : styles.bookingsListContent}
      />
    );
  };

  const renderViewModeToggle = () => (
    <View style={styles.viewModeContainer}>
      {(['week', 'month'] as ViewMode[]).map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[styles.viewModeButton, viewMode === mode && styles.activeViewMode]}
          onPress={() => setViewMode(mode)}
        >
          <Ionicons
            name={mode === 'week' ? 'calendar' : 'grid'}
            size={18}
            color={viewMode === mode ? COLORS.white : COLORS.textSecondary}
          />
          <Text style={[styles.viewModeText, viewMode === mode && styles.activeViewModeText]}>
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderWeekHeader = () => (
    <View style={styles.weekHeader}>
      <TouchableOpacity style={styles.navButton} onPress={() => navigateWeek('prev')}>
        <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
      </TouchableOpacity>
      
      <View style={styles.weekInfo}>
        <Text style={styles.weekRange}>{formatWeekRange()}</Text>
        <Text style={styles.weekYear}>{weekStart.getFullYear()}</Text>
      </View>
      
      <TouchableOpacity style={styles.navButton} onPress={() => navigateWeek('next')}>
        <Ionicons name="chevron-forward" size={24} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderMonthHeader = () => (
    <View style={styles.weekHeader}>
      <TouchableOpacity style={styles.navButton} onPress={() => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() - 1);
        setCurrentMonth(newDate);
      }}>
        <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
      </TouchableOpacity>
      
      <View style={styles.weekInfo}>
        <Text style={styles.weekRange}>
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
      </View>
      
      <TouchableOpacity style={styles.navButton} onPress={() => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() + 1);
        setCurrentMonth(newDate);
      }}>
        <Ionicons name="chevron-forward" size={24} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderWeekView = () => {
    const daysOfWeek = getDaysOfWeek();
    
    return (
      <ScrollView 
        style={styles.weekView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        {daysOfWeek.map((day, index) => {
          const dayClasses = getClassesForDay(day);
          const isToday = day.toDateString() === new Date().toDateString();
          
          return (
            <View key={index} style={[styles.dayContainer]}>
              <View style={[styles.dayHeader, isToday && styles.todayHeader]}>
                <View style={styles.dayInfo}>
                  <Text style={[styles.dayName, isToday && styles.todayText]}>
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayDate, isToday && styles.todayText]}>
                    {day.getDate()}
                  </Text>
                </View>
                <View style={styles.dayActions}>
                  <Text style={styles.dayClassCount}>
                    {dayClasses.length} {dayClasses.length === 1 ? 'class' : 'classes'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.dayClasses}>
                {dayClasses.length === 0 ? (
                  <View style={styles.emptyDay}>
                    <Text style={styles.emptyDayText}>No classes</Text>
                  </View>
                ) : (
                  dayClasses.map((classInstance) => (
                    <ClassCard
                      key={classInstance.id}
                      classInstance={classInstance}
                      isBooked={bookedClassIds.has(classInstance.id)}
                      availableSpots={classInstance.available_spots}
                      showActions={true}
                      hasAvailableCredits={!!activePackage && (activePackage.credits_remaining > 0 || activePackage.package.is_unlimited)}
                      isBookingInProgress={bookingInProgressId === classInstance.id}
                      onPress={() => handleClassPress(classInstance)}
                      onBook={() => handleBookClass(classInstance)}
                      onJoinWaitlist={() => handleJoinWaitlist(classInstance)}
                    />
                  ))
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderMonthView = () => {
    const getDaysInMonth = () => {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const daysInMonth = lastDay.getDate();
      const startingDayOfWeek = firstDay.getDay();

      const days = [];
      
      // Add empty cells for days before the first day of the month
      for (let i = 0; i < startingDayOfWeek; i++) {
        days.push(null);
      }
      
      // Add all days of the month
      for (let day = 1; day <= daysInMonth; day++) {
        days.push(new Date(year, month, day));
      }
      
      return days;
    };

    const getClassesForDay = (date: Date | null) => {
      if (!date) return [];
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      return monthClasses.filter(classInstance => {
        const classDate = new Date(classInstance.start_datetime);
        const classDay = new Date(classDate.getFullYear(), classDate.getMonth(), classDate.getDate());
        
        // Only show classes for today and future dates
        return classDate.toDateString() === date.toDateString() && classDay >= today;
      });
    };

    const days = getDaysInMonth();
    const today = new Date();

    return (
      <View style={styles.monthView}>
        <View style={styles.monthDaysHeader}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <Text key={day} style={styles.monthDayHeaderText}>{day}</Text>
          ))}
        </View>

        <ScrollView style={styles.monthCalendar} showsVerticalScrollIndicator={false}>
          <View style={styles.monthGrid}>
            {days.map((date, index) => {
              const dayClasses = getClassesForDay(date);
              const isToday = date && date.toDateString() === today.toDateString();
              const isEmpty = !date;

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.monthDay,
                    isEmpty && styles.emptyMonthDay,
                    isToday && styles.todayMonthDay,
                  ]}
                  onPress={() => {
                    if (date) {
                      handleMonthDayPress(date);
                    }
                  }}
                  disabled={isEmpty}
                >
                  {date && (
                    <>
                      <Text style={[
                        styles.monthDayNumber,
                        isToday && styles.todayMonthDayNumber,
                      ]}>
                        {date.getDate()}
                      </Text>
                      
                      <View style={styles.monthDayClasses}>
                        {dayClasses.slice(0, 3).map((classInstance, classIndex) => (
                          <View
                            key={classInstance.id}
                            style={[
                              styles.monthClassDot,
                              {
                                backgroundColor: classInstance.is_full 
                                  ? COLORS.error 
                                  : COLORS.primary
                              }
                            ]}
                          />
                        ))}
                        {dayClasses.length > 3 && (
                          <Text style={styles.monthClassMore}>+{dayClasses.length - 3}</Text>
                        )}
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {monthLoading && (
          <View style={styles.monthLoadingOverlay}>
            <Text style={styles.loadingText}>Loading classes...</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Controls */}
      <View style={styles.header}>
        {/* Schedule Mode Toggle */}
        {renderScheduleModeToggle()}
        
        {scheduleMode === 'schedule' ? (
          <>
            {viewMode === 'week' ? renderWeekHeader() : renderMonthHeader()}
            {renderViewModeToggle()}
          </>
        ) : (
          <>
            {renderSearchBar()}
            {renderBookingsTabs()}
          </>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {scheduleMode === 'bookings' ? (
          renderBookingsView()
        ) : error ? (
          <View style={styles.errorState}>
            <Ionicons name="warning" size={48} color={COLORS.error} />
            <Text style={styles.errorText}>Failed to load classes</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : viewMode === 'week' ? (
          renderWeekView()
        ) : (
          renderMonthView()
        )}
      </View>

      {/* Class Details Modal */}
      {selectedClass && (
        <ClassDetailsModal
          visible={showDetailsModal}
          classInstance={selectedClass}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedClass(null);
          }}
          showAdminActions={false}
          onBookingSuccess={(booking, classInstance) => {
            setCompletedBooking(booking);
            setBookedClassInstance(classInstance);
            setShowBookingModal(true);
          }}
        />
      )}

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.md,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  navButton: {
    padding: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.primary + '10',
  },
  weekInfo: {
    alignItems: 'center',
  },
  weekRange: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  weekYear: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  viewModeContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    gap: SPACING.xs,
  },
  activeViewMode: {
    backgroundColor: COLORS.primary,
  },
  viewModeText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  activeViewModeText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  weekView: {
    flex: 1,
  },
  dayContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  dayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  dayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  todayHeader: {
    backgroundColor: COLORS.primary + '10',
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    minWidth: 50,
  },
  dayDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
  },
  dayClassCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  todayText: {
    color: COLORS.primary,
  },
  dayClasses: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  emptyDay: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  emptyDayText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  classItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  classTime: {
    marginRight: SPACING.md,
    minWidth: 70,
  },
  classTimeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  classInfo: {
    flex: 1,
  },
  classTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  classInstructor: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  classCapacity: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  capacityText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  capacityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  retryButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  retryText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  
  // Month View Styles
  monthView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  monthDaysHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  monthDayHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  monthCalendar: {
    flex: 1,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.xs,
  },
  monthDay: {
    width: '14.28%',
    aspectRatio: 1,
    padding: SPACING.xs,
    justifyContent: 'flex-start',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    position: 'relative',
  },
  emptyMonthDay: {
    backgroundColor: COLORS.background,
    borderColor: 'transparent',
  },
  todayMonthDay: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
  },
  monthDayNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  todayMonthDayNumber: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  monthDayClasses: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthClassDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
  },
  monthClassMore: {
    fontSize: 8,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  monthLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background + '80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // Schedule Mode Toggle Styles
  scheduleModeContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  scheduleModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    gap: SPACING.xs,
    flex: 1,
    justifyContent: 'center',
  },
  activeScheduleMode: {
    backgroundColor: COLORS.primary,
  },
  scheduleModeText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  activeScheduleModeText: {
    color: COLORS.white,
    fontWeight: '600',
  },

  // Search Bar Styles
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },

  // Booking Tabs Styles
  bookingTabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bookingTab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeBookingTab: {
    borderBottomColor: COLORS.primary,
  },
  bookingTabText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  activeBookingTabText: {
    color: COLORS.primary,
  },

  // Bookings View Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBookingsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyBookingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptyBookingsSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyBookingsList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  bookingsListContent: {
    padding: SPACING.lg,
  },
});

export default StudentScheduleTab;