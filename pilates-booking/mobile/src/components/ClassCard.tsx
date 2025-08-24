import React from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';
import { useUserRole } from '../hooks/useUserRole';
import { ClassInstance, Booking } from '../types';

export type ClassCardVariant = 'list' | 'booking' | 'schedule';

interface ClassCardProps {
  classInstance: ClassInstance;
  booking?: Booking;
  variant?: ClassCardVariant;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
  onShare?: () => void;
  onReschedule?: () => void;
  onBook?: () => void;
  onJoinWaitlist?: () => void;
  showActions?: boolean;
  isBooked?: boolean;
  availableSpots?: number;
  hasAvailableCredits?: boolean;
  isBookingInProgress?: boolean;
  showTimeLeft?: boolean;
}

const ClassCard: React.FC<ClassCardProps> = ({
  classInstance,
  booking,
  variant = 'list',
  onPress,
  onEdit,
  onDelete,
  onCancel: _onCancel,
  onShare: _onShare,
  onReschedule,
  onBook,
  onJoinWaitlist,
  showActions = true,
  isBooked = false,
  availableSpots,
  hasAvailableCredits = true,
  isBookingInProgress = false,
  showTimeLeft = false,
}) => {
  const { isAdmin, isInstructor, isStudent } = useUserRole();

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return COLORS.success;
      case 'cancelled':
        return COLORS.error;
      case 'completed':
        return COLORS.textSecondary;
      default:
        return COLORS.primary;
    }
  };

  const getCapacityInfo = () => {
    const totalCapacity = classInstance.actual_capacity || classInstance.template.capacity;
    const currentParticipants = classInstance.participant_count || 0;
    const spotsAvailable = availableSpots ?? classInstance.available_spots;
    const ratio = spotsAvailable / totalCapacity;
    
    const color = ratio > 0.5 ? COLORS.success : ratio > 0.2 ? COLORS.warning : COLORS.error;
    
    return {
      current: currentParticipants,
      total: totalCapacity,
      available: spotsAvailable,
      color,
      isFull: classInstance.is_full
    };
  };

  const capacityInfo = getCapacityInfo();

  // Get styles based on variant
  const getCardStyle = () => {
    switch (variant) {
      case 'booking':
        return [styles.card, styles.bookingCard];
      case 'schedule':
        return [styles.card, styles.scheduleCard];
      default:
        return styles.card;
    }
  };

  // Show different content based on variant
  const renderContent = () => {
    switch (variant) {
      case 'booking':
        return renderBookingContent();
      case 'schedule':
        return renderScheduleContent();
      default:
        return renderListContent();
    }
  };

  const renderListContent = () => (
    <>
      <View style={styles.listHeader}>
        <View style={styles.classInfo}>
          <Text style={styles.className}>{classInstance.template?.name || 'Unknown Class'}</Text>
          <Text style={styles.instructor}>
            {classInstance.instructor?.first_name || 'Unknown'} {classInstance.instructor?.last_name || 'Instructor'}
          </Text>
          <View style={styles.listTimeInfo}>
            <Ionicons name="calendar" size={14} color={COLORS.textSecondary} />
            <Text style={styles.listTimeText}>
              {formatDate(classInstance.start_datetime)}
            </Text>
            <Ionicons name="time" size={14} color={COLORS.textSecondary} />
            <Text style={styles.listTimeText}>
              {formatTime(classInstance.start_datetime)} - {formatTime(classInstance.end_datetime)}
            </Text>
          </View>
        </View>
        <View style={styles.listRightInfo}>
          {/* Student booking actions */}
          {(isStudent || isAdmin) && showActions && classInstance.status === 'scheduled' && (
            <View style={styles.studentActions}>
              {isBooked ? (
                // Show booked status when booked
                <View style={styles.bookedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.bookedText}>Booked</Text>
                </View>
              ) : (
                // Show book/waitlist button when not booked
                <>
                  {classInstance.is_full ? (
                    onJoinWaitlist && (
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.studentWaitlistButton]}
                        onPress={onJoinWaitlist}
                        disabled={isBookingInProgress || !hasAvailableCredits}
                      >
                        <Ionicons name="hourglass" size={16} color={COLORS.warning} />
                        <Text style={styles.studentWaitlistButtonText}>
                          {isBookingInProgress ? 'Joining...' : 'Join Waitlist'}
                        </Text>
                      </TouchableOpacity>
                    )
                  ) : (
                    onBook && (
                      <TouchableOpacity 
                        style={[
                          styles.actionButton, 
                          styles.studentBookButton,
                          !hasAvailableCredits && styles.disabledActionButton
                        ]}
                        onPress={onBook}
                        disabled={isBookingInProgress || !hasAvailableCredits}
                      >
                        <Ionicons name="add" size={16} color={COLORS.white} />
                        <Text style={styles.studentBookButtonText}>
                          {isBookingInProgress ? 'Booking...' : !hasAvailableCredits ? 'No Credits' : '+ Book Class'}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </>
              )}
            </View>
          )}

          {/* Capacity info for non-students or when no actions */}
          {(!(isStudent || isAdmin) || !showActions) && (
            <View style={styles.capacityInfo}>
              {isBooked && (
                <View style={styles.bookedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.bookedText}>Booked</Text>
                </View>
              )}
              <View style={styles.capacityDisplay}>
                <Ionicons name="people" size={16} color={capacityInfo.color} />
                <Text style={[styles.capacityText, { color: capacityInfo.color }]}>
                  {capacityInfo.current}/{capacityInfo.total}
                </Text>
                {capacityInfo.isFull && (
                  <Text style={styles.fullText}>FULL</Text>
                )}
              </View>
            </View>
          )}
          
          {/* Admin/Instructor actions */}
          {(isAdmin || isInstructor) && (
            <View style={styles.adminActions}>
              {onEdit && (
                <TouchableOpacity style={styles.editIconButton} onPress={onEdit}>
                  <Ionicons name="pencil" size={18} color={COLORS.primary} />
                </TouchableOpacity>
              )}
              {isAdmin && onDelete && (
                <TouchableOpacity style={styles.deleteIconButton} onPress={onDelete}>
                  <Ionicons name="trash" size={18} color={COLORS.error} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </>
  );

  const renderBookingContent = () => (
    <>
      <View style={styles.bookingHeader}>
        <View style={styles.classInfo}>
          <Text style={styles.className} numberOfLines={1}>
            {classInstance.template?.name || 'Unknown Class'}
          </Text>
          <Text style={styles.instructor}>
            with {classInstance.instructor?.first_name || 'Unknown'} {classInstance.instructor?.last_name || 'Instructor'}
          </Text>
        </View>
        {booking && (
          <View style={[styles.statusBadge, { backgroundColor: getBookingStatusColor(booking.status) }]}>
            <Text style={styles.statusText}>{getBookingStatusText(booking.status)}</Text>
          </View>
        )}
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.dateTimeContainer}>
          <View style={styles.dateTime}>
            <Ionicons name="calendar" size={16} color={COLORS.textSecondary} />
            <Text style={styles.dateText}>{formatDate(classInstance.start_datetime)}</Text>
          </View>
          <View style={styles.dateTime}>
            <Ionicons name="time" size={16} color={COLORS.textSecondary} />
            <Text style={styles.timeText}>{formatTime(classInstance.start_datetime)}</Text>
          </View>
        </View>

        {booking && (
          <View style={styles.bookingFooter}>
            <Text style={styles.bookingDate}>
              Booked: {new Date(booking.booking_date).toLocaleDateString()}
            </Text>
            
            {booking.status === 'confirmed' && (
              <View style={styles.quickActions}>
                {onReschedule && (
                  <TouchableOpacity style={styles.quickAction} onPress={onReschedule}>
                    <Ionicons name="swap-horizontal" size={16} color={COLORS.primary} />
                    <Text style={styles.quickActionText}>Reschedule</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </>
  );

  const renderScheduleContent = () => (
    <>
      <View style={styles.scheduleLayout}>
        {/* Time column */}
        {showTimeLeft && (
          <View style={styles.scheduleTimeColumn}>
            <Text style={styles.scheduleTime}>
              {formatTime(classInstance.start_datetime)}
            </Text>
            <Text style={styles.scheduleEndTime}>
              {formatTime(classInstance.end_datetime)}
            </Text>
          </View>
        )}
        
        {/* Main content */}
        <View style={styles.scheduleMainContent}>
          <View style={styles.scheduleHeader}>
            <View style={styles.classInfo}>
              <Text style={styles.className}>{classInstance.template?.name || 'Unknown Class'}</Text>
              <Text style={styles.instructor}>
                {classInstance.instructor?.first_name || 'Unknown'} {classInstance.instructor?.last_name || 'Instructor'}
              </Text>
              {!showTimeLeft && (
                <View style={styles.scheduleTimeInfo}>
                  <Ionicons name="time" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.scheduleTimeText}>
                    {formatTime(classInstance.start_datetime)} - {formatTime(classInstance.end_datetime)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        
        {/* Right side - Actions and capacity */}
        <View style={styles.scheduleRightContent}>
          {/* Student booking actions */}
          {(isStudent || isAdmin) && showActions && classInstance.status === 'scheduled' && (
            <View style={styles.scheduleStudentActions}>
              {isBooked ? (
                <View style={styles.scheduleBookedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={styles.scheduleBookedText}>Booked</Text>
                </View>
              ) : (
                <>
                  {classInstance.is_full ? (
                    onJoinWaitlist && (
                      <TouchableOpacity 
                        style={[styles.scheduleActionButton, styles.scheduleWaitlistButton]}
                        onPress={onJoinWaitlist}
                        disabled={isBookingInProgress || !hasAvailableCredits}
                      >
                        <Ionicons name="hourglass" size={14} color={COLORS.warning} />
                        <Text style={styles.scheduleWaitlistButtonText}>
                          {isBookingInProgress ? 'Joining...' : 'Join Waitlist'}
                        </Text>
                      </TouchableOpacity>
                    )
                  ) : (
                    onBook && (
                      <TouchableOpacity 
                        style={[
                          styles.scheduleActionButton,
                          styles.scheduleBookButton,
                          !hasAvailableCredits && styles.scheduleDisabledActionButton
                        ]}
                        onPress={onBook}
                        disabled={isBookingInProgress || !hasAvailableCredits}
                      >
                        <Ionicons name="add" size={14} color={COLORS.white} />
                        <Text style={styles.scheduleBookButtonText}>
                          {isBookingInProgress ? 'Booking...' : !hasAvailableCredits ? 'No Credits' : '+ Book Class'}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </>
              )}
            </View>
          )}
          
          {/* Capacity display */}
          <View style={styles.scheduleCapacityContainer}>
            <View style={styles.scheduleCapacityDisplay}>
              <Ionicons name="people" size={14} color={capacityInfo.color} />
              <Text style={[styles.scheduleCapacityText, { color: capacityInfo.color }]}>
                {capacityInfo.current}/{capacityInfo.total}
              </Text>
              <View style={[styles.scheduleCapacityDot, { backgroundColor: capacityInfo.color }]} />
            </View>
            {capacityInfo.isFull && (
              <Text style={styles.scheduleFullText}>FULL</Text>
            )}
          </View>
          
          {/* Admin/Instructor actions */}
          {(isAdmin || isInstructor) && (
            <View style={styles.scheduleAdminActions}>
              {onEdit && (
                <TouchableOpacity style={styles.scheduleEditButton} onPress={onEdit}>
                  <Ionicons name="pencil" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              )}
              {isAdmin && onDelete && (
                <TouchableOpacity style={styles.scheduleDeleteButton} onPress={onDelete}>
                  <Ionicons name="trash" size={16} color={COLORS.error} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </>
  );

  const getBookingStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return COLORS.success;
      case 'cancelled':
        return COLORS.error;
      case 'completed':
        return COLORS.primary;
      case 'no_show':
        return COLORS.warning;
      default:
        return COLORS.textSecondary;
    }
  };

  const getBookingStatusText = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'Confirmed';
      case 'cancelled':
        return 'Cancelled';
      case 'completed':
        return 'Completed';
      case 'no_show':
        return 'No Show';
      default:
        return status;
    }
  };

  return (
    <TouchableOpacity
      style={getCardStyle()}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bookingCard: {
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
  },
  scheduleCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  header: {
    marginBottom: SPACING.md,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: '600',
  },
  instructor: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  details: {
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  capacityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  fullText: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: 'bold',
    backgroundColor: '#ffebee',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: SPACING.xs,
  },
  waitlistText: {
    fontSize: 12,
    color: COLORS.warning,
    fontWeight: 'bold',
    backgroundColor: '#fff3cd',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: SPACING.xs,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
    gap: 4,
  },
  bookButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  waitlistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
    gap: 4,
  },
  waitlistButtonText: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
    gap: 4,
  },
  cancelButtonText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
    gap: 4,
  },
  viewButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
    gap: 4,
  },
  editButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
    gap: 4,
  },
  manageButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
    gap: 4,
  },
  deleteButtonText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '600',
  },
  // List variant styles (used for both home and schedule)
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  listTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.xs,
  },
  listTimeText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  listRightInfo: {
    alignItems: 'flex-end',
    gap: SPACING.sm,
  },
  bookedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookedText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '600',
  },
  // Booking variant styles
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  bookingDetails: {
    gap: SPACING.md,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  dateTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickActionText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  // Shared class info styles
  classInfo: {
    flex: 1,
  },
  capacityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  adminActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  editIconButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: COLORS.lightGray,
  },
  deleteIconButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#ffebee',
  },
  // New student action styles
  studentActions: {
    alignItems: 'flex-end',
    marginBottom: SPACING.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    gap: 4,
    minWidth: 100,
    justifyContent: 'center',
  },
  studentBookButton: {
    backgroundColor: COLORS.primary,
  },
  studentWaitlistButton: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  studentCancelButton: {
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  disabledActionButton: {
    backgroundColor: COLORS.textSecondary,
  },
  studentBookButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  studentWaitlistButtonText: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  studentCancelButtonText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '600',
  },
  capacityDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  // Schedule variant styles
  scheduleLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
  },
  scheduleTimeColumn: {
    marginRight: SPACING.md,
    minWidth: 60,
    alignItems: 'flex-start',
  },
  scheduleTime: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 2,
  },
  scheduleEndTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  scheduleMainContent: {
    flex: 1,
    marginRight: SPACING.md,
  },
  scheduleHeader: {
    flex: 1,
  },
  scheduleTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },
  scheduleTimeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  scheduleRightContent: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  scheduleStudentActions: {
    alignItems: 'flex-end',
  },
  scheduleActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
    gap: 3,
    minWidth: 90,
    justifyContent: 'center',
  },
  scheduleBookButton: {
    backgroundColor: COLORS.primary,
  },
  scheduleWaitlistButton: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  scheduleDisabledActionButton: {
    backgroundColor: COLORS.textSecondary,
  },
  scheduleBookButtonText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
  },
  scheduleWaitlistButtonText: {
    color: COLORS.warning,
    fontSize: 11,
    fontWeight: '600',
  },
  scheduleBookedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  scheduleBookedText: {
    fontSize: 11,
    color: COLORS.success,
    fontWeight: '600',
  },
  scheduleCapacityContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  scheduleCapacityDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduleCapacityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scheduleCapacityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scheduleFullText: {
    fontSize: 10,
    color: COLORS.error,
    fontWeight: 'bold',
    backgroundColor: '#ffebee',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  scheduleAdminActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  scheduleEditButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: COLORS.lightGray,
  },
  scheduleDeleteButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#ffebee',
  },
});

export default ClassCard;