import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';

import { COLORS, SPACING } from '../utils/config';
import { socialApi, PrivacySettings } from '../api/social';
import { useAuth } from '../hooks/useAuth';

const PrivacySettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [settings, setSettings] = useState<PrivacySettings>({
    show_in_attendees: true,
    allow_profile_viewing: true,
    show_stats: true,
  });

  // Load current privacy settings
  useEffect(() => {
    if (user?.privacy_settings) {
      setSettings(user.privacy_settings);
    }
  }, [user]);

  // Update privacy settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: PrivacySettings) => socialApi.updatePrivacySettings(newSettings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      Alert.alert('Success', 'Privacy settings updated successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to update privacy settings');
    },
  });

  const handleToggleSetting = (key: keyof PrivacySettings) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key],
    };
    setSettings(newSettings);
  };

  const handleSave = () => {
    updateSettingsMutation.mutate(settings);
  };

  const handleReset = () => {
    Alert.alert(
      'Reset to Defaults',
      'This will reset all privacy settings to their default values. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            const defaultSettings: PrivacySettings = {
              show_in_attendees: true,
              allow_profile_viewing: true,
              show_stats: true,
            };
            setSettings(defaultSettings);
            updateSettingsMutation.mutate(defaultSettings);
          },
        },
      ]
    );
  };

  const SettingRow: React.FC<{
    title: string;
    description: string;
    value: boolean;
    onToggle: () => void;
    icon: keyof typeof Ionicons.glyphMap;
  }> = ({ title, description, value, onToggle, icon }) => (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={24} color={COLORS.primary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: COLORS.lightGray, true: COLORS.primary }}
        thumbColor={COLORS.white}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Settings</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Introduction */}
        <View style={styles.section}>
          <View style={styles.introContainer}>
            <Ionicons name="shield-checkmark" size={48} color={COLORS.primary} />
            <Text style={styles.introTitle}>Your Privacy Matters</Text>
            <Text style={styles.introText}>
              Control how your information is shared with other users in the app. 
              These settings help you manage your social presence and visibility.
            </Text>
          </View>
        </View>

        {/* Privacy Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social Visibility</Text>
          
          <SettingRow
            title="Show me in class attendees"
            description="Allow others to see that you're attending a class. You'll still appear to friends even if disabled."
            value={settings.show_in_attendees}
            onToggle={() => handleToggleSetting('show_in_attendees')}
            icon="people"
          />

          <SettingRow
            title="Allow profile viewing"
            description="Let other users view your public profile. Friends can always view your profile."
            value={settings.allow_profile_viewing}
            onToggle={() => handleToggleSetting('allow_profile_viewing')}
            icon="person"
          />

          <SettingRow
            title="Show my stats"
            description="Display your class statistics (total classes, etc.) on your public profile."
            value={settings.show_stats}
            onToggle={() => handleToggleSetting('show_stats')}
            icon="bar-chart"
          />
        </View>

        {/* Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Important Information</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <Ionicons name="people" size={20} color={COLORS.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Friends</Text>
                <Text style={styles.infoText}>
                  Your friends can always see your profile and that you're attending classes, 
                  regardless of these privacy settings.
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Ionicons name="shield" size={20} color={COLORS.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Data Protection</Text>
                <Text style={styles.infoText}>
                  Your personal information (email, phone) is never shared with other users.
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Ionicons name="eye-off" size={20} color={COLORS.primary} />
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Admin & Instructors</Text>
                <Text style={styles.infoText}>
                  Studio administrators and instructors can see class attendee lists 
                  for operational purposes.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Reset Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleReset}
          >
            <Ionicons name="refresh" size={20} color={COLORS.textSecondary} />
            <Text style={styles.resetButtonText}>Reset to Defaults</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Changes to privacy settings take effect immediately. You can update 
            these settings at any time.
          </Text>
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
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  introContainer: {
    backgroundColor: COLORS.white,
    padding: SPACING.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  introText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    gap: SPACING.md,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  infoItem: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  resetButtonText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  footer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default PrivacySettingsScreen;