import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';

import { COLORS, SPACING } from '../utils/config';
import { AdminGuard } from '../components/AdminGuard';
import { classesApi, ClassTemplate } from '../api/classes';
import { adminApi } from '../api/admin';
import { ClassInstance } from '../types';

interface Instructor {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

interface EditClassRouteParams {
  classInstance: ClassInstance;
}

const EditClassScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { classInstance } = route.params as EditClassRouteParams;
  
  const [formData, setFormData] = useState({
    template_id: classInstance.template_id.toString(),
    instructor_id: classInstance.instructor_id.toString(),
    start_datetime: new Date(classInstance.start_datetime),
    duration_minutes: Math.round((new Date(classInstance.end_datetime).getTime() - new Date(classInstance.start_datetime).getTime()) / (1000 * 60)),
    actual_capacity: classInstance.actual_capacity?.toString() || '',
    notes: classInstance.notes || '',
    status: classInstance.status,
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch class templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<ClassTemplate[]>({
    queryKey: ['classTemplates'],
    queryFn: () => classesApi.getTemplates(),
  });

  // Fetch instructors (admin + instructor roles)
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'instructors'],
    queryFn: () => adminApi.getUsers({ role: undefined, limit: 100 }),
  });

  // Filter users to get only instructors and admins
  const instructors = users.filter(user => 
    user.role === 'instructor' || user.role === 'admin'
  ) as Instructor[];

  interface ClassUpdateData {
    template_id?: number;
    instructor_id?: number;
    start_datetime?: string;
    end_datetime?: string;
    status?: string;
    actual_capacity?: number | null;
    notes?: string | null;
  }

  // Update class mutation
  const updateClassMutation = useMutation({
    mutationFn: async () => {
      // Calculate end_datetime based on duration
      const endDateTime = new Date(formData.start_datetime);
      endDateTime.setMinutes(endDateTime.getMinutes() + formData.duration_minutes);
      
      const updatePayload: ClassUpdateData = {
        template_id: parseInt(formData.template_id),
        instructor_id: parseInt(formData.instructor_id),
        start_datetime: formData.start_datetime.toISOString(),
        end_datetime: endDateTime.toISOString(),
        status: formData.status,
        actual_capacity: formData.actual_capacity ? parseInt(formData.actual_capacity) : null,
        notes: formData.notes || null,
      };
      
      return classesApi.updateClass(classInstance.id, updatePayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      Alert.alert(
        'Success', 
        'Class updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          }
        ]
      );
    },
    onError: (error: unknown) => {
      console.error('Update class error:', error);
      const errorMessage = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to update class'
        : 'Failed to update class';
      Alert.alert('Error', errorMessage);
    },
  });

  // Update form data when template is selected
  useEffect(() => {
    if (formData.template_id) {
      const selectedTemplate = templates.find(t => t.id === parseInt(formData.template_id));
      if (selectedTemplate && !formData.actual_capacity) {
        setFormData(prev => ({
          ...prev,
          actual_capacity: selectedTemplate.capacity.toString(),
        }));
      }
    }
  }, [formData.template_id, templates, formData.actual_capacity]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.template_id) {
      newErrors.template_id = 'Please select a class template';
    }
    
    if (!formData.instructor_id) {
      newErrors.instructor_id = 'Please select an instructor';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }
    
    updateClassMutation.mutate();
  };

  const handleCancel = () => {
    Alert.alert(
      'Discard Changes',
      'Are you sure you want to discard your changes?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
  };

  const onDateChange = (_event: unknown, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(formData.start_datetime);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setFormData(prev => ({ ...prev, start_datetime: newDate }));
    }
  };

  const onTimeChange = (_event: unknown, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(formData.start_datetime);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setFormData(prev => ({ ...prev, start_datetime: newDate }));
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSelectedTemplate = () => {
    return templates.find(t => t.id === parseInt(formData.template_id));
  };


  const getOriginalStartTime = () => {
    return new Date(classInstance.start_datetime);
  };

  const getOriginalEndTime = () => {
    return new Date(classInstance.end_datetime);
  };

  const hasUnsavedChanges = () => {
    const originalEndTime = getOriginalEndTime();
    const originalDuration = Math.round((originalEndTime.getTime() - new Date(classInstance.start_datetime).getTime()) / (1000 * 60));
    
    return (
      formData.template_id !== classInstance.template_id.toString() ||
      formData.instructor_id !== classInstance.instructor_id.toString() ||
      formData.start_datetime.getTime() !== new Date(classInstance.start_datetime).getTime() ||
      formData.duration_minutes !== originalDuration ||
      formData.actual_capacity !== (classInstance.actual_capacity?.toString() || '') ||
      formData.notes !== (classInstance.notes || '') ||
      formData.status !== classInstance.status
    );
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
          <TouchableOpacity onPress={hasUnsavedChanges() ? handleCancel : () => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Class</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Original Class Info */}
          <View style={styles.originalInfoCard}>
            <Text style={styles.originalInfoTitle}>Original Class Details</Text>
            <View style={styles.originalInfoRow}>
              <Text style={styles.originalInfoLabel}>Class:</Text>
              <Text style={styles.originalInfoValue}>{classInstance.template.name}</Text>
            </View>
            <View style={styles.originalInfoRow}>
              <Text style={styles.originalInfoLabel}>Instructor:</Text>
              <Text style={styles.originalInfoValue}>
                {classInstance.instructor.first_name} {classInstance.instructor.last_name}
              </Text>
            </View>
            <View style={styles.originalInfoRow}>
              <Text style={styles.originalInfoLabel}>Original Time:</Text>
              <Text style={styles.originalInfoValue}>
                {formatDate(getOriginalStartTime())} at {formatTime(getOriginalStartTime())}
              </Text>
            </View>
            <View style={styles.originalInfoRow}>
              <Text style={styles.originalInfoLabel}>Status:</Text>
              <Text style={[styles.originalInfoValue, { 
                color: classInstance.status === 'scheduled' ? COLORS.success : 
                       classInstance.status === 'cancelled' ? COLORS.error : COLORS.textSecondary 
              }]}>
                {classInstance.status.charAt(0).toUpperCase() + classInstance.status.slice(1)}
              </Text>
            </View>
          </View>

          {/* Class Template Selection */}
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
                  onPress={() => setFormData(prev => ({ ...prev, template_id: template.id.toString() }))}
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
                  <Text style={[
                    styles.templateDetails,
                    formData.template_id === template.id.toString() && styles.templateDetailsSelected
                  ]}>
                    Capacity: {template.capacity}
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

          {/* Date & Time Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule</Text>
            
            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowDatePicker(true)}
            >
              <View style={styles.dateTimeInfo}>
                <Ionicons name="calendar" size={20} color={COLORS.primary} />
                <Text style={styles.dateTimeLabel}>Date</Text>
              </View>
              <Text style={styles.dateTimeValue}>{formatDate(formData.start_datetime)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateTimeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <View style={styles.dateTimeInfo}>
                <Ionicons name="time" size={20} color={COLORS.primary} />
                <Text style={styles.dateTimeLabel}>Time</Text>
              </View>
              <Text style={styles.dateTimeValue}>{formatTime(formData.start_datetime)}</Text>
            </TouchableOpacity>
          </View>

          {/* Class Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Class Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Duration (minutes)</Text>
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

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Class Capacity (optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.actual_capacity}
                onChangeText={(text) => setFormData(prev => ({ ...prev, actual_capacity: text }))}
                keyboardType="numeric"
                placeholder={getSelectedTemplate()?.capacity.toString() || "Enter capacity"}
              />
              <Text style={styles.inputNote}>
                Leave empty to use template default ({getSelectedTemplate()?.capacity || 'N/A'})
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Class Status</Text>
              <View style={styles.statusOptions}>
                {['scheduled', 'cancelled', 'completed'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      formData.status === status && styles.statusOptionSelected
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, status }))}
                  >
                    <Text style={[
                      styles.statusText,
                      formData.status === status && styles.statusTextSelected
                    ]}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.notes}
                onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
                placeholder="Add any special notes for this class..."
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Changes Summary */}
          {hasUnsavedChanges() && (
            <View style={styles.changesCard}>
              <Text style={styles.changesTitle}>Pending Changes</Text>
              <Text style={styles.changesNote}>
                You have unsaved changes. Review and save to apply them.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={hasUnsavedChanges() ? handleCancel : () => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>
              {hasUnsavedChanges() ? 'Cancel' : 'Back'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.button, 
              styles.saveButton,
              !hasUnsavedChanges() && styles.saveButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={updateClassMutation.isPending || !hasUnsavedChanges()}
          >
            {updateClassMutation.isPending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={[
                styles.saveButtonText,
                !hasUnsavedChanges() && styles.saveButtonTextDisabled
              ]}>
                Save Changes
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Date/Time Pickers */}
        {showDatePicker && (
          <DateTimePicker
            value={formData.start_datetime}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={formData.start_datetime}
            mode="time"
            display="default"
            onChange={onTimeChange}
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
  originalInfoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  originalInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  originalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  originalInfoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  originalInfoValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
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
  templateScroll: {
    marginHorizontal: -SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  templateCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginRight: SPACING.md,
    width: 180,
    borderWidth: 2,
    borderColor: COLORS.lightGray,
  },
  templateCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  templateName: {
    fontSize: 16,
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
    marginBottom: 2,
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
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  dateTimeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dateTimeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  dateTimeValue: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    color: COLORS.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  statusOptions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statusOption: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  statusOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusTextSelected: {
    color: COLORS.white,
  },
  changesCard: {
    backgroundColor: COLORS.warning + '20',
    borderRadius: 12,
    padding: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
    marginBottom: SPACING.lg,
  },
  changesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.warning,
    marginBottom: SPACING.xs,
  },
  changesNote: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
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
  cancelButton: {
    backgroundColor: COLORS.lightGray,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.lightGray,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  saveButtonTextDisabled: {
    color: COLORS.textSecondary,
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

export default EditClassScreen;