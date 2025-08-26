import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, SPACING } from '../utils/config';
import { AdminGuard } from '../components/AdminGuard';
import { useTranslation } from '../hooks/useTranslation';

interface SystemSetting {
  key: string;
  label: string;
  value: string | number | boolean;
  type: 'text' | 'number' | 'boolean';
  description?: string;
  category: string;
}

const SystemSettingsScreen: React.FC = () => {
  const { t, rtlText, rtlRow } = useTranslation();

  const getSettings = (): SystemSetting[] => [
    // Business Rules
    {
      key: 'MAX_BOOKINGS_PER_WEEK',
      label: t('admin.systemSettings.maxBookingsPerWeek'),
      value: 4,
      type: 'number',
      description: t('admin.systemSettings.maxBookingsDescription'),
      category: t('admin.systemSettings.businessRules'),
    },
    {
      key: 'CANCELLATION_HOURS_LIMIT',
      label: t('admin.systemSettings.cancellationHoursLimit'),
      value: 4,
      type: 'number',
      description: t('admin.systemSettings.cancellationDescription'),
      category: t('admin.systemSettings.businessRules'),
    },
    {
      key: 'WAITLIST_AUTO_PROMOTION',
      label: t('admin.systemSettings.autoWaitlistPromotion'),
      value: true,
      type: 'boolean',
      description: t('admin.systemSettings.waitlistDescription'),
      category: t('admin.systemSettings.businessRules'),
    },

    // Studio Info
    {
      key: 'STUDIO_NAME',
      label: t('admin.systemSettings.studioName'),
      value: 'Pilates Studio',
      type: 'text',
      description: t('admin.systemSettings.studioNameDescription'),
      category: t('admin.systemSettings.studioInfo'),
    },
    {
      key: 'STUDIO_EMAIL',
      label: t('admin.systemSettings.studioContactEmail'),
      value: 'info@pilatesstudio.com',
      type: 'text',
      description: t('admin.systemSettings.studioEmailDescription'),
      category: t('admin.systemSettings.studioInfo'),
    },

    // Email Settings
    {
      key: 'BOOKING_CONFIRMATION_EMAIL',
      label: t('admin.systemSettings.bookingConfirmationEmails'),
      value: true,
      type: 'boolean',
      description: t('admin.systemSettings.emailConfirmationDescription'),
      category: t('admin.systemSettings.emailSettings'),
    },
  ];

  const [settings, setSettings] = useState<SystemSetting[]>(getSettings());

  const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());

  const updateSetting = (key: string, value: string | number | boolean) => {
    setSettings(prevSettings => 
      prevSettings.map(setting => 
        setting.key === key ? { ...setting, value } : setting
      )
    );
    setUnsavedChanges(prev => new Set(prev).add(key));
  };

  const saveSettings = () => {
    Alert.alert(
      t('admin.systemSettings.settingsSaved'),
      t('admin.systemSettings.settingsSavedMessage'),
      [{ text: t('common.ok') }]
    );
    setUnsavedChanges(new Set());
  };

  const renderSettingItem = (setting: SystemSetting) => {
    const hasUnsavedChanges = unsavedChanges.has(setting.key);

    return (
      <View key={setting.key} style={[styles.settingItem, hasUnsavedChanges && styles.unsavedItem]}>
        <View style={styles.settingHeader}>
          <Text style={styles.settingLabel}>{setting.label}</Text>
          {hasUnsavedChanges && (
            <View style={styles.unsavedIndicator}>
              <Text style={styles.unsavedText}>*</Text>
            </View>
          )}
        </View>
        
        {setting.description && (
          <Text style={styles.settingDescription}>{setting.description}</Text>
        )}

        <View style={styles.settingControl}>
          {setting.type === 'text' && (
            <TextInput
              style={styles.textInput}
              value={setting.value as string}
              onChangeText={(text) => updateSetting(setting.key, text)}
              placeholder={setting.label}
            />
          )}

          {setting.type === 'number' && (
            <TextInput
              style={styles.textInput}
              value={(setting.value as number).toString()}
              onChangeText={(text) => {
                const numValue = parseInt(text) || 0;
                updateSetting(setting.key, numValue);
              }}
              keyboardType="numeric"
              placeholder={setting.label}
            />
          )}

          {setting.type === 'boolean' && (
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>
                {setting.value ? t('admin.systemSettings.enabled') : t('admin.systemSettings.disabled')}
              </Text>
              <Switch
                value={setting.value as boolean}
                onValueChange={(value) => updateSetting(setting.key, value)}
                trackColor={{ false: COLORS.lightGray, true: COLORS.primary }}
              />
            </View>
          )}
        </View>
      </View>
    );
  };

  const groupSettingsByCategory = () => {
    const grouped: Record<string, SystemSetting[]> = {};
    settings.forEach(setting => {
      if (!grouped[setting.category]) {
        grouped[setting.category] = [];
      }
      grouped[setting.category].push(setting);
    });
    return grouped;
  };

  const groupedSettings = groupSettingsByCategory();

  return (
    <AdminGuard requiredRoles={['admin']}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('admin.systemSettings.title')}</Text>
          <TouchableOpacity
            style={[
              styles.saveButton,
              unsavedChanges.size === 0 && styles.disabledButton,
            ]}
            onPress={saveSettings}
            disabled={unsavedChanges.size === 0}
          >
            <Ionicons name="save" size={16} color={COLORS.white} />
            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
          </TouchableOpacity>
        </View>

        {unsavedChanges.size > 0 && (
          <View style={styles.unsavedBanner}>
            <Ionicons name="warning" size={16} color={COLORS.warning} />
            <Text style={styles.unsavedBannerText}>
              {t('admin.systemSettings.unsavedChanges')}: {unsavedChanges.size}
            </Text>
          </View>
        )}

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {Object.entries(groupedSettings).map(([category, categorySettings]) => (
            <View key={category} style={styles.categorySection}>
              <Text style={styles.categoryTitle}>{category}</Text>
              {categorySettings.map(renderSettingItem)}
            </View>
          ))}
        </ScrollView>
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
    flex: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    gap: 4,
  },
  disabledButton: {
    backgroundColor: COLORS.lightGray,
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  unsavedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  unsavedBannerText: {
    fontSize: 14,
    color: '#856404',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  categorySection: {
    marginBottom: SPACING.xl,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  settingItem: {
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
  unsavedItem: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  unsavedIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsavedText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  settingDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  settingControl: {
    marginTop: SPACING.sm,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 16,
    color: COLORS.text,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
});

export default SystemSettingsScreen;