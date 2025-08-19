import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { COLORS, SPACING } from '../utils/config';
import ClassCard from './ClassCard';
import { classesApi } from '../api/classes';
import { ClassInstance } from '../types';
import { useUserRole } from '../hooks/useUserRole';

interface CalendarViewProps {
  onClassPress?: (classInstance: ClassInstance) => void;
  onEditClass?: (classInstance: ClassInstance) => void;
  onDeleteClass?: (classInstance: ClassInstance) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  onClassPress,
  onEditClass,
  onDeleteClass,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const { isAdmin } = useUserRole();

  // Fetch classes for current month
  const {
    data: classes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['classes', 'month', currentMonth.getFullYear(), currentMonth.getMonth() + 1],
    queryFn: () => classesApi.getMonthClasses(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
  });

  // Create marked dates for calendar
  const getMarkedDates = useCallback(() => {
    const marked: { [key: string]: any } = {};
    
    classes.forEach((classInstance) => {
      const date = new Date(classInstance.start_datetime).toISOString().split('T')[0];
      
      if (!marked[date]) {
        marked[date] = {
          dots: [],
          selected: false,
          selectedColor: undefined,
        };
      }
      
      // Add dot based on class type/level
      const dotColor = getClassTypeColor(classInstance.template.level);
      marked[date].dots.push({
        color: dotColor,
        selectedDotColor: COLORS.white,
      });
    });

    // Mark selected date
    if (selectedDate) {
      if (marked[selectedDate]) {
        marked[selectedDate].selected = true;
        marked[selectedDate].selectedColor = COLORS.primary;
      } else {
        marked[selectedDate] = {
          selected: true,
          selectedColor: COLORS.primary,
          dots: [],
        };
      }
    }

    return marked;
  }, [classes, selectedDate]);

  const getClassTypeColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return COLORS.success;
      case 'intermediate':
        return COLORS.warning;
      case 'advanced':
        return COLORS.error;
      default:
        return COLORS.primary;
    }
  };

  const getClassesForDate = (date: string) => {
    const targetDate = new Date(date).toDateString();
    return classes.filter(classInstance => {
      const classDate = new Date(classInstance.start_datetime).toDateString();
      return classDate === targetDate;
    }).sort((a, b) => 
      new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
    );
  };

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    const dayClasses = getClassesForDate(day.dateString);
    if (dayClasses.length > 0) {
      setDayModalVisible(true);
    }
  };

  const handleMonthChange = (month: DateData) => {
    setCurrentMonth(new Date(month.year, month.month - 1));
  };

  const handleLongPress = (day: DateData) => {
    if (isAdmin) {
      // Handle admin long press to add class
      Alert.alert(
        'Add Class',
        `Add a new class for ${new Date(day.dateString).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        })}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Class', onPress: () => console.log('Add class for', day.dateString) }
        ]
      );
    }
  };

  const formatModalTitle = () => {
    if (!selectedDate) return '';
    return new Date(selectedDate).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={COLORS.error} />
        <Text style={styles.errorText}>Failed to load calendar data</Text>
      </View>
    );
  }

  const selectedDateClasses = selectedDate ? getClassesForDate(selectedDate) : [];

  return (
    <View style={styles.container}>
      <Calendar
        current={currentMonth.toISOString()}
        onDayPress={handleDayPress}
        onDayLongPress={handleLongPress}
        onMonthChange={handleMonthChange}
        markingType="multi-dot"
        markedDates={getMarkedDates()}
        theme={{
          backgroundColor: COLORS.background,
          calendarBackground: COLORS.white,
          textSectionTitleColor: COLORS.textSecondary,
          selectedDayBackgroundColor: COLORS.primary,
          selectedDayTextColor: COLORS.white,
          todayTextColor: COLORS.primary,
          dayTextColor: COLORS.text,
          textDisabledColor: COLORS.lightGray,
          dotColor: COLORS.primary,
          selectedDotColor: COLORS.white,
          arrowColor: COLORS.primary,
          disabledArrowColor: COLORS.lightGray,
          monthTextColor: COLORS.text,
          indicatorColor: COLORS.primary,
          textDayFontWeight: '400',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '600',
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 14,
        }}
        firstDay={1} // Monday as first day
        showWeekNumbers={false}
        hideExtraDays={true}
        enableSwipeMonths={true}
      />

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Class Levels:</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
            <Text style={styles.legendText}>Beginner</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.warning }]} />
            <Text style={styles.legendText}>Intermediate</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.error }]} />
            <Text style={styles.legendText}>Advanced</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
            <Text style={styles.legendText}>All Levels</Text>
          </View>
        </View>
        {isAdmin && (
          <Text style={styles.adminHint}>
            Long press on a date to add a new class
          </Text>
        )}
      </View>

      {/* Day Classes Modal */}
      <Modal
        visible={dayModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDayModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{formatModalTitle()}</Text>
            <TouchableOpacity
              onPress={() => setDayModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            {selectedDateClasses.length === 0 ? (
              <View style={styles.emptyModalContainer}>
                <Ionicons name="calendar-outline" size={48} color={COLORS.textSecondary} />
                <Text style={styles.emptyModalText}>No classes scheduled for this day</Text>
              </View>
            ) : (
              selectedDateClasses.map((classInstance) => (
                <ClassCard
                  key={classInstance.id}
                  classInstance={classInstance}
                  onPress={() => {
                    setDayModalVisible(false);
                    onClassPress?.(classInstance);
                  }}
                  onEdit={() => {
                    setDayModalVisible(false);
                    onEditClass?.(classInstance);
                  }}
                  onDelete={onDeleteClass}
                />
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  legend: {
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  adminHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: SPACING.lg,
  },
  emptyModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyModalText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
});

export default CalendarView;