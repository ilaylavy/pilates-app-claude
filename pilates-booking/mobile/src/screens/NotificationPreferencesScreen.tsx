import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { COLORS, SPACING } from '../utils/config';
import { useTranslation } from '../hooks/useTranslation';
import { notificationsApi } from '../api/notifications';
import { Logger } from '../services/LoggingService';
import { useAuth } from '../hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface NotificationPreference {
  id: number;
  user_id: number;
  notification_type: string;
  channel_email: boolean;
  channel_push: boolean;
  channel_in_app: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface NotificationTypeInfo {
  type: string;
  nameKey: string;
  descriptionKey: string;
  icon: string;
  category: 'booking' | 'payment' | 'package' | 'system' | 'announcement';
  defaultEnabled: boolean;
}

// Notification type configurations
const NOTIFICATION_TYPES: NotificationTypeInfo[] = [
  // Booking notifications
  {
    type: 'BOOKING_SUCCESS',
    nameKey: 'notifications.types.bookingSuccess',
    descriptionKey: 'notifications.types.bookingSuccessDesc',
    icon: 'checkmark-circle',
    category: 'booking',
    defaultEnabled: true
  },
  {
    type: 'BOOKING_CANCELLED',
    nameKey: 'notifications.types.bookingCancelled',
    descriptionKey: 'notifications.types.bookingCancelledDesc',
    icon: 'close-circle',
    category: 'booking',
    defaultEnabled: true
  },
  {
    type: 'WAITLIST_PROMOTED',
    nameKey: 'notifications.types.waitlistPromoted',
    descriptionKey: 'notifications.types.waitlistPromotedDesc',
    icon: 'arrow-up-circle',
    category: 'booking',
    defaultEnabled: true
  },
  {
    type: 'CLASS_REMINDER',
    nameKey: 'notifications.types.classReminder',
    descriptionKey: 'notifications.types.classReminderDesc',
    icon: 'time',
    category: 'booking',
    defaultEnabled: true
  },
  
  // Payment notifications
  {
    type: 'PAYMENT_PROCESSED',
    nameKey: 'notifications.types.paymentProcessed',
    descriptionKey: 'notifications.types.paymentProcessedDesc',
    icon: 'card',
    category: 'payment',
    defaultEnabled: true
  },
  {
    type: 'PAYMENT_FAILED',
    nameKey: 'notifications.types.paymentFailed',
    descriptionKey: 'notifications.types.paymentFailedDesc',
    icon: 'alert-circle',
    category: 'payment',
    defaultEnabled: true
  },
  
  // Package notifications
  {
    type: 'PACKAGE_ACTIVATED',
    nameKey: 'notifications.types.packageActivated',
    descriptionKey: 'notifications.types.packageActivatedDesc',
    icon: 'card',
    category: 'package',
    defaultEnabled: true
  },
  
  // System notifications
  {
    type: 'ACCOUNT_VERIFIED',
    nameKey: 'notifications.types.accountVerified',
    descriptionKey: 'notifications.types.accountVerifiedDesc',
    icon: 'shield-checkmark',
    category: 'system',
    defaultEnabled: true
  },
  {
    type: 'PASSWORD_RESET',
    nameKey: 'notifications.types.passwordReset',
    descriptionKey: 'notifications.types.passwordResetDesc',
    icon: 'key',
    category: 'system',
    defaultEnabled: false
  },
  {
    type: 'SYSTEM_MAINTENANCE',
    nameKey: 'notifications.types.systemMaintenance',
    descriptionKey: 'notifications.types.systemMaintenanceDesc',
    icon: 'construct',
    category: 'system',
    defaultEnabled: true
  },
  
  // Announcement notifications
  {
    type: 'ADMIN_ANNOUNCEMENT',
    nameKey: 'notifications.types.adminAnnouncement',
    descriptionKey: 'notifications.types.adminAnnouncementDesc',
    icon: 'megaphone',
    category: 'announcement',
    defaultEnabled: true
  },
  {
    type: 'URGENT_ANNOUNCEMENT',
    nameKey: 'notifications.types.urgentAnnouncement',
    descriptionKey: 'notifications.types.urgentAnnouncementDesc',
    icon: 'alert-triangle',
    category: 'announcement',
    defaultEnabled: true
  },
  {
    type: 'GENERAL_ANNOUNCEMENT',
    nameKey: 'notifications.types.generalAnnouncement',
    descriptionKey: 'notifications.types.generalAnnouncementDesc',
    icon: 'information-circle',
    category: 'announcement',
    defaultEnabled: false
  }
];

