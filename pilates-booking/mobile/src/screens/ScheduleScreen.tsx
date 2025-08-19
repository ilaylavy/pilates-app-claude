import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING } from '../utils/config';
import ClassCard from '../components/ClassCard';
import CalendarView from '../components/CalendarView';
import ClassDetailsModal from '../components/ClassDetailsModal';
import FloatingActionButton from '../components/FloatingActionButton';
import { ClassCardSkeleton } from '../components/SkeletonLoader';
import { useUserRole } from '../hooks/useUserRole';
import { classesApi } from '../api/classes';
import { ClassInstance } from '../types';

const ScheduleScreen: React.FC = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showCalendarView, setShowCalendarView] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassInstance | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [filterInstructor, setFilterInstructor] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const slideAnimation = useRef(new Animated.Value(0)).current;

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

  const formatWeekRange = () => {
    const start = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  };

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

  const handlePreviousWeek = () => {
    Animated.timing(slideAnimation, {
      toValue: -1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      const prevWeek = new Date(currentWeek);
      prevWeek.setDate(currentWeek.getDate() - 7);
      setCurrentWeek(prevWeek);
      slideAnimation.setValue(1);
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNextWeek = () => {
    Animated.timing(slideAnimation, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      const nextWeek = new Date(currentWeek);
      nextWeek.setDate(currentWeek.getDate() + 7);
      setCurrentWeek(nextWeek);
      slideAnimation.setValue(-1);
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleClassPress = (classInstance: ClassInstance) => {
    setSelectedClass(classInstance);
    setDetailsModalVisible(true);
  };

  const handleEditClass = (classInstance: ClassInstance) => {
    console.log('Edit class:', classInstance.id);
    // TODO: Navigate to edit class screen
  };

  const handleDeleteClass = (classInstance: ClassInstance) => {
    Alert.alert(
      'Delete Class',
      'Are you sure you want to delete this class? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await classesApi.deleteClass(classInstance.id);
              queryClient.invalidateQueries({ queryKey: ['classes'] });
              Alert.alert('Success', 'Class deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete class');
            }
          }
        }
      ]
    );
  };

  const handleAddClass = () => {
    console.log('Add new class');
    // TODO: Navigate to add class screen
  };

  const filterClasses = (classes: ClassInstance[]) => {
    let filtered = classes;
    
    if (filterLevel) {
      filtered = filtered.filter(cls => cls.template.level === filterLevel);
    }
    
    if (filterInstructor) {
      filtered = filtered.filter(cls => 
        `${cls.instructor.first_name} ${cls.instructor.last_name}`.toLowerCase()
        .includes(filterInstructor.toLowerCase())
      );
    }
    
    return filtered;
  };

  const getUniqueInstructors = (classes: ClassInstance[]) => {
    const instructors = new Set<string>();
    classes.forEach(cls => {
      instructors.add(`${cls.instructor.first_name} ${cls.instructor.last_name}`);
    });
    return Array.from(instructors).sort();
  };

  const getUniqueLevels = (classes: ClassInstance[]) => {
    const levels = new Set<string>();
    classes.forEach(cls => {
      levels.add(cls.template.level);
    });
    return Array.from(levels).sort();
  };

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={COLORS.error} />
          <Text style={styles.errorText}>Failed to load classes</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.weekNavigation}>
          <TouchableOpacity onPress={handlePreviousWeek} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          
          <Animated.View 
            style={[
              styles.weekInfo,
              {
                transform: [
                  {
                    translateX: slideAnimation.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [-50, 0, 50],
                    }),
                  },
                ],
                opacity: slideAnimation.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [0.5, 1, 0.5],
                }),
              },
            ]}
          >
            <Text style={styles.weekTitle}>Week of</Text>
            <Text style={styles.weekRange}>{formatWeekRange()}</Text>
          </Animated.View>
          
          <TouchableOpacity onPress={handleNextWeek} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setShowCalendarView(!showCalendarView)}
            style={[styles.toggleButton, showCalendarView && styles.toggleButtonActive]}
          >
            <Ionicons 
              name={showCalendarView ? "list" : "calendar"} 
              size={20} 
              color={showCalendarView ? COLORS.white : COLORS.primary} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={[styles.toggleButton, showFilters && styles.toggleButtonActive]}
          >
            <Ionicons 
              name="filter" 
              size={20} 
              color={showFilters ? COLORS.white : COLORS.primary} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      {showFilters && !showCalendarView && (
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContent}>
            <TouchableOpacity
              style={[styles.filterChip, !filterLevel && styles.filterChipActive]}
              onPress={() => setFilterLevel(null)}
            >
              <Text style={[styles.filterChipText, !filterLevel && styles.filterChipTextActive]}>All Levels</Text>
            </TouchableOpacity>
            
            {getUniqueLevels(classes).map(level => (
              <TouchableOpacity
                key={level}
                style={[styles.filterChip, filterLevel === level && styles.filterChipActive]}
                onPress={() => setFilterLevel(filterLevel === level ? null : level)}
              >
                <Text style={[styles.filterChipText, filterLevel === level && styles.filterChipTextActive]}>
                  {level.charAt(0).toUpperCase() + level.slice(1).replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
            
            <View style={styles.filterDivider} />
            
            <TouchableOpacity
              style={[styles.filterChip, !filterInstructor && styles.filterChipActive]}
              onPress={() => setFilterInstructor(null)}
            >
              <Text style={[styles.filterChipText, !filterInstructor && styles.filterChipTextActive]}>All Instructors</Text>
            </TouchableOpacity>
            
            {getUniqueInstructors(classes).map(instructor => (
              <TouchableOpacity
                key={instructor}
                style={[styles.filterChip, filterInstructor === instructor && styles.filterChipActive]}
                onPress={() => setFilterInstructor(filterInstructor === instructor ? null : instructor)}
              >
                <Text style={[styles.filterChipText, filterInstructor === instructor && styles.filterChipTextActive]}>
                  {instructor}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      {showCalendarView ? (
        <CalendarView
          onClassPress={handleClassPress}
          onEditClass={handleEditClass}
          onDeleteClass={handleDeleteClass}
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
          }
        >
          {isLoading ? (
            <View style={styles.skeletonContainer}>
              <ClassCardSkeleton />
              <ClassCardSkeleton />
              <ClassCardSkeleton />
            </View>
          ) : filterClasses(classes).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {classes.length === 0 
                  ? "No classes scheduled for this week"
                  : "No classes match your filters"
                }
              </Text>
              {isAdmin && classes.length === 0 && (
                <TouchableOpacity onPress={handleAddClass} style={styles.addFirstClassButton}>
                  <Text style={styles.addFirstClassButtonText}>Add First Class</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {/* Group classes by day */}
              {(() => {
                const filteredClasses = filterClasses(classes);
                const groupedClasses = filteredClasses.reduce((groups: { [key: string]: ClassInstance[] }, classInstance) => {
                  const date = new Date(classInstance.start_datetime).toDateString();
                  if (!groups[date]) {
                    groups[date] = [];
                  }
                  groups[date].push(classInstance);
                  return groups;
                }, {});

                return Object.entries(groupedClasses)
                  .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                  .map(([date, dayClasses]) => (
                    <View key={date} style={styles.daySection}>
                      <Text style={styles.dayHeader}>
                        {new Date(date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </Text>
                      {dayClasses
                        .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime())
                        .map((classInstance) => (
                          <ClassCard
                            key={classInstance.id}
                            classInstance={classInstance}
                            onPress={() => handleClassPress(classInstance)}
                            onEdit={() => handleEditClass(classInstance)}
                            onDelete={() => handleDeleteClass(classInstance)}
                          />
                        ))
                      }
                    </View>
                  ));
              })()}
            </>
          )}
        </ScrollView>
      )}
      
      {/* Class Details Modal */}
      <ClassDetailsModal
        visible={detailsModalVisible}
        classInstance={selectedClass}
        onClose={() => {
          setDetailsModalVisible(false);
          setSelectedClass(null);
        }}
        onEdit={() => {
          setDetailsModalVisible(false);
          if (selectedClass) {
            handleEditClass(selectedClass);
          }
        }}
        onDelete={() => {
          setDetailsModalVisible(false);
          if (selectedClass) {
            handleDeleteClass(selectedClass);
          }
        }}
      />

      {/* Floating Action Button (Admin Only) */}
      {isAdmin && !showCalendarView && (
        <FloatingActionButton
          onAddClass={handleAddClass}
          onBatchOperations={() => Alert.alert('Batch Operations', 'Feature coming soon!')}
          onCopyClass={() => Alert.alert('Copy Class', 'Feature coming soon!')}
          onCreateRecurring={() => Alert.alert('Recurring Class', 'Feature coming soon!')}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  weekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  navButton: {
    padding: SPACING.xs,
  },
  weekInfo: {
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  weekRange: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  toggleButton: {
    padding: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.sm,
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  daySection: {
    marginBottom: SPACING.lg,
  },
  dayHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
    paddingLeft: SPACING.sm,
  },
  filtersContainer: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    paddingVertical: SPACING.sm,
  },
  filtersContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  filterDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.lightGray,
    alignSelf: 'center',
    marginHorizontal: SPACING.sm,
  },
  skeletonContainer: {
    paddingVertical: SPACING.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  addFirstClassButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 8,
  },
  addFirstClassButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
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
});

export default ScheduleScreen;