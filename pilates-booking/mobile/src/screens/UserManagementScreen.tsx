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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { COLORS, SPACING } from '../utils/config';
import { AdminGuard } from '../components/AdminGuard';
import { adminApi } from '../api/admin';
import { UserListItem } from '../types';
import StudentDetailModal from '../components/StudentDetailModal';
import { useTranslation } from '../hooks/useTranslation';

const UserManagementScreen: React.FC = () => {
  const { t, rtlText, rtlRow } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('student');
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<UserListItem | null>(null);
  const [isStudentDetailVisible, setIsStudentDetailVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: 'student' as 'student' | 'instructor' | 'admin',
    is_active: true,
    is_verified: false,
  });

  const queryClient = useQueryClient();

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'users', searchQuery, selectedRole],
    queryFn: () => adminApi.getUsers({
      search: searchQuery || undefined,
      role: selectedRole || undefined,
      limit: 100,
    }),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, updates }: { userId: number; updates: Partial<typeof editForm> }) =>
      adminApi.updateUser(userId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setIsModalVisible(false);
      setSelectedUser(null);
      Alert.alert(t('common.success'), t('admin.userManagementScreen.userUpdatedSuccessfully'));
    },
    onError: (error: any) => {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('admin.userManagementScreen.failedToUpdateUser'));
    },
  });

  const deactivateUserMutation = useMutation({
    mutationFn: (userId: number) => adminApi.deactivateUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      Alert.alert(t('common.success'), t('admin.userManagementScreen.userDeactivatedSuccessfully'));
    },
    onError: (error: any) => {
      Alert.alert(t('common.error'), error.response?.data?.detail || t('admin.userManagementScreen.failedToDeactivateUser'));
    },
  });

  const handleViewStudent = (student: UserListItem) => {
    setSelectedStudentForDetail(student);
    setIsStudentDetailVisible(true);
  };

  const handleEditUser = (user: UserListItem) => {
    setSelectedUser(user);
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: '',
      role: user.role,
      is_active: user.is_active,
      is_verified: user.is_verified,
    });
    setIsModalVisible(true);
  };

  const handleSaveUser = () => {
    if (!selectedUser) return;

    const updates = {
      first_name: editForm.first_name,
      last_name: editForm.last_name,
      email: editForm.email,
      phone: editForm.phone || undefined,
      role: editForm.role,
      is_active: editForm.is_active,
      is_verified: editForm.is_verified,
    };

    updateUserMutation.mutate({ userId: selectedUser.id, updates });
  };

  const handleDeactivateUser = (user: UserListItem) => {
    Alert.alert(
      t('common.confirm'),
      `${t('admin.userManagementScreen.deactivateUser')} ${user.first_name} ${user.last_name}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.userManagementScreen.deactivateUser'),
          style: 'destructive',
          onPress: () => deactivateUserMutation.mutate(user.id),
        },
      ]
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return COLORS.error;
      case 'instructor':
        return COLORS.warning;
      default:
        return COLORS.primary;
    }
  };

  const renderUserItem = ({ item }: { item: UserListItem }) => (
    <TouchableOpacity 
      style={styles.userCard}
      onPress={() => handleViewStudent(item)}
      activeOpacity={0.7}
    >
      <View style={styles.userAvatar}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>
              {item.first_name[0]}{item.last_name[0]}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <Text style={styles.userName}>{item.first_name} {item.last_name}</Text>
          <View style={[styles.roleTag, { backgroundColor: getRoleColor(item.role) }]}>
            <Text style={styles.roleText}>{item.role.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.userEmail}>{item.email}</Text>
        <View style={styles.userStats}>
          <Text style={styles.statText}>{t('admin.bookings')}: {item.total_bookings}</Text>
          <Text style={styles.statText}>{t('admin.packages')}: {item.active_packages}</Text>
          <Text style={[styles.statText, { color: item.is_active ? COLORS.success : COLORS.error }]}>
            {item.is_active ? t('admin.userManagementScreen.active') : t('admin.userManagementScreen.inactive')}
          </Text>
        </View>
      </View>
      <View style={styles.userActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditUser(item)}
        >
          <Ionicons name="pencil" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeactivateUser(item)}
        >
          <Ionicons name="person-remove" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderEditModal = () => (
    <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{t('admin.userManagementScreen.editUser')}</Text>
          <TouchableOpacity onPress={() => setIsModalVisible(false)}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.modalContent}>
          <TextInput
            style={styles.input}
            placeholder={t('admin.userManagementScreen.firstName')}
            value={editForm.first_name}
            onChangeText={(text) => setEditForm({ ...editForm, first_name: text })}
          />
          <TextInput
            style={styles.input}
            placeholder={t('admin.userManagementScreen.lastName')}
            value={editForm.last_name}
            onChangeText={(text) => setEditForm({ ...editForm, last_name: text })}
          />
          <TextInput
            style={styles.input}
            placeholder={t('admin.userManagementScreen.email')}
            value={editForm.email}
            onChangeText={(text) => setEditForm({ ...editForm, email: text })}
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder={`${t('admin.userManagementScreen.phone')} (${t('admin.bulkOperations.optional')})`}
            value={editForm.phone}
            onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
          />
          
          {/* Role Selector */}
          <Text style={styles.sectionTitle}>{t('admin.userManagementScreen.role')}</Text>
          <View style={styles.roleSelector}>
            {['student', 'instructor', 'admin'].map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleOption,
                  editForm.role === role && styles.selectedRoleOption
                ]}
                onPress={() => setEditForm({ ...editForm, role: role as any })}
              >
                <Text style={[
                  styles.roleOptionText,
                  editForm.role === role && styles.selectedRoleOptionText
                ]}>
                  {t(`admin.userManagementScreen.${role}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Status Toggles */}
          <View style={styles.toggleSection}>
            <TouchableOpacity
              style={styles.toggleItem}
              onPress={() => setEditForm({ ...editForm, is_active: !editForm.is_active })}
            >
              <Text style={styles.toggleLabel}>{t('admin.userManagementScreen.active')}</Text>
              <View style={[styles.toggle, editForm.is_active && styles.toggleActive]}>
                {editForm.is_active && <View style={styles.toggleIndicator} />}
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toggleItem}
              onPress={() => setEditForm({ ...editForm, is_verified: !editForm.is_verified })}
            >
              <Text style={styles.toggleLabel}>{t('admin.userManagementScreen.verified')}</Text>
              <View style={[styles.toggle, editForm.is_verified && styles.toggleActive]}>
                {editForm.is_verified && <View style={styles.toggleIndicator} />}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={[styles.modalButton, styles.cancelButton]}
            onPress={() => setIsModalVisible(false)}
          >
            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalButton, styles.saveButton]}
            onPress={handleSaveUser}
            disabled={updateUserMutation.isPending}
          >
            {updateUserMutation.isPending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.saveButtonText}>{t('common.save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  return (
    <AdminGuard requiredRoles={['admin']}>
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>{t('admin.userManagementScreen.title')}</Text>
        
        {/* Search and Filter */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('admin.userManagementScreen.searchPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          <View style={styles.filterContainer}>
            <Text style={styles.filterLabel}>{t('admin.userManagementScreen.filterByRole')}:</Text>
            <TouchableOpacity
              style={[styles.filterButton, selectedRole === 'student' && styles.activeFilter]}
              onPress={() => setSelectedRole('student')}
            >
              <Text style={[styles.filterText, selectedRole === 'student' && styles.activeFilterText]}>{t('admin.userManagementScreen.student')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, !selectedRole && styles.activeFilter]}
              onPress={() => setSelectedRole('')}
            >
              <Text style={[styles.filterText, !selectedRole && styles.activeFilterText]}>{t('admin.userManagementScreen.allRoles')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* User List */}
        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderUserItem}
            contentContainerStyle={styles.listContainer}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
            ListEmptyComponent={
              <Text style={styles.emptyText}>{t('admin.userManagementScreen.noUsersFound')}</Text>
            }
          />
        )}

        {renderEditModal()}
        
        <StudentDetailModal
          visible={isStudentDetailVisible}
          student={selectedStudentForDetail}
          onClose={() => {
            setIsStudentDetailVisible(false);
            setSelectedStudentForDetail(null);
          }}
        />
      </SafeAreaView>
    </AdminGuard>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    margin: SPACING.lg,
    marginBottom: SPACING.md,
  },
  searchContainer: {
    padding: SPACING.lg,
    paddingTop: 0,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
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
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: 16,
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
  filterButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.lightGray,
    marginRight: SPACING.sm,
    marginBottom: 4,
  },
  activeFilter: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  activeFilterText: {
    color: COLORS.white,
  },
  listContainer: {
    paddingHorizontal: SPACING.lg,
  },
  userCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userAvatar: {
    marginRight: SPACING.md,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  roleTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 10,
    color: COLORS.white,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  userStats: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  userActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    padding: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.lightGray,
  },
  deleteButton: {
    backgroundColor: '#ffebee',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  roleOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.lightGray,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  selectedRoleOption: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleOptionText: {
    fontSize: 14,
    color: COLORS.text,
  },
  selectedRoleOptionText: {
    color: COLORS.white,
  },
  toggleSection: {
    marginTop: SPACING.md,
  },
  toggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  toggleLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: COLORS.primary,
  },
  toggleIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignSelf: 'flex-end',
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

export default UserManagementScreen;