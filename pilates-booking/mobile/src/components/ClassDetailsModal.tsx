import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING } from '../utils/config';
import { useUserRole } from '../hooks/useUserRole';
import { getFriendlyErrorMessage, getErrorAlertTitle } from '../utils/errorMessages';
import { classesApi, ParticipantResponse } from '../api/classes';
import { bookingsApi } from '../api/bookings';
import { packagesApi } from '../api/packages';
import { socialApi, Attendee } from '../api/social';
import { useCancelBooking } from '../hooks/useBookings';
import { ClassInstance } from '../types';
import AttendeeAvatars from './AttendeeAvatars';

interface ClassDetailsModalProps {
  visible: boolean;
  classInstance: ClassInstance | null;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onBookingSuccess?: (booking: any, classInstance: ClassInstance) => void;
}

const ClassDetailsModal: React.FC<ClassDetailsModalProps> = ({
  visible,
  classInstance,
  onClose,
  onEdit,
  onDelete,
  onBookingSuccess,
}) => {
  const [showParticipants, setShowParticipants] = useState(false);
  const { isAdmin, isInstructor, isStudent } = useUserRole();
  const queryClient = useQueryClient();

  // Get user's bookings to check if they have a booking for this class
  const {
    data: userBookings = [],
  } = useQuery({
    queryKey: ['userBookings'],
    queryFn: () => bookingsApi.getUserBookings(),
  });

  // Get user packages to check credit availability
  const {
    data: userPackagesResponse,
  } = useQuery({
    queryKey: ['userPackages'],
    queryFn: () => packagesApi.getUserPackages(),
    enabled: isStudent,
  });

  // Flatten all packages into a single array for backwards compatibility
  const userPackages = userPackagesResponse 
    ? [...userPackagesResponse.active_packages, ...userPackagesResponse.pending_packages, ...userPackagesResponse.historical_packages]
    : [];

  // Find user's booking for this class
  const userBooking = userBookings.find(
    booking => booking.class_instance_id === classInstance?.id && booking.status === 'confirmed'
  );

  // Check if user has available credits
  const activePackage = userPackages.find(pkg => pkg.is_valid);
  const hasAvailableCredits = !!activePackage && (activePackage.credits_remaining > 0 || activePackage.package.is_unlimited);

  // Cancel booking mutation with immediate updates
  const cancelBookingMutation = useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: number; reason?: string }) =>
      bookingsApi.cancelBooking(bookingId, reason),
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
        queryClient.invalidateQueries({ queryKey: ['student-classes'] });
        queryClient.invalidateQueries({ queryKey: ['userBookings'] });
        queryClient.invalidateQueries({ queryKey: ['user-bookings'] });
        queryClient.invalidateQueries({ queryKey: ['upcomingClasses'] });
        queryClient.invalidateQueries({ queryKey: ['attendees', classInstance?.id] });
        // Force another userPackages refetch after delay to catch any delayed server updates
        queryClient.invalidateQueries({ 
          queryKey: ['userPackages'],
          refetchType: 'all' 
        });
      }, 300);
      
      // Immediately invalidate queries (no timeout)
      queryClient.invalidateQueries({ queryKey: ['student-classes'] });
      queryClient.invalidateQueries({ queryKey: ['user-bookings'] });
      
      // Close modal after successful cancellation
      onClose();
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to cancel booking';
      const friendlyMessage = getFriendlyErrorMessage(errorMessage);
      const alertTitle = getErrorAlertTitle(errorMessage);
      Alert.alert(alertTitle, friendlyMessage);
    },
  });

  // Fetch participants for this class
  const {
    data: participants = [],
    isLoading: participantsLoading,
  } = useQuery({
    queryKey: ['participants', classInstance?.id],
    queryFn: () => classInstance ? classesApi.getClassParticipants(classInstance.id) : Promise.resolve([]),
    enabled: !!classInstance && (isAdmin || isInstructor),
  });

  // Fetch attendees for social features (for all users)
  const {
    data: attendees = [],
    isLoading: attendeesLoading,
  } = useQuery({
    queryKey: ['attendees', classInstance?.id],
    queryFn: () => classInstance ? socialApi.getClassAttendees(classInstance.id) : Promise.resolve([]),
    enabled: !!classInstance,
  });

  // Fetch friends in class
  const {
    data: friendsInClass = [],
  } = useQuery({
    queryKey: ['friends-in-class', classInstance?.id],
    queryFn: () => classInstance ? socialApi.getFriendsInClass(classInstance.id) : Promise.resolve([]),
    enabled: !!classInstance && isStudent,
  });

  // Book class mutation
  const bookClassMutation = useMutation({
    mutationFn: async () => {
      if (!classInstance) throw new Error('No class selected');
      const result = await bookingsApi.bookClass(classInstance.id, activePackage?.id);
      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
    onSuccess: (result) => {
      // Immediately update cache with real booking data from server
      if (result.success && result.booking && classInstance) {
        queryClient.setQueryData(['userBookings'], (oldBookings: any[]) => {
          if (!oldBookings) return [result.booking];
          // Make sure we don't duplicate bookings
          const filtered = oldBookings.filter(booking => 
            booking.class_instance_id !== classInstance.id
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
        queryClient.invalidateQueries({ queryKey: ['student-classes'] });
        queryClient.invalidateQueries({ queryKey: ['userBookings'] });
        queryClient.invalidateQueries({ queryKey: ['user-bookings'] });
        queryClient.invalidateQueries({ queryKey: ['upcomingClasses'] });
        queryClient.invalidateQueries({ queryKey: ['attendees', classInstance?.id] });
        // Force another userPackages refetch after delay to catch any delayed server updates
        queryClient.invalidateQueries({ 
          queryKey: ['userPackages'],
          refetchType: 'all' 
        });
      }, 300);
      
      // Immediately invalidate queries (no timeout)
      queryClient.invalidateQueries({ queryKey: ['student-classes'] });
      queryClient.invalidateQueries({ queryKey: ['user-bookings'] });
      
      if (result.booking && classInstance) {
        // Call parent callback to show booking confirmation modal
        onBookingSuccess?.(result.booking, classInstance);
        onClose(); // Close the class details modal
      }
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to book class';
      const friendlyMessage = getFriendlyErrorMessage(errorMessage);
      const alertTitle = getErrorAlertTitle(errorMessage);
      Alert.alert(alertTitle, friendlyMessage);
    },
  });

  // Join waitlist mutation
  const joinWaitlistMutation = useMutation({
    mutationFn: async () => {
      if (!classInstance) throw new Error('No class selected');
      const result = await bookingsApi.joinWaitlist(classInstance.id);
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.waitlist_entry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['attendees', classInstance?.id] });
      Alert.alert('Success', 'Added to waitlist successfully!');
      onClose();
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to join waitlist';
      const friendlyMessage = getFriendlyErrorMessage(errorMessage);
      const alertTitle = getErrorAlertTitle(errorMessage);
      Alert.alert(alertTitle, friendlyMessage);
    },
  });

  if (!classInstance) {
    return null;
  }

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

  const { date, time } = formatDateTime(classInstance.start_datetime);
  const endTime = new Date(classInstance.end_datetime).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const handleBookClass = () => {
    // Check if user has available credits first
    if (isStudent && !hasAvailableCredits) {
      Alert.alert(
        'No Credits Available',
        'You need to purchase a package or top up your credits to book this class.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Buy Package', onPress: () => {
            // Navigate to packages screen
            onClose();
            console.log('Navigate to packages');
          }}
        ]
      );
      return;
    }

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
      // Book directly without confirmation
      bookClassMutation.mutate();
    }
  };

  const handleCancelBooking = () => {
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Class Details</Text>
          <View style={styles.headerActions}>
            {isAdmin && (
              <>
                {onEdit && (
                  <TouchableOpacity onPress={onEdit} style={styles.headerAction}>
                    <Ionicons name="pencil" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
                {onDelete && (
                  <TouchableOpacity onPress={onDelete} style={styles.headerAction}>
                    <Ionicons name="trash" size={20} color={COLORS.error} />
                  </TouchableOpacity>
                )}
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
            <>
              {userBooking ? (
                // Show cancel option if user has a booking
                <TouchableOpacity
                  style={[styles.actionButton, styles.dangerButton]}
                  onPress={handleCancelBooking}
                  disabled={cancelBookingMutation.isPending || !userBooking.can_cancel}
                >
                  <Ionicons 
                    name="close-circle" 
                    size={20} 
                    color={COLORS.white} 
                  />
                  <Text style={styles.actionButtonText}>
                    {cancelBookingMutation.isPending
                      ? 'Cancelling...'
                      : !userBooking.can_cancel
                        ? 'Cannot Cancel'
                        : 'Cancel Booking'
                    }
                  </Text>
                </TouchableOpacity>
              ) : (
                // Show book/waitlist option if user doesn't have a booking
                <TouchableOpacity
                  style={[
                    styles.actionButton, 
                    !hasAvailableCredits ? styles.disabledButton : styles.primaryButton
                  ]}
                  onPress={handleBookClass}
                  disabled={bookClassMutation.isPending || joinWaitlistMutation.isPending || (isStudent && !hasAvailableCredits)}
                >
                  <Ionicons 
                    name={!hasAvailableCredits ? "card" : classInstance.is_full ? "hourglass" : "add"} 
                    size={20} 
                    color={COLORS.white} 
                  />
                  <Text style={styles.actionButtonText}>
                    {bookClassMutation.isPending || joinWaitlistMutation.isPending
                      ? 'Processing...'
                      : !hasAvailableCredits
                        ? 'No Credits'
                        : classInstance.is_full 
                          ? 'Join Waitlist' 
                          : 'Book Class'
                    }
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Admin Actions */}
          {isAdmin && (
            <View style={styles.adminActionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, { flex: 1, marginRight: SPACING.sm }]}
                onPress={onEdit}
              >
                <Ionicons name="create" size={20} color={COLORS.primary} />
                <Text style={styles.secondaryButtonText}>Edit</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.dangerButton, { flex: 1, marginRight: SPACING.sm }]}
                onPress={() => {
                  Alert.alert(
                    'Delete Class',
                    'Are you sure you want to delete this class? This action cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Delete', 
                        style: 'destructive',
                        onPress: onDelete 
                      }
                    ]
                  );
                }}
              >
                <Ionicons name="trash" size={20} color={COLORS.white} />
                <Text style={styles.actionButtonText}>Delete</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, { flex: 1 }]}
                onPress={handleSendNotification}
              >
                <Ionicons name="notifications" size={20} color={COLORS.primary} />
                <Text style={styles.secondaryButtonText}>Notify</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

      </View>
    </Modal>
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
  closeButton: {
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
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
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
  adminActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
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
  dangerButton: {
    backgroundColor: COLORS.error,
  },
  disabledButton: {
    backgroundColor: COLORS.textSecondary,
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

export default ClassDetailsModal;