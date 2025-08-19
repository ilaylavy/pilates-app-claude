import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';
import { useAuth } from '../hooks/useAuth';
import { useUserRole } from '../hooks/useUserRole';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useNavigation } from '@react-navigation/native';

interface UserPreferences {
  email_notifications: boolean;
  sms_notifications: boolean;
  booking_reminders: boolean;
  class_updates: boolean;
  marketing_emails: boolean;
}

const SettingsScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const { isAdmin } = useUserRole();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  // Fetch user preferences
  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ['user-preferences'],
    queryFn: async () => {
      // Since preferences are stored in user model, we get default values
      return {
        email_notifications: true,
        sms_notifications: false,
        booking_reminders: true,
        class_updates: true,
        marketing_emails: false,
      };
    },
  });

  // Mutation to update preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: UserPreferences) => {
      await apiClient.patch('/api/v1/users/me/preferences', newPreferences);
      return newPreferences;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user-preferences'], data);
    },
    onError: () => {
      Alert.alert('Error', 'Failed to update preferences');
    },
  });

  const handlePreferenceChange = (key: keyof UserPreferences, value: boolean) => {
    if (!preferences) return;
    
    const newPreferences = { ...preferences, [key]: value };
    updatePreferencesMutation.mutate(newPreferences);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout }
      ]
    );
  };

  const settingsSections = [
    {
      title: 'Notifications',
      items: [
        {
          key: 'email_notifications',
          title: 'Email Notifications',
          subtitle: 'Receive notifications via email',
          icon: 'mail',
          type: 'switch' as const,
        },
        {
          key: 'sms_notifications',
          title: 'SMS Notifications',
          subtitle: 'Receive text message notifications',
          icon: 'chatbubble',
          type: 'switch' as const,
        },
        {
          key: 'booking_reminders',
          title: 'Booking Reminders',
          subtitle: 'Get reminded about upcoming classes',
          icon: 'alarm',
          type: 'switch' as const,
        },
        {
          key: 'class_updates',
          title: 'Class Updates',
          subtitle: 'Notifications about class changes',
          icon: 'information-circle',
          type: 'switch' as const,
        },
        {
          key: 'marketing_emails',
          title: 'Marketing Emails',
          subtitle: 'Promotional offers and news',
          icon: 'megaphone',
          type: 'switch' as const,
        },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        {
          key: 'change_password',
          title: 'Change Password',
          subtitle: 'Update your account password',
          icon: 'key',
          type: 'navigation' as const,
          onPress: () => {
            // Navigate to change password screen
            Alert.alert('Coming Soon', 'Password change functionality will be available soon.');
          },
        },
        {
          key: 'biometric_auth',
          title: 'Biometric Authentication',
          subtitle: 'Use fingerprint or face ID',
          icon: 'finger-print',
          type: 'navigation' as const,
          onPress: () => {
            Alert.alert('Coming Soon', 'Biometric authentication will be available soon.');
          },
        },
        {
          key: 'privacy_policy',
          title: 'Privacy Policy',
          subtitle: 'View our privacy policy',
          icon: 'shield-checkmark',
          type: 'navigation' as const,
          onPress: () => {
            Alert.alert('Privacy Policy', 'Privacy policy content would be displayed here.');
          },
        },
      ],
    },
    {
      title: 'App Preferences',
      items: [
        {
          key: 'language',
          title: 'Language',
          subtitle: 'English',
          icon: 'globe',
          type: 'navigation' as const,
          onPress: () => {
            Alert.alert('Language', 'Multiple language support coming soon.');
          },
        },
        {
          key: 'theme',
          title: 'Theme',
          subtitle: 'Light mode',
          icon: 'color-palette',
          type: 'navigation' as const,
          onPress: () => {
            Alert.alert('Theme', 'Dark mode support coming soon.');
          },
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          key: 'contact_support',
          title: 'Contact Support',
          subtitle: 'Get help from our team',
          icon: 'help-circle',
          type: 'navigation' as const,
          onPress: () => {
            Alert.alert(
              'Contact Support',
              'Email: support@pilatesstudio.com\nPhone: +972-50-123-4567',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Send Email', onPress: () => {} },
              ]
            );
          },
        },
        {
          key: 'faq',
          title: 'FAQ',
          subtitle: 'Frequently asked questions',
          icon: 'help-buoy',
          type: 'navigation' as const,
          onPress: () => {
            Alert.alert('FAQ', 'FAQ section will be available soon.');
          },
        },
        {
          key: 'feedback',
          title: 'Send Feedback',
          subtitle: 'Help us improve the app',
          icon: 'chatbubbles',
          type: 'navigation' as const,
          onPress: () => {
            Alert.alert('Feedback', 'Feedback form will be available soon.');
          },
        },
      ],
    },
  ];

  // Add admin section if user is admin
  if (isAdmin) {
    settingsSections.unshift({
      title: 'Administration',
      items: [
        {
          key: 'system_settings',
          title: 'System Settings',
          subtitle: 'Configure business rules',
          icon: 'settings',
          type: 'navigation' as const,
          onPress: () => navigation.navigate('SystemSettings' as never),
        },
        {
          key: 'user_management',
          title: 'User Management',
          subtitle: 'Manage users and roles',
          icon: 'people',
          type: 'navigation' as const,
          onPress: () => navigation.navigate('UserManagement' as never),
        },
        {
          key: 'reports',
          title: 'Reports & Analytics',
          subtitle: 'View business insights',
          icon: 'analytics',
          type: 'navigation' as const,
          onPress: () => navigation.navigate('Reports' as never),
        },
        {
          key: 'backup',
          title: 'Data Backup',
          subtitle: 'Backup and restore data',
          icon: 'cloud-upload',
          type: 'navigation' as const,
          onPress: () => {
            Alert.alert('Data Backup', 'Backup functionality will be available soon.');
          },
        },
      ],
    });
  }

  const renderSettingItem = (item: any) => {
    const isSwitch = item.type === 'switch';
    const value = preferences?.[item.key as keyof UserPreferences] ?? false;

    return (
      <TouchableOpacity
        key={item.key}
        style={styles.settingItem}
        onPress={isSwitch ? undefined : item.onPress}
        disabled={isSwitch}
      >
        <View style={styles.settingIcon}>
          <Ionicons name={item.icon} size={20} color={COLORS.primary} />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{item.title}</Text>
          <Text style={styles.settingSubtitle}>{item.subtitle}</Text>
        </View>
        <View style={styles.settingAction}>
          {isSwitch ? (
            <Switch
              value={value}
              onValueChange={(newValue) => 
                handlePreferenceChange(item.key as keyof UserPreferences, newValue)
              }
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={COLORS.background}
              disabled={updatePreferencesMutation.isPending}
            />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* User Info Header */}
        <View style={styles.userHeader}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user?.first_name} {user?.last_name}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <Text style={styles.userRole}>{user?.role.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Settings Sections */}
        {settingsSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {section.items.map(renderSettingItem)}
            </View>
          </View>
        ))}

        {/* App Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.sectionContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Build</Text>
              <Text style={styles.infoValue}>2024.01.01</Text>
            </View>
          </View>
        </View>

        {/* Logout Button */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={20} color={COLORS.error} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  userHeader: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionContent: {
    backgroundColor: COLORS.card,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  settingAction: {
    marginLeft: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  logoutSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.error,
  },
});

export default SettingsScreen;