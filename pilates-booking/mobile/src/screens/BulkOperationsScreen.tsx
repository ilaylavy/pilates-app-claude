import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';

import { COLORS, SPACING } from '../utils/config';
import { AdminGuard } from '../components/AdminGuard';
import { classesApi, ClassTemplate } from '../api/classes';
import { adminApi } from '../api/admin';

interface Instructor {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

interface BulkOperationData {
  template_id: string;
  instructor_id: string;
  start_date: Date;
  end_date: Date;
  selected_days: string[];
  start_time: string;
  duration_minutes: number;
  actual_capacity: string;
  notes: string;
  skip_holidays: boolean;
}

const BulkOperationsScreen: React.FC = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  
  const [operationType, setOperationType] = useState<'recurring' | 'bulk'>('recurring');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  const [formData, setFormData] = useState<BulkOperationData>({
    template_id: '',
    instructor_id: '',
    start_date: new Date(),
    end_date: (() => {
      const date = new Date();
      date.setMonth(date.getMonth() + 1);
      return date;
    })(),
    selected_days: ['monday'],
    start_time: '09:00',
    duration_minutes: 60,
    actual_capacity: '',
    notes: '',
    skip_holidays: true,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewClasses, setPreviewClasses] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<ClassTemplate[]>({
    queryKey: ['classTemplates'],
    queryFn: () => classesApi.getTemplates(),
  });

  // Fetch instructors
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'instructors'],
    queryFn: () => adminApi.getUsers({ role: undefined, limit: 100 }),
  });

  const instructors = users.filter(user => 
    user.role === 'instructor' || user.role === 'admin'
  ) as Instructor[];

  // Bulk create mutation
  const bulkCreateMutation = useMutation({
    mutationFn: async (classesData: any[]) => {
      const results = [];
      for (const classData of classesData) {
        try {
          const result = await classesApi.createClass(classData);
          results.push({ success: true, class: result });
        } catch (error) {
          results.push({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            classData 
          });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      Alert.alert(
        'Bulk Operation Complete',
        `Successfully created ${successful} classes.${failed > 0 ? ` ${failed} failed.` : ''}`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          }
        ]
      );
    },
    onError: (error: unknown) => {
      const errorMessage = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to create classes'
        : 'Failed to create classes';
      Alert.alert('Error', errorMessage);
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.template_id) {
      newErrors.template_id = 'Please select a class template';
    }
    
    if (!formData.instructor_id) {
      newErrors.instructor_id = 'Please select an instructor';
    }
    
    if (formData.selected_days.length === 0) {
      newErrors.selected_days = 'Please select at least one day';
    }
    
    if (formData.start_date >= formData.end_date) {
      newErrors.date_range = 'End date must be after start date';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateClassSchedule = () => {
    const classes = [];
    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);
    
    // Get day indices (0 = Sunday, 1 = Monday, etc.)
    const dayMap: { [key: string]: number } = {
      'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6
    };
    
    const selectedDayIndices = formData.selected_days.map(day => dayMap[day]);
    
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
      if (selectedDayIndices.includes(date.getDay())) {
        // Create datetime for this class
        const [hours, minutes] = formData.start_time.split(':').map(Number);
        const classDateTime = new Date(date);
        classDateTime.setHours(hours, minutes, 0, 0);
        
        // Skip if it's in the past
        if (classDateTime <= new Date()) continue;
        
        // Calculate end time
        const endDateTime = new Date(classDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + formData.duration_minutes);
        
        classes.push({
          template_id: parseInt(formData.template_id),
          instructor_id: parseInt(formData.instructor_id),
          start_datetime: classDateTime.toISOString(),
          end_datetime: endDateTime.toISOString(),
          actual_capacity: formData.actual_capacity ? parseInt(formData.actual_capacity) : null,
          notes: formData.notes || null,
        });
      }
    }
    
    return classes;
  };

  const handlePreview = () => {
    if (!validateForm()) return;
    
    const classes = generateClassSchedule();
    setPreviewClasses(classes);
    setShowPreview(true);
  };

  const handleCreateClasses = () => {
    if (!validateForm()) return;
    
    const classes = generateClassSchedule();
    
    if (classes.length === 0) {
      Alert.alert('No Classes', 'No classes would be created with the current settings.');
      return;
    }
    
    Alert.alert(
      'Confirm Bulk Creation',
      `This will create ${classes.length} classes. Do you want to continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: () => bulkCreateMutation.mutate(classes),
        },
      ]
    );
  };

  const onStartDateChange = (_event: unknown, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setFormData(prev => ({ ...prev, start_date: selectedDate }));
    }
  };

  const onEndDateChange = (_event: unknown, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setFormData(prev => ({ ...prev, end_date: selectedDate }));
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getSelectedTemplate = () => {
    return templates.find(t => t.id === parseInt(formData.template_id));
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      selected_days: prev.selected_days.includes(day)
        ? prev.selected_days.filter(d => d !== day)
        : [...prev.selected_days, day]
    }));
  };

  if (templatesLoading || usersLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AdminGuard requiredRoles={['admin']}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bulk Operations</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Operation Type Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Operation Type</Text>
            <View style={styles.operationTypes}>
              <TouchableOpacity
                style={[
                  styles.operationTypeCard,
                  operationType === 'recurring' && styles.operationTypeCardSelected
                ]}
                onPress={() => setOperationType('recurring')}
              >
                <Ionicons 
                  name="repeat" 
                  size={24} 
                  color={operationType === 'recurring' ? COLORS.primary : COLORS.textSecondary} 
                />
                <Text style={[
                  styles.operationTypeTitle,
                  operationType === 'recurring' && styles.operationTypeSelectedText
                ]}>
                  Recurring Classes
                </Text>
                <Text style={[
                  styles.operationTypeDescription,
                  operationType === 'recurring' && styles.operationTypeSelectedText
                ]}>
                  Create classes that repeat weekly
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.operationTypeCard,
                  operationType === 'bulk' && styles.operationTypeCardSelected
                ]}
                onPress={() => setOperationType('bulk')}
              >
                <Ionicons 
                  name="calendar" 
                  size={24} 
                  color={operationType === 'bulk' ? COLORS.primary : COLORS.textSecondary} 
                />
                <Text style={[
                  styles.operationTypeTitle,
                  operationType === 'bulk' && styles.operationTypeSelectedText
                ]}>
                  Bulk Creation
                </Text>
                <Text style={[
                  styles.operationTypeDescription,
                  operationType === 'bulk' && styles.operationTypeSelectedText
                ]}>
                  Create multiple classes at once
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Template Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Class Template</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
              {templates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    styles.templateCard,
                    formData.template_id === template.id.toString() && styles.templateCardSelected
                  ]}
                  onPress={() => setFormData(prev => ({ 
                    ...prev, 
                    template_id: template.id.toString(),
                    duration_minutes: template.duration_minutes,
                    actual_capacity: template.capacity.toString(),
                  }))}
                >
                  <Text style={[
                    styles.templateName,
                    formData.template_id === template.id.toString() && styles.templateNameSelected
                  ]}>
                    {template.name}
                  </Text>
                  <Text style={[
                    styles.templateDetails,
                    formData.template_id === template.id.toString() && styles.templateDetailsSelected
                  ]}>
                    {template.duration_minutes}min • {template.level}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {errors.template_id && <Text style={styles.errorText}>{errors.template_id}</Text>}
          </View>

          {/* Instructor Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructor</Text>
            <View style={styles.pickerContainer}>
              {instructors.map((instructor) => (
                <TouchableOpacity
                  key={instructor.id}
                  style={[
                    styles.instructorOption,
                    formData.instructor_id === instructor.id.toString() && styles.instructorOptionSelected
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, instructor_id: instructor.id.toString() }))}
                >
                  <View style={styles.instructorInfo}>
                    <Text style={[
                      styles.instructorName,
                      formData.instructor_id === instructor.id.toString() && styles.instructorNameSelected
                    ]}>
                      {instructor.first_name} {instructor.last_name}
                    </Text>
                    <Text style={[
                      styles.instructorEmail,
                      formData.instructor_id === instructor.id.toString() && styles.instructorEmailSelected
                    ]}>
                      {instructor.email}
                    </Text>
                  </View>
                  {formData.instructor_id === instructor.id.toString() && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {errors.instructor_id && <Text style={styles.errorText}>{errors.instructor_id}</Text>}
          </View>

          {/* Date Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date Range</Text>
            
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={[styles.dateButton, { flex: 1, marginRight: SPACING.sm }]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.dateLabel}>Start Date</Text>
                <Text style={styles.dateValue}>{formatDate(formData.start_date)}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateButton, { flex: 1, marginLeft: SPACING.sm }]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={styles.dateLabel}>End Date</Text>
                <Text style={styles.dateValue}>{formatDate(formData.end_date)}</Text>
              </TouchableOpacity>
            </View>
            {errors.date_range && <Text style={styles.errorText}>{errors.date_range}</Text>}
          </View>

          {/* Days of Week */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Days of the Week</Text>
            <View style={styles.daysContainer}>
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayChip,
                    formData.selected_days.includes(day) && styles.dayChipSelected
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[
                    styles.dayChipText,
                    formData.selected_days.includes(day) && styles.dayChipTextSelected
                  ]}>
                    {day.slice(0, 3).toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.selected_days && <Text style={styles.errorText}>{errors.selected_days}</Text>}
          </View>

          {/* Time and Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Class Settings</Text>
            
            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: SPACING.sm }]}>
                <Text style={styles.inputLabel}>Start Time</Text>
                <TextInput
                  style={styles.input}
                  value={formData.start_time}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, start_time: text }))}
                  placeholder="09:00"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: SPACING.sm }]}>
                <Text style={styles.inputLabel}>Duration (min)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.duration_minutes.toString()}
                  onChangeText={(text) => setFormData(prev => ({ 
                    ...prev, 
                    duration_minutes: parseInt(text) || 60 
                  }))}
                  keyboardType="numeric"
                  placeholder="60"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Capacity (optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.actual_capacity}
                onChangeText={(text) => setFormData(prev => ({ ...prev, actual_capacity: text }))}
                keyboardType="numeric"
                placeholder={getSelectedTemplate()?.capacity.toString() || "12"}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                placeholder="Add notes for all classes..."
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Skip holidays</Text>
              <Switch
                value={formData.skip_holidays}
                onValueChange={(value) => setFormData(prev => ({ ...prev, skip_holidays: value }))}
                trackColor={{ false: COLORS.lightGray, true: COLORS.primary }}
              />
            </View>
          </View>

          {/* Preview Section */}
          {showPreview && previewClasses.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Preview ({previewClasses.length} classes)</Text>
              <ScrollView style={styles.previewContainer} nestedScrollEnabled>
                {previewClasses.slice(0, 10).map((classData, index) => (
                  <View key={index} style={styles.previewItem}>
                    <Text style={styles.previewDate}>
                      {new Date(classData.start_datetime).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                    <Text style={styles.previewTime}>
                      {new Date(classData.start_datetime).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                ))}
                {previewClasses.length > 10 && (
                  <Text style={styles.previewMore}>
                    ... and {previewClasses.length - 10} more
                  </Text>
                )}
              </ScrollView>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.previewButton]}
            onPress={handlePreview}
          >
            <Text style={styles.previewButtonText}>Preview</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.createButton]}
            onPress={handleCreateClasses}
            disabled={bulkCreateMutation.isPending}
          >
            {bulkCreateMutation.isPending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.createButtonText}>Create Classes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Date Pickers */}
        {showStartDatePicker && (
          <DateTimePicker
            value={formData.start_date}
            mode="date"
            display="default"
            onChange={onStartDateChange}
            minimumDate={new Date()}
          />
        )}

        {showEndDatePicker && (
          <DateTimePicker
            value={formData.end_date}
            mode="date"
            display="default"
            onChange={onEndDateChange}
            minimumDate={formData.start_date}
          />
        )}
      </SafeAreaView>
    </AdminGuard>
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
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  operationTypes: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  operationTypeCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.lightGray,
  },
  operationTypeCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  operationTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  operationTypeDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  operationTypeSelectedText: {
    color: COLORS.primary,
  },
  templateScroll: {
    marginHorizontal: -SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  templateCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginRight: SPACING.md,
    width: 160,
    borderWidth: 2,
    borderColor: COLORS.lightGray,
  },
  templateCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  templateName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  templateNameSelected: {
    color: COLORS.primary,
  },
  templateDetails: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  templateDetailsSelected: {
    color: COLORS.primary,
  },
  pickerContainer: {
    gap: SPACING.sm,
  },
  instructorOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  instructorOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  instructorInfo: {
    flex: 1,
  },
  instructorName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  instructorNameSelected: {
    color: COLORS.primary,
  },
  instructorEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  instructorEmailSelected: {
    color: COLORS.primary,
  },
  dateRow: {
    flexDirection: 'row',
  },
  dateButton: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  dateLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  dayChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  dayChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  dayChipTextSelected: {
    color: COLORS.white,
  },
  inputRow: {
    flexDirection: 'row',
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    color: COLORS.text,
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  switchLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  previewContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    maxHeight: 200,
  },
  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  previewDate: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  previewTime: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  previewMore: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingTop: SPACING.sm,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButton: {
    backgroundColor: COLORS.lightGray,
  },
  previewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  createButton: {
    backgroundColor: COLORS.primary,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});

export default BulkOperationsScreen;