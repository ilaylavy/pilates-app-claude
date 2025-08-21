import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { ClassInstance, Booking } from '../types';
import { addClassToCalendar } from '../utils/calendarUtils';

const { width: screenWidth } = Dimensions.get('window');

interface BookingConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  booking: Booking;
  classInstance: ClassInstance;
  creditsRemaining?: number;
  onViewSchedule?: () => void;
}

const BookingConfirmationModal: React.FC<BookingConfirmationModalProps> = ({
  visible,
  onClose,
  booking,
  classInstance,
  creditsRemaining,
  onViewSchedule,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const checkmarkAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout>();

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    };
  };

  const { date, time } = formatDateTime(classInstance.start_datetime);

  const qrCodeData = JSON.stringify({
    bookingId: booking.id,
    classId: classInstance.id,
    userId: booking.user_id,
    className: classInstance.template.name,
    date: classInstance.start_datetime,
  });

  useEffect(() => {
    if (visible) {
      // Animation sequence
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.spring(checkmarkAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 10 seconds
      timeoutRef.current = setTimeout(() => {
        handleClose();
      }, 10000);
    } else {
      scaleAnim.setValue(0);
      checkmarkAnim.setValue(0);
      fadeAnim.setValue(0);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible]);

  const handleClose = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onClose();
  };

  const handleAddToCalendar = async () => {
    try {
      const eventId = await addClassToCalendar(classInstance, {
        reminderMinutes: 30,
        notes: `Booking ID: ${booking.id}`,
        customTitle: `${classInstance.template.name} Class`,
      });

      if (eventId) {
        Alert.alert('Success', 'Class added to your calendar!');
      }
    } catch (error) {
      console.error('Calendar error:', error);
      Alert.alert('Error', 'Failed to add class to calendar.');
    }
  };

  const handleInviteFriends = async () => {
    try {
      const classUrl = `pilates://class/${classInstance.id}`;
      const shareMessage = `Join me for ${classInstance.template.name} on ${date} at ${time}! Book your spot: ${classUrl}`;

      await Share.share({
        message: shareMessage,
        title: 'Join me for a Pilates class!',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Success Animation */}
          <View style={styles.successContainer}>
            <Animated.View
              style={[
                styles.checkmarkContainer,
                {
                  transform: [{ scale: checkmarkAnim }],
                },
              ]}
            >
              <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
            </Animated.View>
            <Text style={styles.successTitle}>Booking Confirmed!</Text>
            <Text style={styles.successSubtitle}>Your spot is reserved</Text>
          </View>

          <Animated.View style={[styles.contentContainer, { opacity: fadeAnim }]}>
            {/* Class Details */}
            <View style={styles.classDetails}>
              <Text style={styles.className}>{classInstance.template.name}</Text>
              <Text style={styles.classDate}>{date}</Text>
              <Text style={styles.classTime}>{time}</Text>
              <Text style={styles.instructor}>
                with {classInstance.instructor.first_name} {classInstance.instructor.last_name}
              </Text>
            </View>

            {/* Credits Remaining */}
            {creditsRemaining !== undefined && (
              <View style={styles.creditsContainer}>
                <Ionicons name="star" size={20} color="#FF9800" />
                <Text style={styles.creditsText}>
                  {creditsRemaining} credit{creditsRemaining !== 1 ? 's' : ''} remaining
                </Text>
              </View>
            )}

            {/* QR Code */}
            <View style={styles.qrContainer}>
              <Text style={styles.qrTitle}>Check-in QR Code</Text>
              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={qrCodeData}
                  size={120}
                  backgroundColor="white"
                />
              </View>
              <Text style={styles.qrSubtitle}>Show this at the studio</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleAddToCalendar}
              >
                <Ionicons name="calendar" size={20} color="white" />
                <Text style={styles.primaryButtonText}>Add to Calendar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton]}
                onPress={handleInviteFriends}
              >
                <Ionicons name="share" size={20} color="#007AFF" />
                <Text style={styles.secondaryButtonText}>Invite Friends</Text>
              </TouchableOpacity>

              {onViewSchedule && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.secondaryButton]}
                  onPress={() => {
                    handleClose();
                    onViewSchedule();
                  }}
                >
                  <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                  <Text style={styles.secondaryButtonText}>View My Schedule</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionButton, styles.doneButton]}
                onPress={handleClose}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: Math.min(screenWidth - 40, 400),
    maxHeight: '90%',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
    zIndex: 1,
  },
  successContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  checkmarkContainer: {
    marginBottom: 15,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  contentContainer: {
    padding: 20,
  },
  classDetails: {
    alignItems: 'center',
    marginBottom: 25,
  },
  className: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  classDate: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  classTime: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  instructor: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  creditsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginBottom: 25,
  },
  creditsText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9800',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  qrTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  qrCodeWrapper: {
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 10,
  },
  qrSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#f0f0f0',
    marginTop: 8,
  },
  doneButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BookingConfirmationModal;