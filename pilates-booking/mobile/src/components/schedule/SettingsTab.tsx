import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../utils/config';

interface SettingItemProps {
  title: string;
  description?: string;
  icon: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showArrow?: boolean;
}

const SettingItem: React.FC<SettingItemProps> = ({
  title,
  description,
  icon,
  onPress,
  rightElement,
  showArrow = false,
}) => (
  <TouchableOpacity
    style={styles.settingItem}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={styles.settingIcon}>
      <Ionicons name={icon as any} size={20} color={COLORS.primary} />
    </View>
    <View style={styles.settingContent}>
      <Text style={styles.settingTitle}>{title}</Text>
      {description && (
        <Text style={styles.settingDescription}>{description}</Text>
      )}
    </View>
    <View style={styles.settingRight}>
      {rightElement}
      {showArrow && (
        <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
      )}
    </View>
  </TouchableOpacity>
);

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

const SettingSection: React.FC<SettingSectionProps> = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionContent}>
      {children}
    </View>
  </View>
);

const SettingsTab: React.FC = () => {
  const [settings, setSettings] = useState({
    autoApprovalEnabled: false,
    notificationsEnabled: true,
    emailReminders: true,
    showFullNames: true,
    compactView: false,
    weekStartsMonday: true,
    show24HourTime: false,
    defaultClassDuration: 60,
    defaultCapacity: 12,
    advanceBookingDays: 7,
    cancellationHours: 24,
    waitlistAutoPromotion: true,
    showInstructorNotes: true,
  });

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // Here you would typically save to backend/storage
  };

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'This will export all class and booking data to a CSV file.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => {
          // Implement export functionality
          Alert.alert('Export Started', 'Your data export will be ready shortly.');
        }},
      ]
    );
  };

  const handleImportData = () => {
    Alert.alert(
      'Import Data',
      'This will import class templates and schedules from a CSV file.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Select File', onPress: () => {
          // Implement import functionality
          Alert.alert('Coming Soon', 'Import functionality will be available in the next update.');
        }},
      ]
    );
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'This will reset all schedule management settings to their defaults. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setSettings({
              autoApprovalEnabled: false,
              notificationsEnabled: true,
              emailReminders: true,
              showFullNames: true,
              compactView: false,
              weekStartsMonday: true,
              show24HourTime: false,
              defaultClassDuration: 60,
              defaultCapacity: 12,
              advanceBookingDays: 7,
              cancellationHours: 24,
              waitlistAutoPromotion: true,
              showInstructorNotes: true,
            });
            Alert.alert('Settings Reset', 'All settings have been reset to defaults.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Class Management */}
      <SettingSection title="Class Management">
        <SettingItem
          title="Default Duration"
          description="Default duration for new classes (minutes)"
          icon="time-outline"
          rightElement={
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.numberInput}
                value={settings.defaultClassDuration.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text) || 60;
                  updateSetting('defaultClassDuration', num);
                }}
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={styles.inputUnit}>min</Text>
            </View>
          }
        />
        
        <SettingItem
          title="Default Capacity"
          description="Default capacity for new classes"
          icon="people-outline"
          rightElement={
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.numberInput}
                value={settings.defaultCapacity.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text) || 12;
                  updateSetting('defaultCapacity', num);
                }}
                keyboardType="numeric"
                maxLength={2}
              />
              <Text style={styles.inputUnit}>spots</Text>
            </View>
          }
        />

        <SettingItem
          title="Auto-Approval"
          description="Automatically approve classes created by instructors"
          icon="checkmark-circle-outline"
          rightElement={
            <Switch
              value={settings.autoApprovalEnabled}
              onValueChange={(value) => updateSetting('autoApprovalEnabled', value)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '50' }}
              thumbColor={settings.autoApprovalEnabled ? COLORS.primary : COLORS.surface}
            />
          }
        />
      </SettingSection>

      {/* Booking Rules */}
      <SettingSection title="Booking Rules">
        <SettingItem
          title="Advance Booking"
          description="How many days in advance users can book"
          icon="calendar-outline"
          rightElement={
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.numberInput}
                value={settings.advanceBookingDays.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text) || 7;
                  updateSetting('advanceBookingDays', num);
                }}
                keyboardType="numeric"
                maxLength={2}
              />
              <Text style={styles.inputUnit}>days</Text>
            </View>
          }
        />

        <SettingItem
          title="Cancellation Window"
          description="Hours before class that cancellation is allowed"
          icon="close-circle-outline"
          rightElement={
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.numberInput}
                value={settings.cancellationHours.toString()}
                onChangeText={(text) => {
                  const num = parseInt(text) || 24;
                  updateSetting('cancellationHours', num);
                }}
                keyboardType="numeric"
                maxLength={2}
              />
              <Text style={styles.inputUnit}>hrs</Text>
            </View>
          }
        />

        <SettingItem
          title="Waitlist Auto-Promotion"
          description="Automatically promote from waitlist when spots open"
          icon="arrow-up-circle-outline"
          rightElement={
            <Switch
              value={settings.waitlistAutoPromotion}
              onValueChange={(value) => updateSetting('waitlistAutoPromotion', value)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '50' }}
              thumbColor={settings.waitlistAutoPromotion ? COLORS.primary : COLORS.surface}
            />
          }
        />
      </SettingSection>

      {/* Display Preferences */}
      <SettingSection title="Display Preferences">
        <SettingItem
          title="Show Full Names"
          description="Display full names instead of first name only"
          icon="person-outline"
          rightElement={
            <Switch
              value={settings.showFullNames}
              onValueChange={(value) => updateSetting('showFullNames', value)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '50' }}
              thumbColor={settings.showFullNames ? COLORS.primary : COLORS.surface}
            />
          }
        />

        <SettingItem
          title="Compact View"
          description="Show more classes in less space"
          icon="list-outline"
          rightElement={
            <Switch
              value={settings.compactView}
              onValueChange={(value) => updateSetting('compactView', value)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '50' }}
              thumbColor={settings.compactView ? COLORS.primary : COLORS.surface}
            />
          }
        />

        <SettingItem
          title="Week Starts Monday"
          description="Start calendar week on Monday instead of Sunday"
          icon="calendar-number-outline"
          rightElement={
            <Switch
              value={settings.weekStartsMonday}
              onValueChange={(value) => updateSetting('weekStartsMonday', value)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '50' }}
              thumbColor={settings.weekStartsMonday ? COLORS.primary : COLORS.surface}
            />
          }
        />

        <SettingItem
          title="24-Hour Time"
          description="Show time in 24-hour format"
          icon="time-outline"
          rightElement={
            <Switch
              value={settings.show24HourTime}
              onValueChange={(value) => updateSetting('show24HourTime', value)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '50' }}
              thumbColor={settings.show24HourTime ? COLORS.primary : COLORS.surface}
            />
          }
        />

        <SettingItem
          title="Show Instructor Notes"
          description="Display private instructor notes in class details"
          icon="document-text-outline"
          rightElement={
            <Switch
              value={settings.showInstructorNotes}
              onValueChange={(value) => updateSetting('showInstructorNotes', value)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '50' }}
              thumbColor={settings.showInstructorNotes ? COLORS.primary : COLORS.surface}
            />
          }
        />
      </SettingSection>

      {/* Notifications */}
      <SettingSection title="Notifications">
        <SettingItem
          title="Push Notifications"
          description="Receive notifications for class changes and bookings"
          icon="notifications-outline"
          rightElement={
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={(value) => updateSetting('notificationsEnabled', value)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '50' }}
              thumbColor={settings.notificationsEnabled ? COLORS.primary : COLORS.surface}
            />
          }
        />

        <SettingItem
          title="Email Reminders"
          description="Send email reminders for upcoming classes"
          icon="mail-outline"
          rightElement={
            <Switch
              value={settings.emailReminders}
              onValueChange={(value) => updateSetting('emailReminders', value)}
              trackColor={{ false: COLORS.border, true: COLORS.primary + '50' }}
              thumbColor={settings.emailReminders ? COLORS.primary : COLORS.surface}
            />
          }
        />
      </SettingSection>

      {/* Data Management */}
      <SettingSection title="Data Management">
        <SettingItem
          title="Export Data"
          description="Export all class and booking data"
          icon="download-outline"
          onPress={handleExportData}
          showArrow
        />

        <SettingItem
          title="Import Data"
          description="Import class templates and schedules"
          icon="cloud-upload-outline"
          onPress={handleImportData}
          showArrow
        />

        <SettingItem
          title="Reset Settings"
          description="Reset all settings to defaults"
          icon="refresh-outline"
          onPress={handleResetSettings}
          showArrow
        />
      </SettingSection>

      {/* Help & Support */}
      <SettingSection title="Help & Support">
        <SettingItem
          title="Schedule Management Guide"
          description="Learn how to use the scheduling features"
          icon="help-circle-outline"
          onPress={() => Alert.alert('Coming Soon', 'Help documentation will be available soon.')}
          showArrow
        />

        <SettingItem
          title="Keyboard Shortcuts"
          description="View available keyboard shortcuts"
          icon="keypad-outline"
          onPress={() => Alert.alert('Keyboard Shortcuts', 'Spacebar: Quick add class\nCmd+F: Search\nCmd+R: Refresh\nEsc: Close modal')}
          showArrow
        />

        <SettingItem
          title="Report Issue"
          description="Report a bug or request a feature"
          icon="bug-outline"
          onPress={() => Alert.alert('Report Issue', 'Please contact support at support@pilatesapp.com')}
          showArrow
        />
      </SettingSection>

      {/* Version Info */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Schedule Management v2.0.0</Text>
        <Text style={styles.versionSubtext}>Last updated: Today</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  sectionContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  settingContent: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  settingDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.xs,
  },
  numberInput: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
    minWidth: 30,
    textAlign: 'center',
  },
  inputUnit: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.lg,
  },
  versionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  versionSubtext: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});

export default SettingsTab;