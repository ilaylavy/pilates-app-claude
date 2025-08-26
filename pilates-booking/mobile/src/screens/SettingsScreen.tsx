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
import { useTranslation } from '../hooks/useTranslation';
import { StyleUtils } from '../utils/styleUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useNavigation } from '@react-navigation/native';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface UserPreferences {
  email_notifications: boolean;
  sms_notifications: boolean;
  booking_reminders: boolean;
  class_updates: boolean;
  marketing_emails: boolean;
}

const SettingsScreen: React.FC = () => {
  const { t, rtlText, rtlRow } = useTranslation();
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
      Alert.alert(t('common.error'), t('settings.failedToUpdatePreferences'));
    },
  });

  const handlePreferenceChange = (key: keyof UserPreferences, value: boolean) => {
    if (!preferences) return;
    
    const newPreferences = { ...preferences, [key]: value };
    updatePreferencesMutation.mutate(newPreferences);
  };

  const handleLogout = () => {
    Alert.alert(
      t('settings.logoutTitle'),
      t('settings.logoutMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.logout'), style: 'destructive', onPress: logout }
      ]
    );
  };

  // Create a single flat list of all settings
  const settingsItems = [
    // Notifications group
    {
      key: 'email_notifications',
      title: t('settings.emailNotifications'),
      subtitle: t('settings.emailNotificationsSubtitle'),
      icon: 'mail',
      type: 'switch' as const,
    },
    {
      key: 'sms_notifications',
      title: t('settings.smsNotifications'),
      subtitle: t('settings.smsNotificationsSubtitle'),
      icon: 'chatbubble',
      type: 'switch' as const,
    },
    {
      key: 'booking_reminders',
      title: t('settings.bookingReminders'),
      subtitle: t('settings.bookingRemindersSubtitle'),
      icon: 'alarm',
      type: 'switch' as const,
    },
    {
      key: 'class_updates',
      title: t('settings.classUpdates'),
      subtitle: t('settings.classUpdatesSubtitle'),
      icon: 'information-circle',
      type: 'switch' as const,
    },
    {
      key: 'marketing_emails',
      title: t('settings.marketingEmails'),
      subtitle: t('settings.marketingEmailsSubtitle'),
      icon: 'megaphone',
      type: 'switch' as const,
    },
    // Separator
    { key: 'separator_1', type: 'separator' as const },
    // Account & Security group
    {
      key: 'change_password',
      title: t('settings.changePassword'),
      subtitle: t('settings.changePasswordSubtitle'),
      icon: 'key',
      type: 'navigation' as const,
      onPress: () => {
        Alert.alert(t('settings.comingSoon'), t('settings.passwordChangeComingSoon'));
      },
    },
    {
      key: 'biometric_auth',
      title: t('settings.biometricAuth'),
      subtitle: t('settings.biometricAuthSubtitle'),
      icon: 'finger-print',
      type: 'navigation' as const,
      onPress: () => {
        Alert.alert(t('settings.comingSoon'), t('settings.biometricComingSoon'));
      },
    },
    {
      key: 'privacy_policy',
      title: t('settings.privacyPolicy'),
      subtitle: t('settings.privacyPolicySubtitle'),
      icon: 'shield-checkmark',
      type: 'navigation' as const,
      onPress: () => {
        Alert.alert(t('settings.privacyPolicy'), t('settings.privacyPolicyContent'));
      },
    },
    // Separator
    { key: 'separator_2', type: 'separator' as const },
    // App Preferences group
    {
      key: 'language',
      title: t('settings.language'),
      subtitle: t('settings.languageSubtitle'),
      icon: 'globe',
      type: 'custom' as const,
    },
    {
      key: 'theme',
      title: t('settings.theme'),
      subtitle: t('settings.themeSubtitle'),
      icon: 'color-palette',
      type: 'navigation' as const,
      onPress: () => {
        Alert.alert(t('settings.theme'), t('settings.themeComingSoon'));
      },
    },
    // Separator
    { key: 'separator_3', type: 'separator' as const },
    // Support group
    {
      key: 'contact_support',
      title: t('settings.contactSupport'),
      subtitle: t('settings.contactSupportSubtitle'),
      icon: 'help-circle',
      type: 'navigation' as const,
      onPress: () => {
        Alert.alert(
          t('settings.contactSupport'),
          t('settings.contactSupportDetails'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('settings.sendEmail'), onPress: () => {} },
          ]
        );
      },
    },
    {
      key: 'faq',
      title: t('settings.faq'),
      subtitle: t('settings.faqSubtitle'),
      icon: 'help-buoy',
      type: 'navigation' as const,
      onPress: () => {
        Alert.alert(t('settings.faq'), t('settings.faqComingSoon'));
      },
    },
    {
      key: 'feedback',
      title: t('settings.sendFeedback'),
      subtitle: t('settings.sendFeedbackSubtitle'),
      icon: 'chatbubbles',
      type: 'navigation' as const,
      onPress: () => {
        Alert.alert(t('settings.feedback'), t('settings.feedbackComingSoon'));
      },
    },
  ];

  // Add admin settings if user is admin
  if (isAdmin) {
    settingsItems.push(
      // Separator for admin section
      { key: 'separator_admin', type: 'separator' as const },
      {
        key: 'system_settings',
        title: t('settings.systemSettings'),
        subtitle: t('settings.systemSettingsSubtitle'),
        icon: 'settings',
        type: 'navigation' as const,
        onPress: () => navigation.navigate('SystemSettings' as never),
      },
      {
        key: 'user_management',
        title: t('settings.userManagement'),
        subtitle: t('settings.userManagementSubtitle'),
        icon: 'people',
        type: 'navigation' as const,
        onPress: () => navigation.navigate('UserManagement' as never),
      },
      {
        key: 'reports',
        title: t('settings.reportsAnalytics'),
        subtitle: t('settings.reportsAnalyticsSubtitle'),
        icon: 'analytics',
        type: 'navigation' as const,
        onPress: () => navigation.navigate('Reports' as never),
      },
      {
        key: 'backup',
        title: t('settings.dataBackup'),
        subtitle: t('settings.dataBackupSubtitle'),
        icon: 'cloud-upload',
        type: 'navigation' as const,
        onPress: () => {
          Alert.alert(t('settings.dataBackup'), t('settings.dataBackupComingSoon'));
        },
      }
    );
  }

  const renderSettingItem = (item: any) => {
    // Handle separator items
    if (item.type === 'separator') {
      return <View key={item.key} style={styles.separator} />;
    }

    // Handle language custom item
    if (item.key === 'language') {
      return (
        <View key={item.key} style={[styles.settingItem, rtlRow()]}>
          <View style={[styles.settingIcon, StyleUtils.marginEnd(SPACING.md)]}>
            <Ionicons name={item.icon} size={24} color={COLORS.primary} />
          </View>
          <View style={styles.settingContent}>
            <Text style={[styles.settingTitle, rtlText()]}>{item.title}</Text>
            <View style={styles.languageSwitcherContainer}>
              <LanguageSwitcher variant="inline" showLabel={false} style={styles.inlineLanguageSwitcher} />
            </View>
          </View>
        </View>
      );
    }

    const isSwitch = item.type === 'switch';
    const value = preferences?.[item.key as keyof UserPreferences] ?? false;

    return (
      <TouchableOpacity
        key={item.key}
        style={[styles.settingItem, rtlRow()]}
        onPress={isSwitch ? undefined : item.onPress}
        disabled={isSwitch}
      >
        <View style={[styles.settingIcon, StyleUtils.marginEnd(SPACING.md)]}>
          <Ionicons name={item.icon} size={24} color={COLORS.primary} />
        </View>
        <View style={styles.settingContent}>
          <Text style={[styles.settingTitle, rtlText()]}>{item.title}</Text>
          <Text style={[styles.settingSubtitle, rtlText()]}>{item.subtitle}</Text>
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
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} style={StyleUtils.iconTransform()} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Single Settings List */}
        <View style={styles.settingsSection}>
          {settingsItems.map(renderSettingItem)}
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
  settingsSection: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  settingItem: {
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
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  settingAction: {
    ...StyleUtils.marginStart(SPACING.sm),
  },
  separator: {
    height: SPACING.md,
    backgroundColor: COLORS.background,
  },
  languageSwitcherContainer: {
    marginTop: SPACING.xs,
  },
  inlineLanguageSwitcher: {
    backgroundColor: COLORS.surface,
  },
});

export default SettingsScreen;