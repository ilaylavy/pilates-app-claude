import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { COLORS, SPACING } from '../../utils/config';
import { classesApi } from '../../api/classes';
import { adminApi } from '../../api/admin';
import { useUserRole } from '../../hooks/useUserRole';
import { ClassInstance } from '../../types';
import ClassCard from '../ClassCard';
import QuickAddClassModal from './QuickAddClassModal';
import ClassDetailsModal from '../ClassDetailsModal';

type ViewMode = 'week' | 'day' | 'list';

interface ScheduleFilter {
  instructor?: string;
  template?: string;
  status?: string;
}

const ScheduleTab: React.FC = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedClass, setSelectedClass] = useState<ClassInstance | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<ScheduleFilter>({});
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const { isAdmin, isInstructor } = useUserRole();
  const queryClient = useQueryClient();

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
    queryKey: ['classes', 'week', weekStart.toISOString().split('T')[0]],
    queryFn: () => classesApi.getWeekClasses(weekStart.toISOString().split('T')[0]),
  });

  // Fetch instructors for filtering
  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => adminApi.getUsers({ role: 'instructor' }),
    enabled: isAdmin,
  });

  // Fetch templates for filtering
  const { data: templates = [] } = useQuery({
    queryKey: ['classTemplates'],
    queryFn: () => classesApi.getTemplates(),
    enabled: isAdmin,
  });

  // Delete class mutation
  const deleteClassMutation = useMutation({
    mutationFn: (classId: number) => classesApi.deleteClass(classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      Alert.alert('Success', 'Class deleted successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to delete class');
    },
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

  const applyFilters = (classList: ClassInstance[]) => {
    return classList.filter(cls => {
      if (filters.instructor && cls.instructor_id.toString() !== filters.instructor) return false;
      if (filters.template && cls.template_id.toString() !== filters.template) return false;
      if (filters.status && cls.status !== filters.status) return false;
      return true;
    });
  };

  const filteredClasses = applyFilters(classes);

  const handleClassPress = (classInstance: ClassInstance) => {
    setSelectedClass(classInstance);
    setShowDetailsModal(true);
  };

  const handleDeleteClass = (classId: number) => {
    Alert.alert(
      'Delete Class',
      'Are you sure you want to delete this class? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteClassMutation.mutate(classId),
        },
      ]
    );
  };

  const renderViewModeToggle = () => (
    <View style={styles.viewModeContainer}>
      {(['week', 'day', 'list'] as ViewMode[]).map((mode) => (
        <TouchableOpacity
          key={mode}
          style={[styles.viewModeButton, viewMode === mode && styles.activeViewMode]}
          onPress={() => setViewMode(mode)}
        >
          <Ionicons
            name={mode === 'week' ? 'calendar' : mode === 'day' ? 'today' : 'list'}
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

  const renderWeekView = () => {
    const daysOfWeek = getDaysOfWeek();
    
    return (
      <ScrollView style={styles.weekView} showsVerticalScrollIndicator={false}>
        {daysOfWeek.map((day, index) => {
          const dayClasses = getClassesForDay(day);
          const isToday = day.toDateString() === new Date().toDateString();
          
          return (
            <View key={index} style={styles.dayContainer}>
              <View style={[styles.dayHeader, isToday && styles.todayHeader]}>
                <Text style={[styles.dayName, isToday && styles.todayText]}>
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={[styles.dayDate, isToday && styles.todayText]}>
                  {day.getDate()}
                </Text>
                {(isAdmin || isInstructor) && (
                  <TouchableOpacity 
                    style={styles.addClassButton}
                    onPress={() => setShowQuickAdd(true)}
                  >
                    <Ionicons name="add" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
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
                      onLongPress={() => isAdmin && handleDeleteClass(classInstance.id)}
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
                          {classInstance.participant_count || 0}/{classInstance.capacity || 12}
                        </Text>
                        <View style={[
                          styles.capacityDot,
                          {
                            backgroundColor: classInstance.is_full 
                              ? COLORS.error 
                              : (classInstance.participant_count || 0) > (classInstance.capacity || 12) * 0.8 
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

  const renderListView = () => (
    <ScrollView style={styles.listView} showsVerticalScrollIndicator={false}>
      {filteredClasses.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyStateTitle}>No classes found</Text>
          <Text style={styles.emptyStateText}>
            {classes.length === 0 ? 'No classes scheduled for this week' : 'No classes match your filters'}
          </Text>
        </View>
      ) : (
        <View style={styles.classesGrid}>
          {filteredClasses.map((classInstance) => (
            <ClassCard
              key={classInstance.id}
              classInstance={classInstance}
              onPress={() => handleClassPress(classInstance)}
              showBookingButton={false}
              showAdminActions={isAdmin}
              onDelete={() => handleDeleteClass(classInstance.id)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );

  const renderFilters = () => (
    <Modal visible={showFilters} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.filtersModal}>
        <View style={styles.filtersHeader}>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.filtersTitle}>Filters</Text>
          <TouchableOpacity onPress={() => setFilters({})}>
            <Text style={styles.clearFilters}>Clear</Text>
          </TouchableOpacity>
        </View>
        
        {/* Filter options would go here */}
        <ScrollView style={styles.filtersContent}>
          <Text style={styles.filterSection}>Filter options coming soon...</Text>
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header Controls */}
      <View style={styles.header}>
        {renderWeekHeader()}
        {renderViewModeToggle()}
        
        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="filter" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
          
          {(isAdmin || isInstructor) && (
            <TouchableOpacity
              style={[styles.controlButton, styles.primaryButton]}
              onPress={() => setShowQuickAdd(true)}
            >
              <Ionicons name="add" size={20} color={COLORS.white} />
              <Text style={styles.primaryButtonText}>Add Class</Text>
            </TouchableOpacity>
          )}
        </View>
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
          renderListView()
        )}
      </View>

      {/* Modals */}
      <QuickAddClassModal
        visible={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSuccess={() => {
          setShowQuickAdd(false);
          refetch();
        }}
      />

      {selectedClass && (
        <ClassDetailsModal
          visible={showDetailsModal}
          classInstance={selectedClass}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedClass(null);
          }}
          showAdminActions={isAdmin}
        />
      )}

      {renderFilters()}
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
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    gap: SPACING.xs,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
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
  addClassButton: {
    marginLeft: 'auto',
    padding: SPACING.xs,
    borderRadius: 6,
    backgroundColor: COLORS.primary + '15',
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
  listView: {
    flex: 1,
    padding: SPACING.lg,
  },
  classesGrid: {
    gap: SPACING.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
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
  filtersModal: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filtersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  clearFilters: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  filtersContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  filterSection: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
});

export default ScheduleTab;