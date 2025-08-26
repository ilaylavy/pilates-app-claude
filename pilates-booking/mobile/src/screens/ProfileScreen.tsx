import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { StyleUtils } from '../utils/styleUtils';
import { COLORS, SPACING } from '../utils/config';
import Button from '../components/common/Button';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import AvatarUpload from '../components/AvatarUpload';
import EditProfileModal from '../components/EditProfileModal';
import { useUserRole } from '../hooks/useUserRole';
import { Ionicons } from '@expo/vector-icons';


interface UserStats {
  total_bookings: number;
  member_since: string;
}

const ProfileScreen: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigation = useNavigation();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { t, rtlText, rtlRow, formatDate: formatDateI18n } = useTranslation();

  const { data: userStats, isLoading } = useQuery<UserStats>({
    queryKey: ['user-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/users/me/stats');
      return response.data;
    },
    enabled: isAuthenticated,
  });

  const handleLogout = async () => {
    Alert.alert(
      t('auth.logout'),
      t('alerts.confirmLogout'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('auth.logout'), style: 'destructive', onPress: logout }
      ]
    );
  };

  const handleAvatarPress = () => {
    setShowAvatarUpload(true);
  };

  const handleNavigation = (screen: string) => {
    if (screen === 'EditProfile') {
      setShowEditProfileModal(true);
    } else {
      navigation.navigate(screen as never);
    }
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`;
  };

  const formatDate = (dateString: string) => {
    return formatDateI18n(new Date(dateString));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['user-stats'] });
    await queryClient.invalidateQueries({ queryKey: ['user'] });
    setRefreshing(false);
  };

  const menuItems = [
    {
      key: 'editProfile',
      title: t('profile.editProfile'),
      icon: 'person-outline',
      onPress: () => setShowEditProfileModal(true)
    },
    {
      key: 'settings',
      title: t('navigation.settings'),
      icon: 'settings-outline',
      onPress: () => navigation.navigate('Settings' as never)
    },
    {
      key: 'paymentHistory',
      title: t('profile.paymentHistory'),
      icon: 'receipt-outline',
      onPress: () => navigation.navigate('PaymentHistory' as never)
    },
    {
      key: 'help',
      title: t('settings.contactSupport'),
      icon: 'help-circle-outline',
      onPress: () => {
        Alert.alert(
          t('settings.contactSupport'),
          t('settings.contactSupportDetails'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('settings.sendEmail'), onPress: () => {} }
          ]
        );
      }
    },
    {
      key: 'about',
      title: t('settings.about'),
      icon: 'information-circle-outline',
      onPress: () => {
        Alert.alert(
          t('settings.about'),
          `${t('settings.appVersion')}: 1.0.0\n${t('settings.build')}: 2024.01.01`,
          [{ text: t('common.ok') }]
        );
      }
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarContainer}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {getInitials(user?.first_name, user?.last_name)}
                </Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={16} color={COLORS.background} />
            </View>
          </TouchableOpacity>
          
          <Text style={[styles.name, rtlText('center')]}>{user?.first_name} {user?.last_name}</Text>
          <Text style={[styles.email, rtlText('center')]}>{user?.email}</Text>
          <Text style={[styles.memberSince, rtlText('center')]}>
            {t('profile.memberSince', { date: userStats ? formatDate(userStats.member_since) : '' })}
          </Text>
          
          <TouchableOpacity style={styles.editButton} onPress={() => setShowEditProfileModal(true)}>
            <Text style={styles.editButtonText}>{t('profile.editProfile')}</Text>
          </TouchableOpacity>
        </View>
        
        {/* Achievement Bar */}
        <View style={styles.achievementSection}>
          <View style={styles.achievementBar}>
            <Text style={styles.achievementText}>
              {userStats?.total_bookings || 0} {t('stats.totalClasses')}
            </Text>
          </View>
        </View>
        
        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.menuItem, rtlRow()]}
              onPress={item.onPress}
            >
              <View style={[styles.menuIcon, StyleUtils.marginEnd(SPACING.md)]}>
                <Ionicons name={item.icon as any} size={24} color={COLORS.primary} />
              </View>
              <Text style={[styles.menuText, rtlText()]}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} style={StyleUtils.iconTransform()} />
            </TouchableOpacity>
          ))}
          
          {/* Admin Dashboard */}
          {isAdmin && (
            <TouchableOpacity
              style={[styles.menuItem, styles.adminItem, rtlRow()]}
              onPress={() => navigation.navigate('AdminPackages' as never)}
            >
              <View style={[styles.menuIcon, styles.adminIcon, StyleUtils.marginEnd(SPACING.md)]}>
                <Ionicons name="construct" size={24} color={COLORS.accent} />
              </View>
              <Text style={[styles.menuText, styles.adminText, rtlText()]}>
                {t('admin.dashboard')}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.accent} style={StyleUtils.iconTransform()} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <Button
            title={t('auth.logout')}
            onPress={handleLogout}
            variant="danger"
          />
        </View>
      </ScrollView>
      
      {showAvatarUpload && (
        <AvatarUpload
          visible={showAvatarUpload}
          onClose={() => setShowAvatarUpload(false)}
          onUpload={(avatarUrl: string) => {
            // Refresh user data and close modal
            queryClient.invalidateQueries({ queryKey: ['user'] });
            setShowAvatarUpload(false);
          }}
        />
      )}

      <EditProfileModal
        visible={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.card,
    marginBottom: SPACING.md,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  email: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  memberSince: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  editButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 20,
  },
  editButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  achievementSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  achievementBar: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  achievementText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  menuSection: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  menuItem: {
    ...StyleUtils.flexDirection('row'),
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  adminItem: {
    backgroundColor: `${COLORS.accent}08`,
  },
  adminIcon: {
    backgroundColor: `${COLORS.accent}15`,
  },
  adminText: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  logoutContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
});

export default ProfileScreen;