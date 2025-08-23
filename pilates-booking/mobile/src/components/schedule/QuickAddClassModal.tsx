import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING } from '../../utils/config';
import { classesApi, ClassTemplate } from '../../api/classes';
import { adminApi } from '../../api/admin';
import Button from '../common/Button';

interface QuickAddClassModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedDate?: Date;
  preselectedTemplate?: ClassTemplate;
}

interface Instructor {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

const QuickAddClassModal: React.FC<QuickAddClassModalProps> = ({
  visible,
  onClose,
  onSuccess,
  preselectedDate,
  preselectedTemplate,
}) => {
  const [formData, setFormData] = useState({
    template_id: preselectedTemplate?.id.toString() || '',
    instructor_id: '',
    start_datetime: preselectedDate || new Date(),
    actual_capacity: '',
    notes: '',
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch class templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<ClassTemplate[]>({
    queryKey: ['classTemplates'],
    queryFn: () => classesApi.getTemplates(),
    enabled: visible,
  });

  // Fetch instructors
  const { data: instructorsData = [], isLoading: instructorsLoading } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => adminApi.getUsers({ role: 'instructor' }),
    enabled: visible,
  });

  const instructors: Instructor[] = instructorsData;

  // Create class mutation
  const createClassMutation = useMutation({
    mutationFn: (classData: any) => classesApi.createClass(classData),
    onSuccess: () => {
      Alert.alert('Success', 'Class created successfully');
      onSuccess();
      resetForm();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.detail || 'Failed to create class';
      Alert.alert('Error', errorMessage);
    },
  });

  const resetForm = () => {
    setFormData({
      template_id: preselectedTemplate?.id.toString() || '',
      instructor_id: '',
      start_datetime: preselectedDate || new Date(),
      actual_capacity: '',
      notes: '',
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

    if (formData.start_datetime < new Date()) {
      newErrors.start_datetime = 'Class time must be in the future';
    }

    if (formData.actual_capacity && parseInt(formData.actual_capacity) <= 0) {
      newErrors.actual_capacity = 'Capacity must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const selectedTemplate = templates.find(t => t.id.toString() === formData.template_id);
    if (!selectedTemplate) return;

    const endDateTime = new Date(formData.start_datetime);
    endDateTime.setMinutes(endDateTime.getMinutes() + selectedTemplate.duration_minutes);

    const classData = {
      template_id: parseInt(formData.template_id),
      instructor_id: parseInt(formData.instructor_id),
      start_datetime: formData.start_datetime.toISOString(),
      end_datetime: endDateTime.toISOString(),
      actual_capacity: formData.actual_capacity ? parseInt(formData.actual_capacity) : undefined,
      notes: formData.notes || undefined,
    };

    createClassMutation.mutate(classData);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDateTime = new Date(formData.start_datetime);
      newDateTime.setFullYear(selectedDate.getFullYear());
      newDateTime.setMonth(selectedDate.getMonth());
      newDateTime.setDate(selectedDate.getDate());
      setFormData({ ...formData, start_datetime: newDateTime });
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDateTime = new Date(formData.start_datetime);
      newDateTime.setHours(selectedTime.getHours());
      newDateTime.setMinutes(selectedTime.getMinutes());
      setFormData({ ...formData, start_datetime: newDateTime });
    }
  };

  const selectedTemplate = templates.find(t => t.id.toString() === formData.template_id);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Class</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Template Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Class Template *</Text>
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
                {templates.map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={[
                      styles.templateCard,
                      formData.template_id === template.id.toString() && styles.selectedTemplate,
                    ]}
                    onPress={() => setFormData({ ...formData, template_id: template.id.toString() })}
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
                    <Text style={[
                      styles.templateLevel,
                      formData.template_id === template.id.toString() && styles.selectedTemplateText,
                    ]}>
                      {template.level.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {errors.template_id && <Text style={styles.errorText}>{errors.template_id}</Text>}
          </View>

          {/* Instructor Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Instructor *</Text>
            {instructorsLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading instructors...</Text>
              </View>
            ) : (
              <View style={styles.instructorsContainer}>
                {instructors.map((instructor) => (
                  <TouchableOpacity
                    key={instructor.id}
                    style={[
                      styles.instructorItem,
                      formData.instructor_id === instructor.id.toString() && styles.selectedInstructor,
                    ]}
                    onPress={() => setFormData({ ...formData, instructor_id: instructor.id.toString() })}
                  >
                    <View style={styles.instructorInfo}>
                      <Text style={[
                        styles.instructorName,
                        formData.instructor_id === instructor.id.toString() && styles.selectedInstructorText,
                      ]}>
                        {instructor.first_name} {instructor.last_name}
                      </Text>
                      <Text style={[
                        styles.instructorEmail,
                        formData.instructor_id === instructor.id.toString() && styles.selectedInstructorText,
                      ]}>
                        {instructor.email}
                      </Text>
                    </View>
                    {formData.instructor_id === instructor.id.toString() && (
                      <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {errors.instructor_id && <Text style={styles.errorText}>{errors.instructor_id}</Text>}
          </View>

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.label}>Date & Time *</Text>
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity
                style={[styles.dateTimeButton, { flex: 1, marginRight: SPACING.sm }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                <Text style={styles.dateTimeText}>
                  {formData.start_datetime.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.dateTimeButton, { flex: 1 }]}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                <Text style={styles.dateTimeText}>
                  {formData.start_datetime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </Text>
              </TouchableOpacity>
            </View>
            {errors.start_datetime && <Text style={styles.errorText}>{errors.start_datetime}</Text>}
          </View>

          {/* Duration Display */}
          {selectedTemplate && (
            <View style={styles.durationDisplay}>
              <Text style={styles.durationText}>
                Duration: {selectedTemplate.duration_minutes} minutes
              </Text>
              <Text style={styles.endTimeText}>
                Ends at: {new Date(formData.start_datetime.getTime() + selectedTemplate.duration_minutes * 60000).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </Text>
            </View>
          )}

          {/* Capacity Override */}
          <View style={styles.section}>
            <Text style={styles.label}>Custom Capacity (Optional)</Text>
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
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={formData.notes}
              onChangeText={(text) => setFormData({ ...formData, notes: text })}
              placeholder="Add any special notes for this class"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="Create Class"
            onPress={handleSubmit}
            loading={createClassMutation.isPending}
            disabled={createClassMutation.isPending}
            style={styles.createButton}
          />
        </View>

        {/* Date/Time Pickers */}
        {showDatePicker && (
          <DateTimePicker
            value={formData.start_datetime}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={handleDateChange}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={formData.start_datetime}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}
      </View>
    </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  placeholder: {
    width: 24,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
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
    marginBottom: SPACING.xs,
  },
  templateLevel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  instructorsContainer: {
    gap: SPACING.sm,
  },
  instructorItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  instructorInfo: {
    flex: 1,
  },
  instructorName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  selectedInstructorText: {
    color: COLORS.primary,
  },
  instructorEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  dateTimeContainer: {
    flexDirection: 'row',
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  dateTimeText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  durationDisplay: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  durationText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  endTimeText: {
    fontSize: 14,
    color: COLORS.primary,
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
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  footer: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  createButton: {
    backgroundColor: COLORS.primary,
  },
});

export default QuickAddClassModal;