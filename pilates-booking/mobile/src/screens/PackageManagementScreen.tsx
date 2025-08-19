import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { COLORS, SPACING } from '../utils/config';
import { AdminGuard } from '../components/AdminGuard';
import { adminApi } from '../api/admin';
import { packagesApi } from '../api/packages';
import { Package } from '../types';

const PackageManagementScreen: React.FC = () => {
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    price: '',
    credits: '',
    validity_days: '',
    is_unlimited: false,
    is_active: true,
  });
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    price: '',
    credits: '',
    validity_days: '',
    is_unlimited: false,
    is_active: true,
  });

  const queryClient = useQueryClient();

  const { data: packages, isLoading, refetch } = useQuery({
    queryKey: ['packages', 'available'],
    queryFn: packagesApi.getAvailablePackages,
  });

  const createPackageMutation = useMutation({
    mutationFn: (packageData: any) => adminApi.createPackage(packageData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      setIsCreateModalVisible(false);
      resetCreateForm();
      Alert.alert('Success', 'Package created successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create package');
    },
  });

  const updatePackageMutation = useMutation({
    mutationFn: ({ packageId, updates }: { packageId: number; updates: any }) =>
      adminApi.updatePackage(packageId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      setIsEditModalVisible(false);
      setSelectedPackage(null);
      Alert.alert('Success', 'Package updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update package');
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: (packageId: number) => adminApi.deletePackage(packageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      Alert.alert('Success', 'Package deleted successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to delete package');
    },
  });

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      description: '',
      price: '',
      credits: '',
      validity_days: '',
      is_unlimited: false,
      is_active: true,
    });
  };

  const handleCreatePackage = () => {
    if (!createForm.name || !createForm.price || !createForm.validity_days) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const packageData = {
      name: createForm.name,
      description: createForm.description || undefined,
      price: parseFloat(createForm.price),
      credits: createForm.is_unlimited ? undefined : parseInt(createForm.credits) || undefined,
      validity_days: parseInt(createForm.validity_days),
      is_unlimited: createForm.is_unlimited,
      is_active: createForm.is_active,
    };

    createPackageMutation.mutate(packageData);
  };

  const handleEditPackage = (pkg: Package) => {
    setSelectedPackage(pkg);
    setEditForm({
      name: pkg.name,
      description: pkg.description || '',
      price: pkg.price.toString(),
      credits: pkg.credits?.toString() || '',
      validity_days: pkg.validity_days.toString(),
      is_unlimited: pkg.is_unlimited,
      is_active: pkg.is_active,
    });
    setIsEditModalVisible(true);
  };

  const handleUpdatePackage = () => {
    if (!selectedPackage) return;

    const updates = {
      name: editForm.name,
      description: editForm.description || undefined,
      price: parseFloat(editForm.price),
      credits: editForm.is_unlimited ? undefined : parseInt(editForm.credits) || undefined,
      validity_days: parseInt(editForm.validity_days),
      is_unlimited: editForm.is_unlimited,
      is_active: editForm.is_active,
    };

    updatePackageMutation.mutate({ packageId: selectedPackage.id, updates });
  };

  const handleDeletePackage = (pkg: Package) => {
    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to delete the "${pkg.name}" package?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePackageMutation.mutate(pkg.id),
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    const numAmount = Number(amount) || 0;
    return `₪${numAmount.toFixed(2)}`;
  };

  const renderPackageItem = ({ item }: { item: Package }) => (
    <View style={styles.packageCard}>
      <View style={styles.packageHeader}>
        <View style={styles.packageTitleContainer}>
          <Text style={styles.packageName}>{item.name}</Text>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: item.is_active ? COLORS.success : COLORS.error }
          ]} />
        </View>
        <Text style={styles.packagePrice}>{formatCurrency(item.price)}</Text>
      </View>
      
      {item.description && (
        <Text style={styles.packageDescription}>{item.description}</Text>
      )}
      
      <View style={styles.packageDetails}>
        <Text style={styles.packageDetail}>
          {item.is_unlimited ? '∞ Unlimited classes' : `${item.credits} credits`}
        </Text>
        <Text style={styles.packageDetail}>Valid for {item.validity_days} days</Text>
        <Text style={[styles.packageDetail, { color: item.is_active ? COLORS.success : COLORS.error }]}>
          {item.is_active ? 'Active' : 'Inactive'}
        </Text>
      </View>
      
      <View style={styles.packageActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditPackage(item)}
        >
          <Ionicons name="pencil" size={20} color={COLORS.primary} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteAction]}
          onPress={() => handleDeletePackage(item)}
        >
          <Ionicons name="trash" size={20} color={COLORS.error} />
          <Text style={[styles.actionText, { color: COLORS.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFormModal = (
    visible: boolean,
    onClose: () => void,
    form: typeof createForm,
    setForm: React.Dispatch<React.SetStateAction<typeof createForm>>,
    onSave: () => void,
    title: string,
    isLoading: boolean
  ) => (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.modalContent}>
          <TextInput
            style={styles.input}
            placeholder="Package Name *"
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
          />
          
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description (optional)"
            value={form.description}
            onChangeText={(text) => setForm({ ...form, description: text })}
            multiline
            numberOfLines={3}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Price (₪) *"
            value={form.price}
            onChangeText={(text) => setForm({ ...form, price: text })}
            keyboardType="numeric"
          />
          
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Unlimited Package</Text>
            <Switch
              value={form.is_unlimited}
              onValueChange={(value) => setForm({ ...form, is_unlimited: value })}
              trackColor={{ false: COLORS.lightGray, true: COLORS.primary }}
            />
          </View>
          
          {!form.is_unlimited && (
            <TextInput
              style={styles.input}
              placeholder="Number of Credits *"
              value={form.credits}
              onChangeText={(text) => setForm({ ...form, credits: text })}
              keyboardType="numeric"
            />
          )}
          
          <TextInput
            style={styles.input}
            placeholder="Validity Days *"
            value={form.validity_days}
            onChangeText={(text) => setForm({ ...form, validity_days: text })}
            keyboardType="numeric"
          />
          
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Active Package</Text>
            <Switch
              value={form.is_active}
              onValueChange={(value) => setForm({ ...form, is_active: value })}
              trackColor={{ false: COLORS.lightGray, true: COLORS.primary }}
            />
          </View>
        </View>

        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={[styles.modalButton, styles.cancelButton]}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalButton, styles.saveButton]}
            onPress={onSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <AdminGuard requiredRoles={['admin']}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Package Management</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setIsCreateModalVisible(true)}
          >
            <Ionicons name="add" size={20} color={COLORS.white} />
            <Text style={styles.createButtonText}>Create</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={packages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPackageItem}
            contentContainerStyle={styles.listContainer}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No packages found</Text>
            }
          />
        )}

        {renderFormModal(
          isCreateModalVisible,
          () => setIsCreateModalVisible(false),
          createForm,
          setCreateForm,
          handleCreatePackage,
          'Create Package',
          createPackageMutation.isPending
        )}

        {renderFormModal(
          isEditModalVisible,
          () => setIsEditModalVisible(false),
          editForm,
          setEditForm,
          handleUpdatePackage,
          'Edit Package',
          updatePackageMutation.isPending
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
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: SPACING.lg,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    gap: 4,
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: SPACING.lg,
  },
  packageCard: {
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
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  packageTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  packageName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: SPACING.sm,
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  packageDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  packageDetails: {
    marginBottom: SPACING.md,
    gap: 4,
  },
  packageDetail: {
    fontSize: 14,
    color: COLORS.text,
  },
  packageActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 6,
    backgroundColor: COLORS.lightGray,
    gap: 4,
  },
  deleteAction: {
    backgroundColor: '#ffebee',
  },
  actionText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  loader: {
    marginTop: SPACING.xl,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: SPACING.xl,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 16,
    marginBottom: SPACING.md,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  switchLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.lightGray,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.text,
  },
  saveButtonText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: '600',
  },
});

export default PackageManagementScreen;