import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING } from '../../utils/config';
import { classesApi, ClassTemplate } from '../../api/classes';
import { adminApi } from '../../api/admin';
import Button from '../common/Button';

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

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Mon', full: 'Monday' },
  { id: 'tuesday', label: 'Tue', full: 'Tuesday' },
  { id: 'wednesday', label: 'Wed', full: 'Wednesday' },
  { id: 'thursday', label: 'Thu', full: 'Thursday' },
  { id: 'friday', label: 'Fri', full: 'Friday' },
  { id: 'saturday', label: 'Sat', full: 'Saturday' },
  { id: 'sunday', label: 'Sun', full: 'Sunday' },
];

const BulkActionsTab: React.FC = () => {
  const [operationType, setOperationType] = useState<'recurring' | 'duplicate'>('recurring');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<BulkOperationData>({
    template_id: '',
    instructor_id: '',
    start_date: new Date(),
    end_date: (() => {
      const date = new Date();
      date.setDate(date.getDate() + 28); // 4 weeks ahead
      return date;
    })(),
    selected_days: ['monday', 'wednesday', 'friday'],
    start_time: '09:00',
    duration_minutes: 60,
    actual_capacity: '',
    notes: '',
    skip_holidays: true,
  });

  const queryClient = useQueryClient();

  // Fetch class templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<ClassTemplate[]>({
    queryKey: ['classTemplates'],
    queryFn: () => classesApi.getTemplates(),
  });

  // Fetch instructors
  const { data: instructorsData = [], isLoading: instructorsLoading } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => adminApi.getUsers({ role: 'instructor' }),
  });

  const instructors: Instructor[] = instructorsData;

  // Bulk create classes mutation
  const bulkCreateMutation = useMutation({
    mutationFn: async (classes: any[]) => {
      const results = [];
      let successful = 0;
      let failed = 0;

      for (const classData of classes) {
        try {
          const result = await classesApi.createClass(classData);
          results.push({ success: true, data: result });
          successful++;
        } catch (error) {
          results.push({ success: false, error });
          failed++;
        }
      }

      return { results, successful, failed };
    },
    onSuccess: ({ successful, failed }) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      Alert.alert(
        'Bulk Operation Complete',
        `Successfully created ${successful} classes.${failed > 0 ? ` ${failed} failed.` : ''}`,
        [{ text: 'OK' }]
      );
      resetForm();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.detail || 'Failed to create classes';
      Alert.alert('Error', errorMessage);
    },
  });

  const resetForm = () => {
    setFormData({
      template_id: '',
      instructor_id: '',
      start_date: new Date(),
      end_date: (() => {
        const date = new Date();
        date.setDate(date.getDate() + 28);
        return date;
      })(),
      selected_days: ['monday', 'wednesday', 'friday'],
      start_time: '09:00',
      duration_minutes: 60,
      actual_capacity: '',
      notes: '',
      skip_holidays: true,
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.template_id) {
      newErrors.template_id = 'Please select a class template';
    }

    if (!formData.instructor_id) {
      newErrors.instructor_id = 'Please select an instructor';
    }

    if (formData.start_date >= formData.end_date) {
      newErrors.date_range = 'End date must be after start date';
    }

    if (formData.selected_days.length === 0) {
      newErrors.selected_days = 'Please select at least one day of the week';
    }

    if (formData.actual_capacity && parseInt(formData.actual_capacity) <= 0) {
      newErrors.actual_capacity = 'Capacity must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateClasses = (): any[] => {
    const classes = [];
    const current = new Date(formData.start_date);
    const end = new Date(formData.end_date);

    const selectedTemplate = templates.find(t => t.id.toString() === formData.template_id);
    if (!selectedTemplate) return [];

    while (current <= end) {
      const dayOfWeek = DAYS_OF_WEEK[current.getDay() === 0 ? 6 : current.getDay() - 1]?.id;
      
      if (formData.selected_days.includes(dayOfWeek)) {
        const [hours, minutes] = formData.start_time.split(':').map(Number);
        const classStart = new Date(current);
        classStart.setHours(hours, minutes, 0, 0);

        const classEnd = new Date(classStart);
        classEnd.setMinutes(classEnd.getMinutes() + (formData.duration_minutes || selectedTemplate.duration_minutes));

        // Skip if it's in the past
        if (classStart > new Date()) {
          classes.push({
            template_id: parseInt(formData.template_id),
            instructor_id: parseInt(formData.instructor_id),
            start_datetime: classStart.toISOString(),
            end_datetime: classEnd.toISOString(),
            actual_capacity: formData.actual_capacity ? parseInt(formData.actual_capacity) : undefined,
            notes: formData.notes || undefined,
          });
        }
      }
      
      current.setDate(current.getDate() + 1);
    }

    return classes;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const classesToCreate = generateClasses();
    
    if (classesToCreate.length === 0) {
      Alert.alert('No Classes to Create', 'No classes would be created with the current settings.');
      return;
    }

    Alert.alert(
      'Confirm Bulk Operation',
      `This will create ${classesToCreate.length} classes. Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: () => bulkCreateMutation.mutate(classesToCreate),
        },
      ]
    );
  };

  const handleDayToggle = (dayId: string) => {
    const newSelectedDays = formData.selected_days.includes(dayId)
      ? formData.selected_days.filter(d => d !== dayId)
      : [...formData.selected_days, dayId];
    
    setFormData({ ...formData, selected_days: newSelectedDays });
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setFormData({ ...formData, start_date: selectedDate });
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setFormData({ ...formData, end_date: selectedDate });
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const timeString = selectedTime.toTimeString().slice(0, 5);
      setFormData({ ...formData, start_time: timeString });
    }
  };

  const getPreviewCount = () => {
    return generateClasses().length;
  };

  const selectedTemplate = templates.find(t => t.id.toString() === formData.template_id);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Operation Type Toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Operation Type</Text>
        <View style={styles.operationTypeContainer}>
          <TouchableOpacity
            style={[styles.operationTypeButton, operationType === 'recurring' && styles.selectedOperationType]}
            onPress={() => setOperationType('recurring')}
          >
            <Ionicons
              name="repeat"
              size={20}
              color={operationType === 'recurring' ? COLORS.white : COLORS.textSecondary}
            />
            <Text style={[
              styles.operationTypeText,
              operationType === 'recurring' && styles.selectedOperationTypeText
            ]}>
              Recurring Classes
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.operationTypeButton, operationType === 'duplicate' && styles.selectedOperationType]}
            onPress={() => setOperationType('duplicate')}
          >
            <Ionicons
              name="copy"
              size={20}
              color={operationType === 'duplicate' ? COLORS.white : COLORS.textSecondary}
            />
            <Text style={[
              styles.operationTypeText,
              operationType === 'duplicate' && styles.selectedOperationTypeText
            ]}>
              Duplicate Classes
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {operationType === 'recurring' && (
        <>
          {/* Template Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Class Template *</Text>
            {templatesLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading templates...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.templatesContainer}
              >
                {templates.filter(t => t.is_active).map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={[
                      styles.templateCard,
                      formData.template_id === template.id.toString() && styles.selectedTemplate,
                    ]}
                    onPress={() => setFormData({ 
                      ...formData, 
                      template_id: template.id.toString(),
                      duration_minutes: template.duration_minutes 
                    })}
                  >
                    <Text style={[
                      styles.templateName,
                      formData.template_id === template.id.toString() && styles.selectedTemplateText,
                    ]}>
                      {template.name}
                    </Text>
                    <Text style={[
                      styles.templateDetails,
                      formData.template_id === template.id.toString() && styles.selectedTemplateText,
                    ]}>
                      {template.duration_minutes}min • {template.capacity} spots
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {errors.template_id && <Text style={styles.errorText}>{errors.template_id}</Text>}
          </View>

          {/* Instructor Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructor *</Text>
            {instructorsLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading instructors...</Text>
              </View>
            ) : (
              <View style={styles.instructorsGrid}>
                {instructors.map((instructor) => (
                  <TouchableOpacity
                    key={instructor.id}
                    style={[
                      styles.instructorCard,
                      formData.instructor_id === instructor.id.toString() && styles.selectedInstructor,
                    ]}
                    onPress={() => setFormData({ ...formData, instructor_id: instructor.id.toString() })}
                  >
                    <Text style={[
                      styles.instructorName,
                      formData.instructor_id === instructor.id.toString() && styles.selectedInstructorText,
                    ]}>
                      {instructor.first_name} {instructor.last_name}
                    </Text>
                    {formData.instructor_id === instructor.id.toString() && (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {errors.instructor_id && <Text style={styles.errorText}>{errors.instructor_id}</Text>}
          </View>

          {/* Date Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date Range *</Text>
            <View style={styles.dateRangeContainer}>
              <TouchableOpacity
                style={[styles.dateButton, { flex: 1, marginRight: SPACING.sm }]}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.dateLabel}>Start Date</Text>
                <View style={styles.dateContent}>
                  <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.dateText}>
                    {formData.start_date.toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dateButton, { flex: 1 }]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={styles.dateLabel}>End Date</Text>
                <View style={styles.dateContent}>
                  <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.dateText}>
                    {formData.end_date.toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            {errors.date_range && <Text style={styles.errorText}>{errors.date_range}</Text>}
          </View>

          {/* Days of Week */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Days of the Week *</Text>
            <View style={styles.daysContainer}>
              {DAYS_OF_WEEK.map((day) => (
                <TouchableOpacity
                  key={day.id}
                  style={[
                    styles.dayButton,
                    formData.selected_days.includes(day.id) && styles.selectedDay,
                  ]}
                  onPress={() => handleDayToggle(day.id)}
                >
                  <Text style={[
                    styles.dayText,
                    formData.selected_days.includes(day.id) && styles.selectedDayText,
                  ]}>
                    {day.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.selected_days && <Text style={styles.errorText}>{errors.selected_days}</Text>}
          </View>

          {/* Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Class Time *</Text>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Ionicons name="time-outline" size={20} color={COLORS.primary} />
              <Text style={styles.timeText}>{formData.start_time}</Text>
              <Text style={styles.durationText}>
                ({formData.duration_minutes || selectedTemplate?.duration_minutes || 60} minutes)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Custom Capacity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Custom Capacity (Optional)</Text>
            <TextInput
              style={styles.input}
              value={formData.actual_capacity}
              onChangeText={(text) => setFormData({ ...formData, actual_capacity: text })}
              placeholder={selectedTemplate ? `Default: ${selectedTemplate.capacity}` : 'Enter capacity'}
              keyboardType="numeric"
              placeholderTextColor={COLORS.textSecondary}
            />
            {errors.actual_capacity && <Text style={styles.errorText}>{errors.actual_capacity}</Text>}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              placeholder="Add notes for all created classes"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          {/* Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Options</Text>
            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>Skip holidays</Text>
              <Switch
                value={formData.skip_holidays}
                onValueChange={(value) => setFormData({ ...formData, skip_holidays: value })}
                trackColor={{ false: COLORS.border, true: COLORS.primary + '50' }}
                thumbColor={formData.skip_holidays ? COLORS.primary : COLORS.surface}
              />
            </View>
          </View>

          {/* Preview */}
          <View style={styles.previewSection}>
            <View style={styles.previewHeader}>
              <Ionicons name="eye-outline" size={20} color={COLORS.primary} />
              <Text style={styles.previewTitle}>Preview</Text>
            </View>
            <Text style={styles.previewText}>
              This will create <Text style={styles.previewCount}>{getPreviewCount()}</Text> classes
            </Text>
            <Text style={styles.previewDetails}>
              From {formData.start_date.toLocaleDateString()} to {formData.end_date.toLocaleDateString()}
            </Text>
          </View>

          {/* Create Button */}
          <View style={styles.createSection}>
            <Button
              title={`Create ${getPreviewCount()} Classes`}
              onPress={handleSubmit}
              loading={bulkCreateMutation.isPending}
              disabled={bulkCreateMutation.isPending || getPreviewCount() === 0}
              style={styles.createButton}
            />
          </View>
        </>
      )}

      {operationType === 'duplicate' && (
        <View style={styles.comingSoonContainer}>
          <Ionicons name="construct-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.comingSoonTitle}>Duplicate Classes</Text>
          <Text style={styles.comingSoonText}>
            This feature is coming soon. You'll be able to duplicate existing classes to new dates.
          </Text>
        </View>
      )}

      {/* Date/Time Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={formData.start_date}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={handleStartDateChange}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={formData.end_date}
          mode="date"
          display="default"
          minimumDate={formData.start_date}
          onChange={handleEndDateChange}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={new Date(`2000-01-01T${formData.start_time}:00`)}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  operationTypeContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  operationTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  selectedOperationType: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  operationTypeText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  selectedOperationTypeText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
  },
  templatesContainer: {
    paddingRight: SPACING.lg,
  },
  templateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginRight: SPACING.sm,
    minWidth: 150,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  selectedTemplate: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  selectedTemplateText: {
    color: COLORS.primary,
  },
  templateDetails: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  instructorsGrid: {
    gap: SPACING.sm,
  },
  instructorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedInstructor: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  instructorName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  selectedInstructorText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  dateRangeContainer: {
    flexDirection: 'row',
  },
  dateButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  dateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dateText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  dayButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 50,
    alignItems: 'center',
  },
  selectedDay: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  selectedDayText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  timeText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
  },
  durationText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 'auto',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  previewSection: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 12,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  previewText: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  previewCount: {
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  previewDetails: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  createSection: {
    marginTop: SPACING.lg,
  },
  createButton: {
    backgroundColor: COLORS.success,
  },
  comingSoonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  comingSoonText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
});

export default BulkActionsTab;