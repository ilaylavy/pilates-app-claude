import { useEffect, useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { useAuth } from './useAuth';
import { pushNotificationService, PushNotificationConfig } from '../services/PushNotificationService';
import { Logger } from '../services/LoggingService';

export interface PushNotificationState {
  config: PushNotificationConfig;
  isLoading: boolean;
  error: string | null;
  isSupported: boolean;
  statusMessage: string;
}

export const usePushNotifications = () => {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    config: {
      enabled: false,
      registered: false,
      platform: Platform.OS,
      supportedPlatform: Platform.OS === 'android'
    },
    isLoading: false,
    error: null,
    isSupported: Platform.OS === 'android',
    statusMessage: getPlatformStatusMessage()
  });

  // Initialize push notifications when user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      initializePushNotifications();
    } else if (!isAuthenticated) {
      // Clean up when user logs out
      deregisterPushNotifications();
    }
  }, [isAuthenticated, user]);

  const initializePushNotifications = useCallback(async () => {
    if (!state.isSupported) {
      Logger.info('[PUSH_HOOK] Platform not supported, skipping initialization');
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const config = await pushNotificationService.initialize();
      
      setState(prev => ({
        ...prev,
        config,
        isLoading: false,
        statusMessage: getStatusMessage(config)
      }));

      // Show user feedback
      if (config.enabled && config.registered) {
        Logger.info('[PUSH_HOOK] Push notifications enabled successfully');
      } else if (config.enabled && !config.registered) {
        Logger.warn('[PUSH_HOOK] Push notifications enabled but not registered with backend');
        setState(prev => ({
          ...prev,
          error: 'Failed to register with server. Notifications may not work.'
        }));
      }

    } catch (error) {
      Logger.error('[PUSH_HOOK] Failed to initialize push notifications', { error });
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to set up push notifications',
        statusMessage: 'Push notifications unavailable'
      }));
    }
  }, [state.isSupported]);

  const deregisterPushNotifications = useCallback(async () => {
    try {
      await pushNotificationService.deregister();
      setState(prev => ({
        ...prev,
        config: {
          enabled: false,
          registered: false,
          platform: Platform.OS,
          supportedPlatform: Platform.OS === 'android'
        },
        error: null,
        statusMessage: getPlatformStatusMessage()
      }));
    } catch (error) {
      Logger.error('[PUSH_HOOK] Failed to deregister push notifications', { error });
    }
  }, []);

  const refreshToken = useCallback(async () => {
    if (!state.isSupported || !isAuthenticated) {
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const success = await pushNotificationService.refreshToken();
      const config = pushNotificationService.getConfig();
      
      setState(prev => ({
        ...prev,
        config,
        isLoading: false,
        statusMessage: getStatusMessage(config)
      }));

      return success;
    } catch (error) {
      Logger.error('[PUSH_HOOK] Failed to refresh token', { error });
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to refresh push token'
      }));
      return false;
    }
  }, [state.isSupported, isAuthenticated]);

  const testPushNotification = useCallback(async () => {
    if (!state.config.enabled || !state.config.registered) {
      Alert.alert(
        'Push Notifications Not Available',
        state.isSupported 
          ? 'Please enable push notifications first.'
          : 'Push notifications are currently available for Android devices only. iOS support coming soon!'
      );
      return;
    }

    try {
      await pushNotificationService.testPushNotification();
      Alert.alert(
        'Test Notification Sent',
        'A test notification has been sent. You should receive it shortly.'
      );
    } catch (error) {
      Logger.error('[PUSH_HOOK] Failed to send test notification', { error });
      Alert.alert(
        'Test Failed',
        'Failed to send test notification. Please try again.'
      );
    }
  }, [state.config, state.isSupported]);

  const showPlatformInfo = useCallback(() => {
    if (Platform.OS === 'ios') {
      Alert.alert(
        '📱 iOS Push Notifications Coming Soon!',
        'Push notifications are currently available for Android devices only.\n\n' +
        '✅ What works now:\n• In-app notifications\n• Email notifications\n\n' +
        '🚀 Coming soon for iOS:\n• Push notifications when we get our Apple Developer account\n\n' +
        'You\'ll be the first to know when iOS push notifications are ready!',
        [{ text: 'Got it!', style: 'default' }]
      );
    } else {
      Alert.alert(
        '🔔 Android Push Notifications',
        'Push notifications are fully supported on Android!\n\n' +
        '✅ You can receive:\n• Booking confirmations\n• Class reminders\n• Payment notifications\n• Studio announcements\n\n' +
        'Make sure to allow notifications when prompted.',
        [{ text: 'Sounds good!', style: 'default' }]
      );
    }
  }, []);

  return {
    ...state,
    initializePushNotifications,
    deregisterPushNotifications,
    refreshToken,
    testPushNotification,
    showPlatformInfo,
    isEnabled: state.config.enabled && state.config.registered
  };
};

function getPlatformStatusMessage(): string {
  if (Platform.OS === 'android') {
    return 'Push notifications available';
  } else {
    return 'iOS push notifications coming soon';
  }
}

function getStatusMessage(config: PushNotificationConfig): string {
  if (!config.supportedPlatform) {
    return 'iOS push notifications coming soon';
  }
  
  if (config.enabled && config.registered) {
    return 'Push notifications active';
  } else if (config.enabled && !config.registered) {
    return 'Push notifications enabled (registration pending)';
  } else {
    return 'Push notifications disabled';
  }
}