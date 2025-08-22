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

const AddClassScreen: React.FC = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    template_id: '',
    instructor_id: '',
    start_datetime: new Date(),
    duration_minutes: 60,
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

  interface ClassFormData {
    template_id: string;
    instructor_id: string;
    start_datetime: Date;
    duration_minutes: number;
    actual_capacity: string;
    notes: string;
  }

  // Create class mutation
  const createClassMutation = useMutation({
    mutationFn: async (classData: ClassFormData) => {
      // Calculate end_datetime based on duration
      const endDateTime = new Date(classData.start_datetime);
      endDateTime.setMinutes(endDateTime.getMinutes() + classData.duration_minutes);
      
      const createData = {
        template_id: parseInt(classData.template_id),
        instructor_id: parseInt(classData.instructor_id),
        start_datetime: classData.start_datetime.toISOString(),
        end_datetime: endDateTime.toISOString(),
        actual_capacity: classData.actual_capacity ? parseInt(classData.actual_capacity) : null,
        notes: classData.notes || null,
      };
      
      return classesApi.createClass(createData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      Alert.alert(
        'Success', 
        'Class created successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          }
        ]
      );
    },
    onError: (error: unknown) => {
      console.error('Create class error:', error);
      const errorMessage = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to create class'
        : 'Failed to create class';
      Alert.alert('Error', errorMessage);
    },
  });

  // Update form data when template is selected
  useEffect(() => {
    if (formData.template_id) {
      const selectedTemplate = templates.find(t => t.id === parseInt(formData.template_id));
      if (selectedTemplate) {
        setFormData(prev => ({
          ...prev,
          duration_minutes: selectedTemplate.duration_minutes,
          actual_capacity: selectedTemplate.capacity.toString(),
        }));
      }
    }
  }, [formData.template_id, templates]);

  const validateForm = () => {
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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }
    
    createClassMutation.mutate(formData);
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

  const getSelectedInstructor = () => {
    return instructors.find(i => i.id === parseInt(formData.instructor_id));
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
          <Text style={styles.headerTitle}>Add New Class</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
            
            {errors.start_datetime && <Text style={styles.errorText}>{errors.start_datetime}</Text>}
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

          {/* Summary Card */}
          {formData.template_id && formData.instructor_id && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Class Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Class:</Text>
                <Text style={styles.summaryValue}>{getSelectedTemplate()?.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Instructor:</Text>
                <Text style={styles.summaryValue}>
                  {getSelectedInstructor()?.first_name} {getSelectedInstructor()?.last_name}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Date:</Text>
                <Text style={styles.summaryValue}>{formatDate(formData.start_datetime)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Time:</Text>
                <Text style={styles.summaryValue}>
                  {formatTime(formData.start_datetime)} - {formatTime(new Date(formData.start_datetime.getTime() + formData.duration_minutes * 60000))}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Capacity:</Text>
                <Text style={styles.summaryValue}>
                  {formData.actual_capacity || getSelectedTemplate()?.capacity} students
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.createButton]}
            onPress={handleSubmit}
            disabled={createClassMutation.isPending}
          >
            {createClassMutation.isPending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.createButtonText}>Create Class</Text>
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
            minimumDate={new Date()}
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
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    marginBottom: SPACING.lg,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
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

export default AddClassScreen;