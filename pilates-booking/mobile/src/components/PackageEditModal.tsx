import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';
import { apiClient } from '../api/client';
import Button from './common/Button';

interface Package {
  id: number;
  name: string;
  description: string;
  credits: number;
  price: number;
  validity_days: number;
  is_active: boolean;
  is_unlimited: boolean;
  is_featured: boolean;
  order_index: number;
}

interface PackageEditModalProps {
  visible: boolean;
  package: Package | null;
  onClose: () => void;
  onSave: () => void;
}

const PackageEditModal: React.FC<PackageEditModalProps> = ({
  visible,
  package: pkg,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    credits: '10',
    price: '0',
    validity_days: '30',
    is_active: true,
    is_unlimited: false,
    is_featured: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!pkg;

  useEffect(() => {
    if (pkg) {
      setFormData({
        name: pkg.name,
        description: pkg.description || '',
        credits: pkg.credits?.toString() || '10',
        price: pkg.price?.toString() || '0',
        validity_days: pkg.validity_days?.toString() || '30',
        is_active: pkg.is_active,
        is_unlimited: pkg.is_unlimited,
        is_featured: pkg.is_featured,
      });
    } else {
      // Reset form for new package
      setFormData({
        name: '',
        description: '',
        credits: '10',
        price: '0',
        validity_days: '30',
        is_active: true,
        is_unlimited: false,
        is_featured: false,
      });
    }
    setErrors({});
  }, [pkg, visible]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Package name is required';
    }

    if (!formData.is_unlimited) {
      const credits = parseInt(formData.credits);
      if (!credits || credits <= 0) {
        newErrors.credits = 'Credits must be a positive number';
      }
    }

    const price = parseFloat(formData.price);
    if (!price || price <= 0) {
      newErrors.price = 'Price must be a positive number';
    }

    const validityDays = parseInt(formData.validity_days);
    if (!validityDays || validityDays <= 0) {
      newErrors.validity_days = 'Validity period must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const packageData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        credits: formData.is_unlimited ? 999999 : parseInt(formData.credits),
        price: parseFloat(formData.price),
        validity_days: parseInt(formData.validity_days),
        is_active: formData.is_active,
        is_unlimited: formData.is_unlimited,
        is_featured: formData.is_featured,
      };

      if (isEditing && pkg) {
        await apiClient.put(`/api/v1/packages/${pkg.id}`, packageData);
        Alert.alert('Success', 'Package updated successfully!');
      } else {
        await apiClient.post('/api/v1/packages/', packageData);
        Alert.alert('Success', 'Package created successfully!');
      }

      onSave();
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.detail || `Failed to ${isEditing ? 'update' : 'create'} package`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>
            {isEditing ? 'Edit Package' : 'Create Package'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isLoading}
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Package Name *</Text>
              <TextInput
                style={[styles.input, errors.name && styles.inputError]}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Enter package name"
                maxLength={50}
              />
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.textArea, errors.description && styles.inputError]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Describe the package benefits..."
                multiline
                numberOfLines={3}
                maxLength={200}
              />
            </View>
          </View>

          {/* Package Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Package Details</Text>

            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchLabel}>Unlimited Package</Text>
                <Text style={styles.switchDescription}>
                  Allow unlimited class bookings
                </Text>
              </View>
              <Switch
                value={formData.is_unlimited}
                onValueChange={(value) => setFormData({ ...formData, is_unlimited: value })}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.background}
              />
            </View>

            {!formData.is_unlimited && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Number of Credits *</Text>
                <TextInput
                  style={[styles.input, errors.credits && styles.inputError]}
                  value={formData.credits}
                  onChangeText={(text) => setFormData({ ...formData, credits: text })}
                  placeholder="10"
                  keyboardType="numeric"
                />
                {errors.credits && <Text style={styles.errorText}>{errors.credits}</Text>}
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Price (₪) *</Text>
              <TextInput
                style={[styles.input, errors.price && styles.inputError]}
                value={formData.price}
                onChangeText={(text) => setFormData({ ...formData, price: text })}
                placeholder="150.00"
                keyboardType="decimal-pad"
              />
              {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Validity Period (Days) *</Text>
              <TextInput
                style={[styles.input, errors.validity_days && styles.inputError]}
                value={formData.validity_days}
                onChangeText={(text) => setFormData({ ...formData, validity_days: text })}
                placeholder="30"
                keyboardType="numeric"
              />
              {errors.validity_days && <Text style={styles.errorText}>{errors.validity_days}</Text>}
              <Text style={styles.helpText}>
                Number of days from purchase until expiration
              </Text>
            </View>
          </View>

          {/* Package Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status & Features</Text>

            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchLabel}>Active Package</Text>
                <Text style={styles.switchDescription}>
                  Available for purchase by students
                </Text>
              </View>
              <Switch
                value={formData.is_active}
                onValueChange={(value) => setFormData({ ...formData, is_active: value })}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.background}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchLabel}>Featured Package</Text>
                <Text style={styles.switchDescription}>
                  Highlight this package as recommended
                </Text>
              </View>
              <Switch
                value={formData.is_featured}
                onValueChange={(value) => setFormData({ ...formData, is_featured: value })}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor={COLORS.background}
              />
            </View>
          </View>

          {/* Preview */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preview</Text>
            <View style={styles.previewCard}>
              <Text style={styles.previewName}>{formData.name || 'Package Name'}</Text>
              <Text style={styles.previewDescription}>
                {formData.description || 'Package description will appear here...'}
              </Text>
              <View style={styles.previewDetails}>
                <Text style={styles.previewDetail}>
                  {formData.is_unlimited ? 'Unlimited classes' : `${formData.credits} credits`}
                </Text>
                <Text style={styles.previewDetail}>
                  Valid for {formData.validity_days} days
                </Text>
                <Text style={styles.previewPrice}>₪{formData.price}</Text>
              </View>
            </View>
          </View>
        </ScrollView>
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
  closeButton: {
    padding: SPACING.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  saveButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  section: {
    marginVertical: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 16,
    color: COLORS.text,
  },
  textArea: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 16,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  helpText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  switchInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  previewCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  previewDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  previewDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewDetail: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  previewPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
});

export default PackageEditModal;