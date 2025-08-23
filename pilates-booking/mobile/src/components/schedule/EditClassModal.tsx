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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import { COLORS, SPACING } from '../../utils/config';
import { classesApi, ClassTemplate } from '../../api/classes';
import { adminApi } from '../../api/admin';
import { ClassInstance } from '../../types';
import Button from '../common/Button';

interface EditClassModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classInstance: ClassInstance | null;
}

interface Instructor {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

const EditClassModal: React.FC<EditClassModalProps> = ({
  visible,
  onClose,
  onSuccess,
  classInstance,
}) => {
  const [formData, setFormData] = useState({
    template_id: '',
    instructor_id: '',
    start_datetime: new Date(),
    end_datetime: new Date(),
    actual_capacity: '',
    notes: '',
    status: 'scheduled',
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

  // Initialize form data when classInstance changes
  useEffect(() => {
    if (classInstance && visible) {
      setFormData({
        template_id: classInstance.template_id?.toString() || '',
        instructor_id: classInstance.instructor_id?.toString() || '',
        start_datetime: new Date(classInstance.start_datetime),
        end_datetime: new Date(classInstance.end_datetime),
        actual_capacity: classInstance.actual_capacity?.toString() || '',
        notes: classInstance.notes || '',
        status: classInstance.status || 'scheduled',
      });
    }
  }, [classInstance, visible]);

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

  // Fetch admins
  const { data: adminsData = [], isLoading: adminsLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: () => adminApi.getUsers({ role: 'admin' }),
    enabled: visible,
  });

  // Combine instructors and admins
  const instructors: Instructor[] = [...instructorsData, ...adminsData];

  // Update class mutation
  const updateClassMutation = useMutation({
    mutationFn: (classData: any) => {
      if (!classInstance) throw new Error('No class instance');
      return classesApi.updateClass(classInstance.id, classData);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Class updated successfully');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.detail || 'Failed to update class';
      Alert.alert('Error', errorMessage);
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.template_id) {
      newErrors.template_id = 'Please select a class template';
    }

    if (!formData.instructor_id) {
      newErrors.instructor_id = 'Please select an instructor';
    }

    if (formData.start_datetime >= formData.end_datetime) {
      newErrors.datetime = 'End time must be after start time';
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

    const classData = {
      template_id: parseInt(formData.template_id),
      instructor_id: parseInt(formData.instructor_id),
      start_datetime: formData.start_datetime.toISOString(),
      end_datetime: formData.end_datetime.toISOString(),
      actual_capacity: formData.actual_capacity ? parseInt(formData.actual_capacity) : undefined,
      notes: formData.notes || undefined,
      status: formData.status,
    };

    updateClassMutation.mutate(classData);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newStartDate = new Date(selectedDate);
      newStartDate.setHours(formData.start_datetime.getHours());
      newStartDate.setMinutes(formData.start_datetime.getMinutes());
      
      const duration = formData.end_datetime.getTime() - formData.start_datetime.getTime();
      const newEndDate = new Date(newStartDate.getTime() + duration);
      
      setFormData({ 
        ...formData, 
        start_datetime: newStartDate,
        end_datetime: newEndDate
      });
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newStartDate = new Date(formData.start_datetime);
      newStartDate.setHours(selectedTime.getHours());
      newStartDate.setMinutes(selectedTime.getMinutes());
      
      const duration = formData.end_datetime.getTime() - formData.start_datetime.getTime();
      const newEndDate = new Date(newStartDate.getTime() + duration);
      
      setFormData({ 
        ...formData, 
        start_datetime: newStartDate,
        end_datetime: newEndDate
      });
    }
  };

  const selectedTemplate = templates.find(t => t.id.toString() === formData.template_id);

  if (!classInstance) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Class</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
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
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {errors.template_id && <Text style={styles.errorText}>{errors.template_id}</Text>}
          </View>

          {/* Instructor Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Instructor *</Text>
            {(instructorsLoading || adminsLoading) ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading instructors and admins...</Text>
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
                      {instructor.role === 'admin' && (
                        <Text style={styles.roleIndicator}> (Admin)</Text>
                      )}
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

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date & Time *</Text>
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                <Text style={styles.dateTimeText}>
                  {formData.start_datetime.toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                <Text style={styles.dateTimeText}>
                  {formData.start_datetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
            {errors.datetime && <Text style={styles.errorText}>{errors.datetime}</Text>}
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
              placeholder="Add notes for this class"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          {/* Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.statusContainer}>
              {['scheduled', 'cancelled', 'completed'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusButton,
                    formData.status === status && styles.selectedStatus,
                  ]}
                  onPress={() => setFormData({ ...formData, status })}
                >
                  <Text style={[
                    styles.statusText,
                    formData.status === status && styles.selectedStatusText,
                  ]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title="Update Class"
            onPress={handleSubmit}
            loading={updateClassMutation.isPending}
            disabled={updateClassMutation.isPending}
            style={styles.updateButton}
          />
        </View>

        {/* Date/Time Pickers */}
        {showDatePicker && (
          <DateTimePicker
            value={formData.start_datetime}
            mode="date"
            display="default"
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
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
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
  roleIndicator: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  dateTimeContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  dateTimeButton: {
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
  dateTimeText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
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
  statusContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statusButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  selectedStatus: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  selectedStatusText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  actions: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  updateButton: {
    backgroundColor: COLORS.primary,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
});

export default EditClassModal;