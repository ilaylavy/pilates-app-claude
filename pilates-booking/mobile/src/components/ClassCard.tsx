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
import { ClassInstance } from '../types';

interface ClassCardProps {
  classInstance: ClassInstance;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
}

const ClassCard: React.FC<ClassCardProps> = ({
  classInstance,
  onPress,
  onEdit,
  onDelete,
  onCancel,
  showActions = true,
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

  const getCapacityColor = () => {
    const ratio = classInstance.available_spots / classInstance.template.capacity;
    if (ratio > 0.5) return COLORS.success;
    if (ratio > 0.2) return COLORS.warning;
    return COLORS.error;
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.className}>{classInstance.template.name}</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(classInstance.status) }
          ]}>
            <Text style={styles.statusText}>
              {classInstance.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.instructor}>
          {classInstance.instructor.first_name} {classInstance.instructor.last_name}
        </Text>
      </View>

      <View style={styles.details}>
        <View style={styles.timeInfo}>
          <Ionicons name="calendar" size={16} color={COLORS.textSecondary} />
          <Text style={styles.detailText}>
            {formatDate(classInstance.start_datetime)}
          </Text>
        </View>
        <View style={styles.timeInfo}>
          <Ionicons name="time" size={16} color={COLORS.textSecondary} />
          <Text style={styles.detailText}>
            {formatTime(classInstance.start_datetime)} - {formatTime(classInstance.end_datetime)}
          </Text>
        </View>
        <View style={styles.capacityInfo}>
          <Ionicons name="people" size={16} color={getCapacityColor()} />
          <Text style={[styles.detailText, { color: getCapacityColor() }]}>
            {classInstance.participant_count}/{classInstance.template.capacity} spots
          </Text>
          {classInstance.is_full && (
            <Text style={styles.fullText}>FULL</Text>
          )}
          {classInstance.waitlist_count > 0 && (
            <Text style={styles.waitlistText}>
              {classInstance.waitlist_count} waiting
            </Text>
          )}
        </View>
      </View>

      {classInstance.template.description && (
        <Text style={styles.description} numberOfLines={2}>
          {classInstance.template.description}
        </Text>
      )}

      {showActions && (
        <View style={styles.actions}>
          {/* Student actions */}
          {isStudent && classInstance.status === 'scheduled' && (
            <>
              {!classInstance.is_full ? (
                <TouchableOpacity style={styles.bookButton} onPress={onPress}>
                  <Ionicons name="add" size={16} color={COLORS.white} />
                  <Text style={styles.bookButtonText}>Book</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.waitlistButton} onPress={onPress}>
                  <Ionicons name="hourglass" size={16} color={COLORS.warning} />
                  <Text style={styles.waitlistButtonText}>Join Waitlist</Text>
                </TouchableOpacity>
              )}
              {onCancel && (
                <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                  <Ionicons name="close" size={16} color={COLORS.error} />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Instructor actions */}
          {isInstructor && (
            <>
              <TouchableOpacity style={styles.viewButton} onPress={onPress}>
                <Ionicons name="eye" size={16} color={COLORS.primary} />
                <Text style={styles.viewButtonText}>View Students</Text>
              </TouchableOpacity>
              {onEdit && (
                <TouchableOpacity style={styles.editButton} onPress={onEdit}>
                  <Ionicons name="pencil" size={16} color={COLORS.primary} />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Admin actions */}
          {isAdmin && (
            <>
              <TouchableOpacity style={styles.manageButton} onPress={onPress}>
                <Ionicons name="settings" size={16} color={COLORS.primary} />
                <Text style={styles.manageButtonText}>Manage</Text>
              </TouchableOpacity>
              {onEdit && (
                <TouchableOpacity style={styles.editButton} onPress={onEdit}>
                  <Ionicons name="pencil" size={16} color={COLORS.primary} />
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
                  <Ionicons name="trash" size={16} color={COLORS.error} />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
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
});

export default ClassCard;