import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING } from '../../utils/config';
import { classesApi, ClassTemplate } from '../../api/classes';
import Button from '../common/Button';

interface TemplateFormData {
  name: string;
  description: string;
  duration_minutes: number;
  capacity: number;
  level: string;
  day_of_week: string;
  start_time: string;
}

const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'all_levels', label: 'All Levels' },
];

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const DURATION_OPTIONS = [45, 60, 75, 90];
const CAPACITY_OPTIONS = [8, 10, 12, 15, 20];

const TemplatesTab: React.FC = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ClassTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  const [showInactiveTemplates, setShowInactiveTemplates] = useState(false);
  
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    duration_minutes: 60,
    capacity: 12,
    level: 'all_levels',
    day_of_week: 'monday',
    start_time: '09:00',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const queryClient = useQueryClient();

  // Fetch templates
  const {
    data: templates = [],
    isLoading,
    refetch,
  } = useQuery<ClassTemplate[]>({
    queryKey: ['classTemplates'],
    queryFn: () => classesApi.getTemplates(),
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: (templateData: Omit<ClassTemplate, 'id' | 'created_at' | 'updated_at' | 'is_active'>) =>
      classesApi.createTemplate(templateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classTemplates'] });
      Alert.alert('Success', 'Template created successfully');
      handleCloseModal();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create template');
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ClassTemplate> }) =>
      classesApi.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classTemplates'] });
      Alert.alert('Success', 'Template updated successfully');
      handleCloseModal();
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update template');
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: number) => classesApi.deleteTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classTemplates'] });
      Alert.alert('Success', 'Template deleted successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to delete template');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      duration_minutes: 60,
      capacity: 12,
      level: 'all_levels',
      day_of_week: 'monday',
      start_time: '09:00',
    });
    setErrors({});
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingTemplate(null);
    resetForm();
  };

  const handleEditTemplate = (template: ClassTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      duration_minutes: template.duration_minutes,
      capacity: template.capacity,
      level: template.level,
      day_of_week: template.day_of_week,
      start_time: template.start_time,
    });
    setShowCreateModal(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    }

    if (formData.duration_minutes <= 0) {
      newErrors.duration_minutes = 'Duration must be greater than 0';
    }

    if (formData.capacity <= 0) {
      newErrors.capacity = 'Capacity must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const templateData = {
      ...formData,
      description: formData.description.trim() || null,
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        data: templateData,
      });
    } else {
      createTemplateMutation.mutate(templateData as any);
    }
  };

  const handleDeleteTemplate = (template: ClassTemplate) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"? This will mark it as inactive.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTemplateMutation.mutate(template.id),
        },
      ]
    );
  };

  const getFilteredTemplates = () => {
    let filtered = templates.filter(template => {
      if (!showInactiveTemplates && !template.is_active) return false;
      if (searchQuery && !template.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterLevel && template.level !== filterLevel) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      // Active templates first
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      // Then by name
      return a.name.localeCompare(b.name);
    });
  };

  const filteredTemplates = getFilteredTemplates();

  const renderTemplateCard = (template: ClassTemplate) => (
    <View key={template.id} style={[styles.templateCard, !template.is_active && styles.inactiveTemplate]}>
      <View style={styles.templateHeader}>
        <View style={styles.templateInfo}>
          <Text style={[styles.templateName, !template.is_active && styles.inactiveText]}>
            {template.name}
          </Text>
          {template.description && (
            <Text style={[styles.templateDescription, !template.is_active && styles.inactiveText]}>
              {template.description}
            </Text>
          )}
        </View>
        <View style={styles.templateActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditTemplate(template)}
          >
            <Ionicons name="create-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteTemplate(template)}
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.templateDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.detailText}>{template.duration_minutes} min</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="people-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.detailText}>{template.capacity} spots</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="fitness-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.detailText}>{template.level.replace('_', ' ')}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.detailText}>
            {DAYS_OF_WEEK.find(d => d.value === template.day_of_week)?.label}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="alarm-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.detailText}>{template.start_time}</Text>
        </View>
      </View>

      {!template.is_active && (
        <View style={styles.inactiveOverlay}>
          <Text style={styles.inactiveLabel}>Inactive</Text>
        </View>
      )}
    </View>
  );

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCloseModal}
    >
      <View style={styles.modalContainer}>
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={handleCloseModal}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {editingTemplate ? 'Edit Template' : 'Create Template'}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {/* Name */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Template Name *</Text>
            <TextInput
              style={[styles.formInput, errors.name && styles.errorInput]}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Enter template name"
              placeholderTextColor={COLORS.textSecondary}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Description */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              placeholder="Describe the class (optional)"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          {/* Duration */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Duration (minutes) *</Text>
            <View style={styles.optionsRow}>
              {DURATION_OPTIONS.map((duration) => (
                <TouchableOpacity
                  key={duration}
                  style={[
                    styles.optionButton,
                    formData.duration_minutes === duration && styles.selectedOption,
                  ]}
                  onPress={() => setFormData({ ...formData, duration_minutes: duration })}
                >
                  <Text style={[
                    styles.optionText,
                    formData.duration_minutes === duration && styles.selectedOptionText,
                  ]}>
                    {duration}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.duration_minutes && <Text style={styles.errorText}>{errors.duration_minutes}</Text>}
          </View>

          {/* Capacity */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Capacity *</Text>
            <View style={styles.optionsRow}>
              {CAPACITY_OPTIONS.map((capacity) => (
                <TouchableOpacity
                  key={capacity}
                  style={[
                    styles.optionButton,
                    formData.capacity === capacity && styles.selectedOption,
                  ]}
                  onPress={() => setFormData({ ...formData, capacity })}
                >
                  <Text style={[
                    styles.optionText,
                    formData.capacity === capacity && styles.selectedOptionText,
                  ]}>
                    {capacity}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.capacity && <Text style={styles.errorText}>{errors.capacity}</Text>}
          </View>

          {/* Level */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Level</Text>
            <View style={styles.optionsColumn}>
              {LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.levelOption,
                    formData.level === level.value && styles.selectedLevelOption,
                  ]}
                  onPress={() => setFormData({ ...formData, level: level.value })}
                >
                  <Text style={[
                    styles.levelOptionText,
                    formData.level === level.value && styles.selectedLevelOptionText,
                  ]}>
                    {level.label}
                  </Text>
                  {formData.level === level.value && (
                    <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Day of Week */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Default Day</Text>
            <View style={styles.optionsColumn}>
              {DAYS_OF_WEEK.map((day) => (
                <TouchableOpacity
                  key={day.value}
                  style={[
                    styles.levelOption,
                    formData.day_of_week === day.value && styles.selectedLevelOption,
                  ]}
                  onPress={() => setFormData({ ...formData, day_of_week: day.value })}
                >
                  <Text style={[
                    styles.levelOptionText,
                    formData.day_of_week === day.value && styles.selectedLevelOptionText,
                  ]}>
                    {day.label}
                  </Text>
                  {formData.day_of_week === day.value && (
                    <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Start Time */}
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Default Start Time</Text>
            <TextInput
              style={styles.formInput}
              value={formData.start_time}
              onChangeText={(text) => setFormData({ ...formData, start_time: text })}
              placeholder="HH:MM (24-hour format)"
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>
        </ScrollView>

        {/* Modal Footer */}
        <View style={styles.modalFooter}>
          <Button
            title={editingTemplate ? 'Update Template' : 'Create Template'}
            onPress={handleSubmit}
            loading={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search templates..."
            placeholderTextColor={COLORS.textSecondary}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
        
        <View style={styles.headerControls}>
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Show Inactive</Text>
            <Switch
              value={showInactiveTemplates}
              onValueChange={setShowInactiveTemplates}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '50' }}
              thumbColor={showInactiveTemplates ? COLORS.primary : COLORS.surface}
            />
          </View>
          
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={20} color={COLORS.white} />
            <Text style={styles.createButtonText}>New Template</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Templates List */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.templatesContainer}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading templates...</Text>
          </View>
        ) : filteredTemplates.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="layers-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyStateTitle}>No templates found</Text>
            <Text style={styles.emptyStateText}>
              {templates.length === 0 
                ? 'Create your first class template to get started'
                : 'No templates match your current filters'
              }
            </Text>
          </View>
        ) : (
          filteredTemplates.map(renderTemplateCard)
        )}
      </ScrollView>

      {renderCreateModal()}
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
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  toggleLabel: {
    fontSize: 14,
    color: COLORS.text,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  createButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  templatesContainer: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  templateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  inactiveTemplate: {
    opacity: 0.7,
    borderStyle: 'dashed',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  templateInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  templateName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  templateDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  inactiveText: {
    color: COLORS.textSecondary,
  },
  templateActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    padding: SPACING.sm,
    borderRadius: 6,
    backgroundColor: COLORS.background,
  },
  templateDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  inactiveOverlay: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.warning,
    borderRadius: 4,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  inactiveLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.white,
    textTransform: 'uppercase',
  },
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    maxWidth: 280,
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  placeholder: {
    width: 24,
  },
  modalContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  formSection: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  formInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  errorInput: {
    borderColor: COLORS.error,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  optionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  optionsColumn: {
    gap: SPACING.sm,
  },
  optionButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  selectedOption: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  optionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  selectedOptionText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  levelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedLevelOption: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  levelOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  selectedLevelOptionText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  modalFooter: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

export default TemplatesTab;