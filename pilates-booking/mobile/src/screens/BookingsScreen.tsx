import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';

import { COLORS, SPACING } from '../utils/config';
import { bookingsApi } from '../api/bookings';
import { useApiErrorHandler } from '../utils/errorMessages';
import { socialApi } from '../api/social';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { StyleUtils } from '../utils/styleUtils';
import { Booking, ClassInstance } from '../types';
import ClassCard from '../components/ClassCard';
import ClassDetailsModal from '../components/ClassDetailsModal';

type TabType = 'upcoming' | 'past' | 'cancelled';

interface FilterOptions {
  instructor?: string;
  classType?: string;
  dateRange?: { start: Date; end: Date };
  withFriendsOnly: boolean;
}

const BookingsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({ withFriendsOnly: false });
  const [selectedClass, setSelectedClass] = useState<ClassInstance | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { handleError } = useApiErrorHandler();
  const { isAuthenticated } = useAuth();
  const { t, rtlText, formatDateTime } = useTranslation();

  // Fetch user bookings
  const {
    data: bookings = [],
    isLoading,
    refetch,
    isRefreshing,
  } = useQuery({
    queryKey: ['user-bookings'],
    queryFn: () => bookingsApi.getUserBookings(),
    enabled: isAuthenticated,
  });

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: (bookingId: number) => bookingsApi.cancelBooking(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['userBookings'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['upcomingClasses'] });
      Alert.alert(t('common.success'), t('booking.cancelled'));
    },
    onError: (error: any) => {
      const { title, message } = handleError(error, 'Failed to cancel booking');
      Alert.alert(title, message);
    },
  });

  // Filter bookings by tab
  const filteredBookings = useMemo(() => {
    let filtered = bookings;

    // Filter by tab
    const now = new Date();
    switch (activeTab) {
      case 'upcoming':
        filtered = bookings.filter(booking => 
          booking.status === 'confirmed' && 
          new Date(booking.class_instance.start_datetime) >= now
        );
        break;
      case 'past':
        filtered = bookings.filter(booking => 
          (booking.status === 'completed' || 
           (booking.status === 'confirmed' && new Date(booking.class_instance.start_datetime) < now))
        );
        break;
      case 'cancelled':
        filtered = bookings.filter(booking => 
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

    // Apply filters
    if (filters.instructor) {
      filtered = filtered.filter(booking =>
        `${booking.class_instance.instructor.first_name} ${booking.class_instance.instructor.last_name}`
          === filters.instructor
      );
    }

    if (filters.classType) {
      filtered = filtered.filter(booking =>
        booking.class_instance.template.name === filters.classType
      );
    }

    // Sort by date (upcoming: earliest first, others: latest first)
    filtered.sort((a, b) => {
      const dateA = new Date(a.class_instance.start_datetime);
      const dateB = new Date(b.class_instance.start_datetime);
      return activeTab === 'upcoming' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    });

    return filtered;
  }, [bookings, activeTab, searchQuery, filters]);

  const handleBookingPress = (booking: Booking) => {
    setSelectedClass(booking.class_instance);
    setDetailsModalVisible(true);
  };

  const handleCancelBooking = (bookingId: number) => {
    // Prevent double cancellation
    if (cancelBookingMutation.isPending) {
      return;
    }
    
    // Find the booking to check if it can still be cancelled
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking || booking.status !== 'confirmed') {
      Alert.alert(t('common.error'), t('errors.generic'));
      return;
    }
    
    Alert.alert(
      t('alerts.cancelBooking'),
      t('alerts.confirmCancelBooking'),
      [
        { text: t('common.no'), style: 'cancel' },
        { 
          text: t('buttons.yesCancel'), 
          style: 'destructive',
          onPress: () => cancelBookingMutation.mutate(bookingId)
        }
      ]
    );
  };


  const formatDateTimeLocal = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: formatDateTime(date),
      time: t('formatTime', { date }),
    };
  };

  const renderTab = (tab: TabType, label: string, count: number) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tab && styles.activeTab]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );

    // Utility function to determine class timing status
  const getClassTimingStatus = (classInstance: any) => {
    const now = new Date();
    const startTime = new Date(classInstance.start_datetime);
    const endTime = new Date(classInstance.end_datetime);
    
    if (now < startTime) {
      return 'future';
    } else if (now >= startTime && now <= endTime) {
      return 'ongoing';
    } else {
      return 'past';
    }
  };

  const renderBookingItem = ({ item }: { item: Booking }) => {
    const timingStatus = getClassTimingStatus(item.class_instance);
    const userParticipated = item.status === 'completed' || item.status === 'confirmed';
    
    return (
      <ClassCard
        classInstance={item.class_instance}
        booking={item}
        variant="list"
        onPress={() => handleBookingPress(item)}
        onCancel={item.status === 'confirmed' && timingStatus === 'future' ? () => handleCancelBooking(item.id) : undefined}
        isBooked={item.status === 'confirmed'}
        availableSpots={item.class_instance.available_spots}
        showActions={true}
        classTimingStatus={timingStatus}
        didUserParticipate={userParticipated}
      />
    );
  };

  const FilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.filterModal}>
        <View style={styles.filterHeader}>
          <Text style={[styles.filterTitle, rtlText()]}>{t('common.filter')}</Text>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Text style={styles.filterDone}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.filterContent}>
          <View style={styles.filterSection}>
            <Text style={[styles.filterSectionTitle, rtlText()]}>{t('common.filter')}</Text>
            
            <TouchableOpacity
              style={styles.filterOption}
              onPress={() => setFilters(prev => ({ ...prev, withFriendsOnly: !prev.withFriendsOnly }))}
            >
              <Text style={[styles.filterOptionText, rtlText()]}>{t('social.friendsAttending')}</Text>
              <Ionicons
                name={filters.withFriendsOnly ? "checkbox" : "checkbox-outline"}
                size={24}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={() => setFilters({ withFriendsOnly: false })}
            >
              <Text style={styles.clearFiltersText}>{t('common.clear')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  // Calculate tab counts
  const upcomingCount = bookings.filter(b => 
    b.status === 'confirmed' && 
    new Date(b.class_instance.start_datetime) >= new Date()
  ).length;
  
  const pastCount = bookings.filter(b => 
    b.status === 'completed' || 
    (b.status === 'confirmed' && new Date(b.class_instance.start_datetime) < new Date())
  ).length;
  
  const cancelledCount = bookings.filter(b => 
    b.status === 'cancelled' || b.status === 'no_show'
  ).length;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, rtlText()]}>{t('status.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, rtlText()]}>{t('bookings.title')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="filter" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('forms.placeholders.searchClasses')}
            textAlign={rtlText().textAlign}
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

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {renderTab('upcoming', t('bookings.upcoming'), upcomingCount)}
        {renderTab('past', t('bookings.past'), pastCount)}
        {renderTab('cancelled', t('classes.cancelled'), cancelledCount)}
      </View>

      {/* Content */}
      <FlatList
        data={filteredBookings}
        renderItem={renderBookingItem}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={COLORS.textSecondary} />
            <Text style={[styles.emptyTitle, { textAlign: 'center' }]}>
              {t('bookings.noBookings')}
            </Text>
            <Text style={[styles.emptySubtitle, { textAlign: 'center' }]}>
              {activeTab === 'upcoming' 
                ? t('classes.book')
                : t('bookings.noBookings')
              }
            </Text>
          </View>
        }
        contentContainerStyle={filteredBookings.length === 0 ? styles.emptyList : styles.listContent}
      />

      <FilterModal />

      <ClassDetailsModal
        visible={detailsModalVisible}
        classInstance={selectedClass}
        onClose={() => {
          setDetailsModalVisible(false);
          setSelectedClass(null);
        }}
        showAdminActions={false}
      />
    </SafeAreaView>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  headerAction: {
    padding: SPACING.xs,
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
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
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  activeTabText: {
    color: COLORS.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  listContent: {
    padding: SPACING.lg,
  },
  filterModal: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  filterDone: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  filterContent: {
    flex: 1,
  },
  filterSection: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  filterOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  filterOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  clearFiltersButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  clearFiltersText: {
    fontSize: 16,
    color: COLORS.error,
    fontWeight: '600',
  },
});

export default BookingsScreen;