import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { Booking } from '../types';
import AttendeeAvatars from './AttendeeAvatars';

interface BookingCardProps {
  booking: Booking;
  attendees?: any[];
  onPress?: () => void;
  onCancel?: () => void;
  onReschedule?: () => void;
  onShare?: () => void;
  showSwipeActions?: boolean;
}

const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  attendees = [],
  onPress,
  onCancel,
  onReschedule,
  onShare,
  showSwipeActions = true,
}) => {
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#4CAF50';
      case 'cancelled':
        return '#F44336';
      case 'completed':
        return '#2196F3';
      case 'no_show':
        return '#FF9800';
      default:
        return '#757575';
    }
  };

  const getStatusText = (status: string) => {
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

  const { date, time } = formatDateTime(booking.class_instance.start_datetime);

  const renderLeftActions = () => {
    if (!onCancel || booking.status !== 'confirmed' || !booking.can_cancel) {
      return null;
    }

    return (
      <Animated.View style={styles.leftAction}>
        <TouchableOpacity
          style={styles.cancelAction}
          onPress={() => {
            Alert.alert(
              'Cancel Booking',
              'Are you sure you want to cancel this booking?',
              [
                { text: 'No', style: 'cancel' },
                { text: 'Yes', onPress: onCancel },
              ]
            );
          }}
        >
          <Ionicons name="close" size={24} color="#fff" />
          <Text style={styles.actionText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderRightActions = () => {
    if (!onShare) {
      return null;
    }

    return (
      <Animated.View style={styles.rightAction}>
        <TouchableOpacity style={styles.shareAction} onPress={onShare}>
          <Ionicons name="share" size={24} color="#fff" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const cardContent = (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.classInfo}>
          <Text style={styles.className} numberOfLines={1}>
            {booking.class_instance.template.name}
          </Text>
          <Text style={styles.instructor}>
            with {booking.class_instance.instructor.first_name} {booking.class_instance.instructor.last_name}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
          <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.dateTimeContainer}>
          <View style={styles.dateTime}>
            <Ionicons name="calendar" size={16} color="#666" />
            <Text style={styles.dateText}>{date}</Text>
          </View>
          <View style={styles.dateTime}>
            <Ionicons name="time" size={16} color="#666" />
            <Text style={styles.timeText}>{time}</Text>
          </View>
        </View>

        {attendees.length > 0 && (
          <View style={styles.attendeesContainer}>
            <AttendeeAvatars
              attendees={attendees}
              size={24}
              maxVisible={4}
            />
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.bookingDate}>
            Booked: {new Date(booking.booking_date).toLocaleDateString()}
          </Text>
          
          {booking.status === 'confirmed' && (
            <View style={styles.quickActions}>
              {onReschedule && (
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={onReschedule}
                >
                  <Ionicons name="swap-horizontal" size={16} color="#007AFF" />
                  <Text style={styles.quickActionText}>Reschedule</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );

  if (showSwipeActions) {
    return (
      <Swipeable
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
      >
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          {cardContent}
        </TouchableOpacity>
      </Swipeable>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {cardContent}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  classInfo: {
    flex: 1,
    marginRight: 12,
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  instructor: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    gap: 12,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  dateTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  timeText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  attendeesContainer: {
    paddingVertical: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingDate: {
    fontSize: 12,
    color: '#999',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 16,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickActionText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  leftAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
  },
  rightAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 20,
  },
  cancelAction: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  shareAction: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default BookingCard;