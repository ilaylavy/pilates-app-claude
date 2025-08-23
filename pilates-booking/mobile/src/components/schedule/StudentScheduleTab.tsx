import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { COLORS, SPACING } from '../../utils/config';
import { classesApi } from '../../api/classes';
import { ClassInstance } from '../../types';
import ClassCard from '../ClassCard';
import ClassDetailsModal from '../ClassDetailsModal';

type ViewMode = 'week' | 'month';

const StudentScheduleTab: React.FC = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedClass, setSelectedClass] = useState<ClassInstance | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
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

  const handleMonthDayPress = (day: Date) => {
    // Switch to week view and navigate to the week containing this day
    setViewMode('week');
    setCurrentWeek(day);
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
                <Text style={[styles.dayName, isToday && styles.todayText]}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={[styles.dayDate, isToday && styles.todayText]}>
                  {day.getDate()}
                </Text>
              </View>
              
              <View style={styles.dayClasses}>
                {dayClasses.length === 0 ? (
                  <View style={styles.emptyDay}>
                    <Text style={styles.emptyDayText}>No classes</Text>
                  </View>
                ) : (
                  dayClasses.map((classInstance) => (
                    <TouchableOpacity
                      key={classInstance.id}
                      style={styles.classItem}
                      onPress={() => handleClassPress(classInstance)}
                    >
                      <View style={styles.classTime}>
                        <Text style={styles.classTimeText}>
                          {new Date(classInstance.start_datetime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </Text>
                      </View>
                      <View style={styles.classInfo}>
                        <Text style={styles.classTitle}>{classInstance.template?.name}</Text>
                        <Text style={styles.classInstructor}>
                          {classInstance.instructor?.first_name} {classInstance.instructor?.last_name}
                        </Text>
                      </View>
                      <View style={styles.classCapacity}>
                        <Text style={styles.capacityText}>
                          {classInstance.participant_count || 0}/{(classInstance.participant_count || 0) + (classInstance.available_spots || 0)}
                        </Text>
                        <View style={[
                          styles.capacityDot,
                          {
                            backgroundColor: classInstance.is_full 
                              ? COLORS.error 
                              : (classInstance.participant_count || 0) > ((classInstance.participant_count || 0) + (classInstance.available_spots || 0)) * 0.8 
                                ? COLORS.warning 
                                : COLORS.success
                          }
                        ]} />
                      </View>
                    </TouchableOpacity>
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
        {viewMode === 'week' ? renderWeekHeader() : renderMonthHeader()}
        {renderViewModeToggle()}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {error ? (
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  todayHeader: {
    backgroundColor: COLORS.primary + '10',
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    minWidth: 60,
  },
  dayDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
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
});

export default StudentScheduleTab;