const NotificationPreferencesScreen: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  
  // Push notifications hook
  const pushNotifications = usePushNotifications();

  // Fetch preferences
  const {
    data: preferences = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: () => notificationsApi.getPreferences(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update preference mutation
  const updatePreferenceMutation = useMutation({
    mutationFn: (params: {
      notificationType: string;
      updates: {
        channel_email?: boolean;
        channel_push?: boolean;
        channel_in_app?: boolean;
        enabled?: boolean;
      };
    }) => notificationsApi.updatePreferences(params.notificationType, params.updates),
    onMutate: async ({ notificationType, updates }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['notifications', 'preferences'] });
      
      const previousPreferences = queryClient.getQueryData<NotificationPreference[]>(
        ['notifications', 'preferences']
      );
      
      queryClient.setQueryData<NotificationPreference[]>(
        ['notifications', 'preferences'],
        (old = []) => old.map(pref => 
          pref.notification_type === notificationType
            ? { ...pref, ...updates, updated_at: new Date().toISOString() }
            : pref
        )
      );
      
      return { previousPreferences };
    },
    onError: (error, variables, context) => {
      // Revert optimistic update
      if (context?.previousPreferences) {
        queryClient.setQueryData(
          ['notifications', 'preferences'],
          context.previousPreferences
        );
      }
      
      Logger.error('Failed to update notification preference', error as Error, {
        notificationType: variables.notificationType,
        updates: variables.updates
      });
      
      Alert.alert(
        t('errors.generic'),
        t('notifications.preferences.updateError'),
        [{ text: t('common.ok'), style: 'default' }]
      );
    },
    onSuccess: (_, variables) => {
      Logger.info('Notification preference updated', {
        notificationType: variables.notificationType,
        updates: variables.updates
      });
      
      Logger.trackEvent('notification.preference_updated', {
        notificationType: variables.notificationType,
        ...variables.updates
      });
    }
  });

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Get preference for notification type
  const getPreference = useCallback((notificationType: string): NotificationPreference | null => {
    return preferences.find(p => p.notification_type === notificationType) || null;
  }, [preferences]);

  // Handle toggle changes
  const handleToggle = useCallback((
    notificationType: string, 
    field: 'enabled' | 'channel_email' | 'channel_push' | 'channel_in_app',
    value: boolean
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    updatePreferenceMutation.mutate({
      notificationType,
      updates: { [field]: value }
    });
  }, [updatePreferenceMutation]);

  // Group notifications by category
  const groupedTypes = NOTIFICATION_TYPES.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {} as Record<string, NotificationTypeInfo[]>);

  // Render category header
  const renderCategoryHeader = (category: string) => {
    const categoryIcons = {
      booking: 'calendar',
      payment: 'card',
      package: 'gift',
      system: 'settings',
      announcement: 'megaphone'
    };

    return (
      <View style={styles.categoryHeader}>
        <Ionicons 
          name={categoryIcons[category as keyof typeof categoryIcons] as any} 
          size={20} 
          color={COLORS.primary} 
        />
        <Text style={styles.categoryTitle}>
          {t(`notifications.categories.${category}`)}
        </Text>
      </View>
    );
  };

  // Render notification type row
  const renderNotificationType = (typeInfo: NotificationTypeInfo) => {
    const preference = getPreference(typeInfo.type);
    const isEnabled = preference?.enabled ?? typeInfo.defaultEnabled;
    const channelEmail = preference?.channel_email ?? true;
    const channelPush = preference?.channel_push ?? true;
    const channelInApp = preference?.channel_in_app ?? true;

    return (
      <View key={typeInfo.type} style={styles.notificationRow}>
        <View style={styles.notificationInfo}>
          <View style={styles.notificationHeader}>
            <Ionicons 
              name={typeInfo.icon as any} 
              size={20} 
              color={isEnabled ? COLORS.primary : COLORS.textSecondary} 
            />
            <Text style={[
              styles.notificationName,
              !isEnabled && styles.disabledText
            ]}>
              {t(typeInfo.nameKey)}
            </Text>
          </View>
          <Text style={styles.notificationDescription}>
            {t(typeInfo.descriptionKey)}
          </Text>
          
          {isEnabled && (
            <View style={styles.channelToggles}>
              <View style={styles.channelToggle}>
                <Ionicons name="mail" size={16} color={COLORS.textSecondary} />
                <Text style={styles.channelLabel}>{t('notifications.channels.email')}</Text>
                <Switch
                  value={channelEmail}
                  onValueChange={(value) => handleToggle(typeInfo.type, 'channel_email', value)}
                  trackColor={{ false: COLORS.border, true: `${COLORS.primary}50` }}
                  thumbColor={channelEmail ? COLORS.primary : COLORS.textSecondary}
                  disabled={updatePreferenceMutation.isPending}
                />
              </View>
              
              <View style={styles.channelToggle}>
                <Ionicons 
                  name="phone-portrait" 
                  size={16} 
                  color={pushNotifications.isSupported ? COLORS.textSecondary : COLORS.disabled} 
                />
                <Text style={[
                  styles.channelLabel,
                  !pushNotifications.isSupported && styles.disabledText
                ]}>
                  {t('notifications.channels.push')}
                  {Platform.OS === 'ios' && ' (Coming Soon)'}
                </Text>
                {pushNotifications.isSupported ? (
                  <Switch
                    value={channelPush && pushNotifications.isEnabled}
                    onValueChange={(value) => handleToggle(typeInfo.type, 'channel_push', value)}
                    trackColor={{ false: COLORS.border, true: `${COLORS.primary}50` }}
                    thumbColor={channelPush && pushNotifications.isEnabled ? COLORS.primary : COLORS.textSecondary}
                    disabled={updatePreferenceMutation.isPending || !pushNotifications.isEnabled}
                  />
                ) : (
                  <TouchableOpacity 
                    onPress={pushNotifications.showPlatformInfo}
                    style={styles.infoButton}
                  >
                    <Ionicons name="information-circle" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.channelToggle}>
                <Ionicons name="notifications" size={16} color={COLORS.textSecondary} />
                <Text style={styles.channelLabel}>{t('notifications.channels.inApp')}</Text>
                <Switch
                  value={channelInApp}
                  onValueChange={(value) => handleToggle(typeInfo.type, 'channel_in_app', value)}
                  trackColor={{ false: COLORS.border, true: `${COLORS.primary}50` }}
                  thumbColor={channelInApp ? COLORS.primary : COLORS.textSecondary}
                  disabled={updatePreferenceMutation.isPending}
                />
              </View>
            </View>
          )}
        </View>
        
        <View style={styles.mainToggle}>
          <Switch
            value={isEnabled}
            onValueChange={(value) => handleToggle(typeInfo.type, 'enabled', value)}
            trackColor={{ false: COLORS.border, true: `${COLORS.primary}50` }}
            thumbColor={isEnabled ? COLORS.primary : COLORS.textSecondary}
            disabled={updatePreferenceMutation.isPending}
          />
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('notifications.preferences.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={COLORS.error} />
          <Text style={styles.errorTitle}>{t('notifications.preferences.loadError')}</Text>
          <Text style={styles.errorSubtitle}>{t('notifications.preferences.loadErrorDesc')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
            title={t('common.pullToRefresh')}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('notifications.preferences.title')}</Text>
          <Text style={styles.subtitle}>{t('notifications.preferences.subtitle')}</Text>
        </View>

        {/* Push Notification Status Section */}
        <View style={styles.pushStatusSection}>
          <View style={styles.pushStatusHeader}>
            <Ionicons 
              name="phone-portrait" 
              size={24} 
              color={pushNotifications.isSupported ? COLORS.primary : COLORS.disabled} 
            />
            <Text style={styles.pushStatusTitle}>
              📱 Push Notifications
            </Text>
          </View>
          
          <View style={styles.pushStatusContent}>
            <Text style={[
              styles.pushStatusMessage,
              { color: pushNotifications.isEnabled ? COLORS.success : COLORS.textSecondary }
            ]}>
              {pushNotifications.statusMessage}
            </Text>
            
            {Platform.OS === 'ios' && (
              <TouchableOpacity 
                style={styles.iosInfoButton}
                onPress={pushNotifications.showPlatformInfo}
              >
                <Text style={styles.iosInfoButtonText}>Why iOS isn't supported yet?</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            )}
            
            {Platform.OS === 'android' && !pushNotifications.isEnabled && (
              <TouchableOpacity 
                style={styles.enableButton}
                onPress={pushNotifications.initializePushNotifications}
                disabled={pushNotifications.isLoading}
              >
                {pushNotifications.isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Text style={styles.enableButtonText}>Enable Push Notifications</Text>
                    <Ionicons name="notifications" size={16} color="white" />
                  </>
                )}
              </TouchableOpacity>
            )}
            
            {Platform.OS === 'android' && pushNotifications.isEnabled && (
              <TouchableOpacity 
                style={styles.testButton}
                onPress={pushNotifications.testPushNotification}
              >
                <Text style={styles.testButtonText}>Test Push Notification</Text>
                <Ionicons name="paper-plane" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {Object.entries(groupedTypes).map(([category, types]) => (
          <View key={category} style={styles.categorySection}>
            {renderCategoryHeader(category)}
            {types.map(renderNotificationType)}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {t('notifications.preferences.footerText')}
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  categorySection: {
    marginBottom: SPACING.lg,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: `${COLORS.primary}10`,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  notificationInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  notificationName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  disabledText: {
    color: COLORS.textSecondary,
  },
  notificationDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  channelToggles: {
    gap: SPACING.sm,
  },
  channelToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  channelLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    flex: 1,
  },
  mainToggle: {
    justifyContent: 'flex-start',
    paddingTop: SPACING.xs,
  },
  footer: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoButton: {
    padding: SPACING.xs,
  },
  pushStatusSection: {
    margin: SPACING.lg,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pushStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  pushStatusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  pushStatusContent: {
    gap: SPACING.md,
  },
  pushStatusMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  iosInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${COLORS.primary}20`,
  },
  iosInfoButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    gap: SPACING.sm,
  },
  enableButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: SPACING.sm,
  },
  testButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
});

export default NotificationPreferencesScreen;