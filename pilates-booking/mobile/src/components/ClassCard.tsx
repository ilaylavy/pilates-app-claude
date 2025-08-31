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
import { useTranslation } from '../hooks/useTranslation';
import { ClassInstance } from '../types';

interface ClassCardProps {
  classInstance: ClassInstance;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onBook?: () => void;
  onJoinWaitlist?: () => void;
  showActions?: boolean;
  isBooked?: boolean;
  isWaitlisted?: boolean;
  availableSpots?: number;
  hasAvailableCredits?: boolean;
  isBookingInProgress?: boolean;
  classTimingStatus?: 'future' | 'ongoing' | 'past';
  didUserParticipate?: boolean;
}

const ClassCard: React.FC<ClassCardProps> = ({
  classInstance,
  onPress,
  onEdit,
  onDelete,
  onBook,
  onJoinWaitlist,
  showActions = true,
  isBooked = false,
  isWaitlisted = false,
  availableSpots,
  hasAvailableCredits = true,
  isBookingInProgress = false,
  classTimingStatus = 'future',
  didUserParticipate = false,
}) => {
  const { isAdmin, isInstructor, isStudent } = useUserRole();
  const { t, formatTime: formatTimeI18n, formatDate: formatDateI18n, rtlText, rtlRow, rtlAlign } = useTranslation();

  const formatClassTime = (dateString: string) => {
    return formatTimeI18n(new Date(dateString));
  };

  const formatDate = (dateString: string) => {
    return formatDateI18n(new Date(dateString));
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

  const renderListContent = () => (
    <>
      <View style={[styles.listHeader, rtlRow()]}>
        <View style={styles.classInfo}>
          <Text style={[styles.className, rtlText()]}>{classInstance.template?.name || t('classes.title')}</Text>
          <Text style={[styles.instructor, rtlText()]}>
            {classInstance.instructor?.first_name || t('classes.instructor')} {classInstance.instructor?.last_name || ''}
          </Text>
          <View style={[styles.listTimeInfo, rtlRow()]}>
            <Ionicons name="calendar" size={14} color={COLORS.textSecondary} />
            <Text style={styles.listTimeText}>
              {formatDate(classInstance.start_datetime)}
            </Text>
            <Ionicons name="time" size={14} color={COLORS.textSecondary} />
            <Text style={styles.listTimeText}>
              {formatClassTime(classInstance.start_datetime)} - {formatClassTime(classInstance.end_datetime)}
            </Text>
          </View>
        </View>
        <View style={[styles.listRightInfo, rtlAlign('start')]}>
          {/* Always show capacity info */}
          <View style={styles.listCapacityContainer}>
            <View style={[styles.listCapacityDisplay, rtlRow()]}>
              <Ionicons name="people" size={14} color={capacityInfo.color} />
              <Text style={[styles.listCapacityText, { color: capacityInfo.color }]}>
                {capacityInfo.current}/{capacityInfo.total}
              </Text>
              <View style={[styles.listCapacityDot, { backgroundColor: capacityInfo.color }]} />
            </View>
            {capacityInfo.isFull && (
              <Text style={styles.listFullText}>{t('classes.full')}</Text>
            )}
          </View>

          {/* Student booking actions positioned like capacity */}
          {(isStudent || isAdmin) && showActions && classInstance.status === 'scheduled' && (
            <View style={styles.listStudentActions}>
              {classTimingStatus === 'past' ? (
                // Show past status for completed classes
                <View style={styles.bookedBadge}>
                  <Ionicons 
                    name={didUserParticipate ? "checkmark-circle" : "time"} 
                    size={20} 
                    color={didUserParticipate ? COLORS.success : COLORS.textSecondary} 
                  />
                  <Text style={[
                    styles.bookedText, 
                    { color: didUserParticipate ? COLORS.success : COLORS.textSecondary }
                  ]}>
                    {didUserParticipate ? t('classes.participated') : t('classes.passed')}
                  </Text>
                </View>
              ) : classTimingStatus === 'ongoing' ? (
                // Show ongoing status
                <View style={styles.bookedBadge}>
                  <Ionicons name="radio-button-on" size={20} color={COLORS.primary} />
                  <Text style={[styles.bookedText, { color: COLORS.primary }]}>{t('classes.ongoing')}</Text>
                </View>
              ) : isBooked ? (
                // Show booked status when booked (future classes)
                <View style={styles.bookedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.bookedText}>{t('classes.bookingConfirmed')}</Text>
                </View>
              ) : isWaitlisted ? (
                // Show waitlisted status when waitlisted (future classes)
                <View style={styles.bookedBadge}>
                  <Ionicons name="hourglass" size={20} color={COLORS.warning} />
                  <Text style={[styles.bookedText, { color: COLORS.warning }]}>{t('classes.addedToWaitlist')}</Text>
                </View>
              ) : (
                // Show book/waitlist button when not booked (future classes only)
                <>
                  {classInstance.is_full ? (
                    onJoinWaitlist && (
                      <TouchableOpacity 
                        style={[
                          styles.actionButton, 
                          !hasAvailableCredits ? styles.disabledActionButton : styles.studentWaitlistButton,
                          rtlRow()
                        ]}
                        onPress={onJoinWaitlist}
                        disabled={isBookingInProgress || !hasAvailableCredits}
                      >
                        <Ionicons 
                          name={!hasAvailableCredits ? "card" : "hourglass"} 
                          size={16} 
                          color={!hasAvailableCredits ? COLORS.white : COLORS.warning} 
                        />
                        <Text style={[!hasAvailableCredits ? styles.studentBookButtonText : styles.studentWaitlistButtonText, rtlText()]}>
                          {isBookingInProgress ? t('status.loading') : !hasAvailableCredits ? t('classes.noCredits') : t('classes.waitlist')}
                        </Text>
                      </TouchableOpacity>
                    )
                  ) : (
                    onBook && (
                      <TouchableOpacity 
                        style={[
                          styles.actionButton, 
                          styles.studentBookButton,
                          !hasAvailableCredits && styles.disabledActionButton,
                          rtlRow()
                        ]}
                        onPress={onBook}
                        disabled={isBookingInProgress || !hasAvailableCredits}
                      >
                        <Ionicons name={!hasAvailableCredits ? "card" : "add"} size={16} color={COLORS.white} />
                        <Text style={[styles.studentBookButtonText, rtlText()]}>
                          {isBookingInProgress ? t('status.loading') : !hasAvailableCredits ? t('classes.noCredits') : t('classes.book')}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </>
              )}
            </View>
          )}

          {/* Show booked badge for non-student views */}
          {(!(isStudent || isAdmin) || !showActions) && isBooked && (
            <View style={styles.bookedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text style={styles.bookedText}>{t('classes.bookingConfirmed')}</Text>
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


  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {renderListContent()}
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
  listTimeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
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
  // List variant capacity styles
  listCapacityContainer: {
    alignItems: 'flex-end',
    gap: 2,
    marginBottom: SPACING.xs,
  },
  listStudentActions: {
    alignItems: 'flex-end',
    marginBottom: SPACING.xs,
  },
  listCapacityDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listCapacityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listCapacityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listFullText: {
    fontSize: 10,
    color: COLORS.error,
    fontWeight: 'bold',
    backgroundColor: '#ffebee',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
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