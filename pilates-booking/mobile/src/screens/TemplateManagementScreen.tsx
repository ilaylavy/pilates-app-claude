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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { COLORS, SPACING } from '../utils/config';
import { AdminGuard } from '../components/AdminGuard';
import { classesApi, ClassTemplate } from '../api/classes';

interface TemplateFormData {
  name: string;
  description: string;
  duration_minutes: number;
  capacity: number;
  level: string;
  day_of_week: string;
  start_time: string;
}

const TemplateManagementScreen: React.FC = () => {
  const queryClient = useQueryClient();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ClassTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  
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

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<ClassTemplate[]>({
    queryKey: ['classTemplates'],
    queryFn: () => classesApi.getTemplates(),
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: TemplateFormData) => {
      return classesApi.createTemplate(templateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classTemplates'] });
      setShowCreateModal(false);
      resetForm();
      Alert.alert('Success', 'Template created successfully!');
    },
    onError: (error: unknown) => {
      const errorMessage = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to create template'
        : 'Failed to create template';
      Alert.alert('Error', errorMessage);
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<TemplateFormData> }) => {
      return classesApi.updateTemplate(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classTemplates'] });
      setEditingTemplate(null);
      resetForm();
      Alert.alert('Success', 'Template updated successfully!');
    },
    onError: (error: unknown) => {
      const errorMessage = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to update template'
        : 'Failed to update template';
      Alert.alert('Error', errorMessage);
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      return classesApi.deleteTemplate(templateId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classTemplates'] });
      Alert.alert('Success', 'Template deleted successfully!');
    },
    onError: (error: unknown) => {
      const errorMessage = error && typeof error === 'object' && 'response' in error 
        ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to delete template'
        : 'Failed to delete template';
      Alert.alert('Error', errorMessage);
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    }
    
    if (formData.duration_minutes < 15 || formData.duration_minutes > 180) {
      newErrors.duration_minutes = 'Duration must be between 15 and 180 minutes';
    }
    
    if (formData.capacity < 1 || formData.capacity > 50) {
      newErrors.capacity = 'Capacity must be between 1 and 50';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateTemplate = () => {
    if (!validateForm()) return;
    createTemplateMutation.mutate(formData);
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

  const handleUpdateTemplate = () => {
    if (!validateForm() || !editingTemplate) return;
    updateTemplateMutation.mutate({
      id: editingTemplate.id,
      data: formData,
    });
  };

  const handleDeleteTemplate = (template: ClassTemplate) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"? This action cannot be undone.`,
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

  const handleDuplicateTemplate = (template: ClassTemplate) => {
    setFormData({
      name: `${template.name} (Copy)`,
      description: template.description || '',
      duration_minutes: template.duration_minutes,
      capacity: template.capacity,
      level: template.level,
      day_of_week: template.day_of_week,
      start_time: template.start_time,
    });
    setEditingTemplate(null);
    setShowCreateModal(true);
  };

  const filterTemplates = (templates: ClassTemplate[]) => {
    let filtered = templates;
    
    if (searchQuery) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (filterLevel) {
      filtered = filtered.filter(template => template.level === filterLevel);
    }
    
    return filtered;
  };

  const formatTime = (timeString: string) => {
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return COLORS.success;
      case 'intermediate':
        return COLORS.warning;
      case 'advanced':
        return COLORS.error;
      default:
        return COLORS.primary;
    }
  };

  const uniqueLevels = [...new Set(templates.map(t => t.level))];

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading templates...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <AdminGuard requiredRoles={['admin']}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Class Templates</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setEditingTemplate(null);
              setShowCreateModal(true);
            }}
          >
            <Ionicons name="add" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Search and Filters */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search templates..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterChip, !filterLevel && styles.filterChipActive]}
              onPress={() => setFilterLevel(null)}
            >
              <Text style={[styles.filterChipText, !filterLevel && styles.filterChipTextActive]}>
                All Levels
              </Text>
            </TouchableOpacity>
            
            {uniqueLevels.map(level => (
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
          </ScrollView>
        </View>

        {/* Templates List */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {filterTemplates(templates).length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-outline" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {searchQuery || filterLevel ? "No templates match your filters" : "No templates created yet"}
              </Text>
              {!searchQuery && !filterLevel && (
                <TouchableOpacity
                  style={styles.createFirstButton}
                  onPress={() => {
                    resetForm();
                    setEditingTemplate(null);
                    setShowCreateModal(true);
                  }}
                >
                  <Text style={styles.createFirstButtonText}>Create First Template</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filterTemplates(templates).map((template) => (
              <View key={template.id} style={styles.templateCard}>
                <View style={styles.templateHeader}>
                  <View style={styles.templateTitleContainer}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    <View style={[styles.levelBadge, { backgroundColor: getLevelColor(template.level) }]}>
                      <Text style={styles.levelText}>
                        {template.level.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.templateActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDuplicateTemplate(template)}
                    >
                      <Ionicons name="copy" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditTemplate(template)}
                    >
                      <Ionicons name="pencil" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDeleteTemplate(template)}
                    >
                      <Ionicons name="trash" size={20} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                {template.description && (
                  <Text style={styles.templateDescription}>{template.description}</Text>
                )}

                <View style={styles.templateDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="time" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>{template.duration_minutes} minutes</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="people" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>{template.capacity} capacity</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>
                      {template.day_of_week.charAt(0).toUpperCase() + template.day_of_week.slice(1)}s
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>{formatTime(template.start_time)}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Create/Edit Modal */}
        <Modal
          visible={showCreateModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Template Name *</Text>
                <TextInput
                  style={[styles.formInput, errors.name && styles.formInputError]}
                  value={formData.name}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                  placeholder="Enter template name"
                />
                {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                  placeholder="Enter template description (optional)"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: SPACING.sm }]}>
                  <Text style={styles.formLabel}>Duration (min) *</Text>
                  <TextInput
                    style={[styles.formInput, errors.duration_minutes && styles.formInputError]}
                    value={formData.duration_minutes.toString()}
                    onChangeText={(text) => setFormData(prev => ({ 
                      ...prev, 
                      duration_minutes: parseInt(text) || 0 
                    }))}
                    keyboardType="numeric"
                    placeholder="60"
                  />
                  {errors.duration_minutes && <Text style={styles.errorText}>{errors.duration_minutes}</Text>}
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: SPACING.sm }]}>
                  <Text style={styles.formLabel}>Capacity *</Text>
                  <TextInput
                    style={[styles.formInput, errors.capacity && styles.formInputError]}
                    value={formData.capacity.toString()}
                    onChangeText={(text) => setFormData(prev => ({ 
                      ...prev, 
                      capacity: parseInt(text) || 0 
                    }))}
                    keyboardType="numeric"
                    placeholder="12"
                  />
                  {errors.capacity && <Text style={styles.errorText}>{errors.capacity}</Text>}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Class Level</Text>
                <View style={styles.levelOptions}>
                  {['beginner', 'intermediate', 'advanced', 'all_levels'].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.levelOption,
                        formData.level === level && styles.levelOptionSelected
                      ]}
                      onPress={() => setFormData(prev => ({ ...prev, level }))}
                    >
                      <Text style={[
                        styles.levelOptionText,
                        formData.level === level && styles.levelOptionTextSelected
                      ]}>
                        {level.charAt(0).toUpperCase() + level.slice(1).replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: SPACING.sm }]}>
                  <Text style={styles.formLabel}>Default Day</Text>
                  <View style={styles.dayOptions}>
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dayOption,
                          formData.day_of_week === day && styles.dayOptionSelected
                        ]}
                        onPress={() => setFormData(prev => ({ ...prev, day_of_week: day }))}
                      >
                        <Text style={[
                          styles.dayOptionText,
                          formData.day_of_week === day && styles.dayOptionTextSelected
                        ]}>
                          {day.slice(0, 3).toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: SPACING.sm }]}>
                  <Text style={styles.formLabel}>Default Time</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formData.start_time}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, start_time: text }))}
                    placeholder="09:00"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
              >
                {(createTemplateMutation.isPending || updateTemplateMutation.isPending) ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingTemplate ? 'Update' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: 16,
    color: COLORS.text,
  },
  filterScroll: {
    marginHorizontal: -SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    marginRight: SPACING.sm,
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
  content: {
    flex: 1,
    padding: SPACING.lg,
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
  createFirstButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 8,
  },
  createFirstButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  templateCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  templateTitleContainer: {
    flex: 1,
    marginRight: SPACING.md,
  },
  templateName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  levelText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.white,
  },
  templateActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    padding: SPACING.xs,
  },
  templateDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
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
    fontSize: 12,
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  formGroup: {
    marginBottom: SPACING.lg,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  formInput: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    color: COLORS.text,
  },
  formInputError: {
    borderColor: COLORS.error,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  levelOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  levelOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  levelOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  levelOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  levelOptionTextSelected: {
    color: COLORS.white,
  },
  dayOptions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  dayOption: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  dayOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  dayOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  dayOptionTextSelected: {
    color: COLORS.white,
  },
  modalActions: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 8,
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
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});

export default TemplateManagementScreen;