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

interface SystemSetting {
  key: string;
  label: string;
  value: string | number | boolean;
  type: 'text' | 'number' | 'boolean';
  description?: string;
  category: string;
}

const SystemSettingsScreen: React.FC = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([
    // Business Rules
    {
      key: 'MAX_BOOKINGS_PER_WEEK',
      label: 'Max Bookings Per Week',
      value: 4,
      type: 'number',
      description: 'Maximum number of classes a student can book per week',
      category: 'Business Rules',
    },
    {
      key: 'CANCELLATION_HOURS_LIMIT',
      label: 'Cancellation Hours Limit',
      value: 4,
      type: 'number',
      description: 'Hours before class start when cancellation is allowed',
      category: 'Business Rules',
    },
    {
      key: 'WAITLIST_AUTO_PROMOTION',
      label: 'Auto Waitlist Promotion',
      value: true,
      type: 'boolean',
      description: 'Automatically promote waitlisted users when spots become available',
      category: 'Business Rules',
    },

    // Studio Info
    {
      key: 'STUDIO_NAME',
      label: 'Studio Name',
      value: 'Pilates Studio',
      type: 'text',
      description: 'Name of the pilates studio',
      category: 'Studio Info',
    },
    {
      key: 'STUDIO_EMAIL',
      label: 'Studio Contact Email',
      value: 'info@pilatesstudio.com',
      type: 'text',
      description: 'Main contact email for the studio',
      category: 'Studio Info',
    },

    // Email Settings
    {
      key: 'BOOKING_CONFIRMATION_EMAIL',
      label: 'Booking Confirmation Emails',
      value: true,
      type: 'boolean',
      description: 'Send email confirmation when booking is made',
      category: 'Email Settings',
    },
  ]);

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
      'Settings Saved',
      'System settings have been updated successfully.',
      [{ text: 'OK' }]
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
                {setting.value ? 'Enabled' : 'Disabled'}
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
          <Text style={styles.title}>System Settings</Text>
          <TouchableOpacity
            style={[
              styles.saveButton,
              unsavedChanges.size === 0 && styles.disabledButton,
            ]}
            onPress={saveSettings}
            disabled={unsavedChanges.size === 0}
          >
            <Ionicons name="save" size={16} color={COLORS.white} />
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>

        {unsavedChanges.size > 0 && (
          <View style={styles.unsavedBanner}>
            <Ionicons name="warning" size={16} color={COLORS.warning} />
            <Text style={styles.unsavedBannerText}>
              You have {unsavedChanges.size} unsaved change{unsavedChanges.size !== 1 ? 's' : ''}
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