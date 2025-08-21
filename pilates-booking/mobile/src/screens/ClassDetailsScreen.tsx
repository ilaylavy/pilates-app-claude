import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/Navigation';

import { COLORS, SPACING } from '../utils/config';
import { useUserRole } from '../hooks/useUserRole';
import { classesApi, ParticipantResponse } from '../api/classes';
import { bookingsApi } from '../api/bookings';
import { socialApi, Attendee } from '../api/social';
import AttendeeAvatars from '../components/AttendeeAvatars';
import BookingConfirmationModal from '../components/BookingConfirmationModal';

type ClassDetailsScreenRouteProp = RouteProp<RootStackParamList, 'ClassDetails'>;

const ClassDetailsScreen: React.FC = () => {
  const [showParticipants, setShowParticipants] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [completedBooking, setCompletedBooking] = useState(null);
  const { isAdmin, isInstructor, isStudent } = useUserRole();
  const queryClient = useQueryClient();
  const route = useRoute<ClassDetailsScreenRouteProp>();
  const navigation = useNavigation();
  const { classId } = route.params;

  // Fetch class details
  const {
    data: classInstance,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['class', classId],
    queryFn: () => classesApi.getClassById(classId),
  });

  // Fetch participants for this class (for admin/instructor)
  const {
    data: participants = [],
    isLoading: participantsLoading,
  } = useQuery({
    queryKey: ['participants', classId],
    queryFn: () => classesApi.getClassParticipants(classId),
    enabled: !!classInstance && (isAdmin || isInstructor),
  });

  // Fetch attendees for social features (for all users)
  const {
    data: attendees = [],
    isLoading: attendeesLoading,
  } = useQuery({
    queryKey: ['attendees', classId],
    queryFn: () => socialApi.getClassAttendees(classId),
    enabled: !!classInstance,
  });

  // Fetch friends in class
  const {
    data: friendsInClass = [],
  } = useQuery({
    queryKey: ['friends-in-class', classId],
    queryFn: () => socialApi.getFriendsInClass(classId),
    enabled: !!classInstance && isStudent,
  });

  // Book class mutation
  const bookClassMutation = useMutation({
    mutationFn: async () => {
      const result = await bookingsApi.bookClass(classId);
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.booking;
    },
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['attendees', classId] });
      setCompletedBooking(booking);
      setShowBookingModal(true);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to book class');
    },
  });

  // Join waitlist mutation
  const joinWaitlistMutation = useMutation({
    mutationFn: async () => {
      const result = await bookingsApi.joinWaitlist(classId);
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.waitlist_entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['attendees', classId] });
      Alert.alert('Success', 'Added to waitlist successfully!');
      navigation.goBack();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to join waitlist');
    },
  });

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    };
  };

  const handleBookClass = () => {
    if (!classInstance) return;
    
    if (classInstance.is_full) {
      Alert.alert(
        'Join Waitlist',
        'This class is full. Would you like to join the waitlist?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Join Waitlist', onPress: () => joinWaitlistMutation.mutate() }
        ]
      );
    } else {
      Alert.alert(
        'Book Class',
        'Are you sure you want to book this class?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Book', onPress: () => bookClassMutation.mutate() }
        ]
      );
    }
  };

  const handleSendNotification = () => {
    Alert.alert(
      'Send Notification',
      'Send a notification to all participants?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: () => console.log('Send notification to participants') }
      ]
    );
  };

  const renderParticipant = ({ item }: { item: ParticipantResponse }) => (
    <View style={styles.participantItem}>
      <View style={styles.participantAvatar}>
        <Text style={styles.participantInitials}>
          {item.name.split(' ').map(n => n[0]).join('')}
        </Text>
      </View>
      <View style={styles.participantInfo}>
        <Text style={styles.participantName}>{item.name}</Text>
        <Text style={styles.participantEmail}>{item.email}</Text>
        <Text style={styles.participantBookingDate}>
          Booked: {new Date(item.booking_date).toLocaleDateString()}
        </Text>
      </View>
      {isAdmin && (
        <TouchableOpacity style={styles.participantAction}>
          <Ionicons name="ellipsis-vertical" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading class details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !classInstance) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={COLORS.error} />
          <Text style={styles.errorText}>Failed to load class details</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { date, time } = formatDateTime(classInstance.start_datetime);
  const endTime = new Date(classInstance.end_datetime).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Class Details</Text>
        <View style={styles.headerActions}>
          {isAdmin && (
            <>
              <TouchableOpacity style={styles.headerAction}>
                <Ionicons name="pencil" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerAction}>
                <Ionicons name="trash" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Class Info */}
        <View style={styles.classInfo}>
          <Text style={styles.className}>{classInstance.template.name}</Text>
          <Text style={styles.classLevel}>
            {classInstance.template.level.charAt(0).toUpperCase() + classInstance.template.level.slice(1)} Level
          </Text>
          
          <View style={styles.instructor}>
            <View style={styles.instructorAvatar}>
              <Ionicons name="person" size={24} color={COLORS.textSecondary} />
            </View>
            <View>
              <Text style={styles.instructorName}>
                {classInstance.instructor.first_name} {classInstance.instructor.last_name}
              </Text>
              <Text style={styles.instructorTitle}>Instructor</Text>
            </View>
          </View>
        </View>

        {/* Schedule Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <View style={styles.scheduleInfo}>
            <View style={styles.scheduleItem}>
              <Ionicons name="calendar" size={20} color={COLORS.primary} />
              <Text style={styles.scheduleText}>{date}</Text>
            </View>
            <View style={styles.scheduleItem}>
              <Ionicons name="time" size={20} color={COLORS.primary} />
              <Text style={styles.scheduleText}>{time} - {endTime}</Text>
            </View>
            <View style={styles.scheduleItem}>
              <Ionicons name="hourglass" size={20} color={COLORS.primary} />
              <Text style={styles.scheduleText}>{classInstance.template.duration_minutes} minutes</Text>
            </View>
          </View>
        </View>

        {/* Capacity Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <View style={styles.capacityInfo}>
            <View style={styles.capacityItem}>
              <Text style={styles.capacityNumber}>{classInstance.participant_count}</Text>
              <Text style={styles.capacityLabel}>Enrolled</Text>
            </View>
            <View style={styles.capacityDivider} />
            <View style={styles.capacityItem}>
              <Text style={styles.capacityNumber}>{classInstance.available_spots}</Text>
              <Text style={styles.capacityLabel}>Available</Text>
            </View>
            <View style={styles.capacityDivider} />
            <View style={styles.capacityItem}>
              <Text style={styles.capacityNumber}>{classInstance.waitlist_count}</Text>
              <Text style={styles.capacityLabel}>Waitlist</Text>
            </View>
          </View>
        </View>

        {/* Attendees */}
        {attendees.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Who's Going</Text>
            {friendsInClass.length > 0 && (
              <Text style={styles.friendsText}>
                {friendsInClass.length} of your friends {friendsInClass.length === 1 ? 'is' : 'are'} attending
              </Text>
            )}
            <AttendeeAvatars
              attendees={attendees}
              onAttendeePress={(attendee) => {
                // Navigate to public profile
                console.log('View profile:', attendee);
              }}
            />
          </View>
        )}

        {/* Description */}
        {classInstance.template.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{classInstance.template.description}</Text>
          </View>
        )}

        {/* Notes */}
        {classInstance.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{classInstance.notes}</Text>
          </View>
        )}

        {/* Participants (Admin/Instructor Only) */}
        {(isAdmin || isInstructor) && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowParticipants(!showParticipants)}
            >
              <Text style={styles.sectionTitle}>
                Participants ({participants.length})
              </Text>
              <Ionicons 
                name={showParticipants ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={COLORS.primary} 
              />
            </TouchableOpacity>
            
            {showParticipants && (
              <View style={styles.participantsList}>
                {participantsLoading ? (
                  <Text style={styles.loadingText}>Loading participants...</Text>
                ) : participants.length === 0 ? (
                  <Text style={styles.emptyText}>No participants yet</Text>
                ) : (
                  <FlatList
                    data={participants}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderParticipant}
                    scrollEnabled={false}
                  />
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        {/* Student Actions */}
        {isStudent && classInstance.status === 'scheduled' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={handleBookClass}
            disabled={bookClassMutation.isPending || joinWaitlistMutation.isPending}
          >
            <Ionicons 
              name={classInstance.is_full ? "hourglass" : "add"} 
              size={20} 
              color={COLORS.white} 
            />
            <Text style={styles.actionButtonText}>
              {bookClassMutation.isPending || joinWaitlistMutation.isPending
                ? 'Processing...'
                : classInstance.is_full 
                  ? 'Join Waitlist' 
                  : 'Book Class'
              }
            </Text>
          </TouchableOpacity>
        )}

        {/* Admin Actions */}
        {isAdmin && (
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={handleSendNotification}
          >
            <Ionicons name="notifications" size={20} color={COLORS.primary} />
            <Text style={styles.secondaryButtonText}>Notify Participants</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Booking Confirmation Modal */}
      {completedBooking && classInstance && (
        <BookingConfirmationModal
          visible={showBookingModal}
          onClose={() => {
            setShowBookingModal(false);
            setCompletedBooking(null);
          }}
          booking={completedBooking}
          classInstance={classInstance}
          onViewSchedule={() => {
            setShowBookingModal(false);
            setCompletedBooking(null);
            // Navigate to schedule or bookings screen
            navigation.navigate('Bookings' as any);
          }}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  headerAction: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
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
  classInfo: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  className: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  classLevel: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SPACING.lg,
  },
  instructor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  instructorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructorName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  instructorTitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  section: {
    backgroundColor: COLORS.white,
    marginTop: SPACING.sm,
    padding: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  scheduleInfo: {
    gap: SPACING.md,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  scheduleText: {
    fontSize: 16,
    color: COLORS.text,
  },
  capacityInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  capacityItem: {
    alignItems: 'center',
  },
  capacityNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  capacityLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  capacityDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.lightGray,
  },
  description: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
  },
  notes: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  participantsList: {
    marginTop: SPACING.md,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  participantInitials: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  participantEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  participantBookingDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  participantAction: {
    padding: SPACING.xs,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
    fontStyle: 'italic',
  },
  actions: {
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    gap: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
    gap: SPACING.sm,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  friendsText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
});

export default ClassDetailsScreen;