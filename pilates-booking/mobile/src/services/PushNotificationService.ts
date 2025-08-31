import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import messaging from '@react-native-firebase/messaging';
import { apiClient } from '../api/client';
import { Logger } from './LoggingService';
import { firebaseConfigService } from './FirebaseConfigService';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationConfig {
  enabled: boolean;
  token?: string;
  registered: boolean;
  platform: string;
  supportedPlatform: boolean;
}

export interface DeviceTokenData {
  token: string;
  platform: 'android' | 'ios';
  app_version?: string;
  device_info?: {
    deviceName?: string;
    osVersion?: string;
    manufacturer?: string;
    modelName?: string;
  };
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private config: PushNotificationConfig = {
    enabled: false,
    registered: false,
    platform: Platform.OS,
    supportedPlatform: Platform.OS === 'android'
  };

  private notificationListeners: Array<() => void> = [];

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  async initialize(): Promise<PushNotificationConfig> {
    Logger.info('[PUSH] Initializing push notification service');

    try {
      // Check platform support
      if (!this.config.supportedPlatform) {
        Logger.info('[PUSH] Platform not supported', { platform: Platform.OS });
        return this.config;
      }

      // Check if running on physical device
      if (!Device.isDevice) {
        Logger.warn('[PUSH] Push notifications require physical device');
        return this.config;
      }

      // Request permissions
      const permissionResult = await this.requestPermissions();
      if (!permissionResult.granted) {
        Logger.warn('[PUSH] Push notification permissions denied');
        return this.config;
      }

      // Get push token
      const token = await this.getExpoPushToken();
      if (!token) {
        Logger.error('[PUSH] Failed to get push token');
        return this.config;
      }

      this.config.token = token;
      this.config.enabled = true;

      // Register with backend
      const registered = await this.registerWithBackend(token);
      this.config.registered = registered;

      // Set up notification listeners
      this.setupNotificationListeners();

      Logger.info('[PUSH] Push notification service initialized successfully', {
        platform: this.config.platform,
        enabled: this.config.enabled,
        registered: this.config.registered
      });

    } catch (error) {
      Logger.error('[PUSH] Failed to initialize push notifications', { error });
    }

    return this.config;
  }

  private async requestPermissions(): Promise<{ granted: boolean; status: string }> {
    if (Platform.OS === 'ios') {
      // iOS permission request
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      return {
        granted: finalStatus === 'granted',
        status: finalStatus
      };
    } else {
      // Android - permissions are usually granted by default for notifications
      const { status } = await Notifications.requestPermissionsAsync();
      return {
        granted: status === 'granted',
        status
      };
    }
  }

  private async getExpoPushToken(): Promise<string | null> {
    try {
      // Check if device supports push notifications
      if (!Device.isDevice) {
        Logger.warn('[PUSH] Push tokens require physical device, simulator not supported');
        return null;
      }

      // Validate configuration before proceeding
      const configValidation = firebaseConfigService.validateConfiguration();
      if (!configValidation.isValid) {
        Logger.error('[PUSH] Configuration validation failed', {
          errors: configValidation.errors,
          debugInfo: firebaseConfigService.getDebugInfo()
        });
        throw new Error(`Configuration invalid: ${configValidation.errors.join(', ')}`);
      }

      Logger.info('[PUSH] Requesting FCM token from Firebase...');
      
      // Get FCM token directly from Firebase (this is what the backend expects)
      const fcmToken = await messaging().getToken();

      if (!fcmToken) {
        Logger.error('[PUSH] FCM token is empty or invalid');
        return null;
      }

      Logger.info('[PUSH] Got FCM token successfully', { 
        token: fcmToken.substring(0, 20) + '...',
        tokenLength: fcmToken.length
      });

      return fcmToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Enhanced error logging with troubleshooting info
      const debugInfo = {
        error: errorMessage,
        stack: errorStack,
        isDevice: Device.isDevice,
        platform: Platform.OS,
        config: firebaseConfigService.getDebugInfo(),
        troubleshooting: this.getTroubleshootingSteps(errorMessage)
      };
      
      Logger.error('[PUSH] Failed to get Expo push token', debugInfo);
      
      // Provide helpful error message to user
      if (errorMessage?.includes('FirebaseApp is not initialized')) {
        throw new Error('Firebase not properly configured. Please check your google-services.json file and rebuild the app.');
      } else if (errorMessage?.includes('No FCM token')) {
        throw new Error('Unable to generate push token. Make sure you have a valid Firebase project and network connection.');
      } else {
        throw new Error(`Push token generation failed: ${errorMessage}`);
      }
    }
  }

  private async registerWithBackend(token: string): Promise<boolean> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      
      const tokenData: DeviceTokenData = {
        token,
        platform: Platform.OS as 'android' | 'ios',
        app_version: Application.nativeApplicationVersion || undefined,
        device_info: deviceInfo
      };

      const response = await apiClient.post('/api/v1/device-tokens/register', tokenData);
      
      Logger.info('[PUSH] Device token registered with backend successfully', { 
        response: response.data,
        tokenLength: token.length 
      });
      return true;
    } catch (error) {
      const errorDetails = {
        error: error instanceof Error ? error.message : error,
        status: (error as any)?.response?.status,
        statusText: (error as any)?.response?.statusText,
        data: (error as any)?.response?.data,
        tokenData: {
          platform: tokenData.platform,
          tokenLength: token.length,
          hasDeviceInfo: !!tokenData.device_info
        }
      };
      Logger.error('[PUSH] Failed to register device token with backend', errorDetails);
      return false;
    }
  }

  private async getDeviceInfo(): Promise<DeviceTokenData['device_info']> {
    try {
      return {
        deviceName: Device.deviceName || undefined,
        osVersion: Device.osVersion || undefined,
        manufacturer: Device.manufacturer || undefined,
        modelName: Device.modelName || undefined,
      };
    } catch (error) {
      Logger.warn('[PUSH] Failed to get device info', { error });
      return {};
    }
  }

  private setupNotificationListeners(): void {
    // Listener for notifications received while app is foregrounded
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      Logger.info('[PUSH] Notification received in foreground', {
        title: notification.request.content.title,
        body: notification.request.content.body,
      });
      
      this.handleNotificationReceived(notification);
    });

    // Listener for notification interactions (user taps notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      Logger.info('[PUSH] Notification response received', {
        actionIdentifier: response.actionIdentifier,
        userText: response.userText,
      });
      
      this.handleNotificationResponse(response);
    });

    this.notificationListeners.push(
      () => foregroundSubscription.remove(),
      () => responseSubscription.remove()
    );
  }

  private handleNotificationReceived(notification: Notifications.Notification): void {
    const data = notification.request.content.data;
    
    // Log notification data for debugging
    Logger.info('[PUSH] Processing received notification', { data });
    
    // Handle notification based on type
    if (data?.type) {
      this.handleNotificationByType(data.type as string, data);
    }
  }

  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data;
    
    Logger.info('[PUSH] Processing notification response', { data });
    
    // Handle notification interaction based on type
    if (data?.type) {
      this.handleNotificationInteraction(data.type as string, data);
    }
  }

  private handleNotificationByType(type: string, data: any): void {
    switch (type) {
      case 'booking_success':
        // Could trigger a booking refresh or show success animation
        Logger.info('[PUSH] Booking success notification', { data });
        break;
      
      case 'booking_cancelled':
        // Could trigger a booking refresh or show cancellation info
        Logger.info('[PUSH] Booking cancelled notification', { data });
        break;
      
      case 'payment_failed':
        // Could navigate to payment screen or show alert
        Logger.info('[PUSH] Payment failed notification', { data });
        break;
      
      case 'admin_announcement':
        // Could show announcement modal or navigate to announcements
        Logger.info('[PUSH] Admin announcement notification', { data });
        break;
      
      default:
        Logger.info('[PUSH] Unknown notification type', { type, data });
    }
  }

  private handleNotificationInteraction(type: string, data: any): void {
    // Handle what happens when user taps on notification
    switch (type) {
      case 'booking_success':
      case 'booking_cancelled':
        // Navigate to bookings screen
        // Note: Navigation would need to be set up with a navigation ref
        Logger.info('[PUSH] Should navigate to bookings', { type });
        break;
      
      case 'payment_failed':
        // Navigate to payment/packages screen
        Logger.info('[PUSH] Should navigate to payment', { type });
        break;
      
      case 'admin_announcement':
        // Navigate to notifications or announcements screen
        Logger.info('[PUSH] Should navigate to notifications', { type });
        break;
      
      default:
        // Navigate to notifications screen as fallback
        Logger.info('[PUSH] Should navigate to notifications (fallback)', { type });
    }
  }

  async refreshToken(): Promise<boolean> {
    if (!this.config.supportedPlatform) {
      return false;
    }

    try {
      const token = await this.getExpoPushToken();
      if (token && token !== this.config.token) {
        const registered = await this.registerWithBackend(token);
        this.config.token = token;
        this.config.registered = registered;
        
        Logger.info('[PUSH] Token refreshed', { registered });
        return registered;
      }
      return true;
    } catch (error) {
      Logger.error('[PUSH] Failed to refresh token', { error });
      return false;
    }
  }

  async deregister(): Promise<void> {
    try {
      if (this.config.token) {
        // Deactivate all tokens for current user
        await apiClient.delete('/api/v1/device-tokens/deactivate-all', {
          params: { platform: Platform.OS }
        });
      }

      // Remove notification listeners
      this.notificationListeners.forEach(removeListener => removeListener());
      this.notificationListeners = [];

      // Reset config
      this.config = {
        enabled: false,
        registered: false,
        platform: Platform.OS,
        supportedPlatform: Platform.OS === 'android'
      };

      Logger.info('[PUSH] Push notifications deregistered');
    } catch (error) {
      Logger.error('[PUSH] Failed to deregister push notifications', { error });
    }
  }

  getConfig(): PushNotificationConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.registered;
  }

  isSupportedPlatform(): boolean {
    return this.config.supportedPlatform;
  }

  async testPushNotification(): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('Push notifications not enabled');
    }

    // This would trigger a test notification from the backend
    try {
      await apiClient.post('/api/v1/emails/test', {
        template_type: 'generic_notification',
        language: 'en'
      });
      
      Logger.info('[PUSH] Test notification requested');
    } catch (error) {
      Logger.error('[PUSH] Failed to request test notification', { error });
      throw error;
    }
  }

  // Method to set up navigation ref for handling notification interactions
  setNavigationRef(navigationRef: any): void {
    // This would be used to navigate when notifications are tapped
    // Implementation depends on navigation setup
    Logger.info('[PUSH] Navigation ref set for push notifications');
  }

  cleanup(): void {
    this.notificationListeners.forEach(removeListener => removeListener());
    this.notificationListeners = [];
  }

  /**
   * Get troubleshooting steps based on error type
   */
  private getTroubleshootingSteps(errorMessage: string): string[] {
    const steps: string[] = [];

    if (errorMessage?.includes('FirebaseApp is not initialized')) {
      steps.push('1. Verify google-services.json is in android/app/ directory');
      steps.push('2. Check that com.google.gms.google-services plugin is applied in build.gradle');
      steps.push('3. Ensure package name matches between app.json, build.gradle, and google-services.json');
      steps.push('4. Clean and rebuild the app');
    } else if (errorMessage?.includes('No FCM token')) {
      steps.push('1. Check internet connection');
      steps.push('2. Verify Firebase project is active');
      steps.push('3. Ensure app has notification permissions');
    } else if (errorMessage?.includes('project not found')) {
      steps.push('1. Verify Expo project ID in app.json');
      steps.push('2. Check if you have access to the Expo project');
      steps.push('3. Try expo login if needed');
    }

    return steps;
  }

  /**
   * Get comprehensive configuration status for debugging
   */
  public getConfigurationStatus(): any {
    return {
      service: {
        enabled: this.enabled,
        platform: Platform.OS,
        isDevice: Device.isDevice,
        supported: Platform.OS === 'android'
      },
      configuration: firebaseConfigService.getDebugInfo(),
      troubleshooting: 'Run this method to get detailed config information'
    };
  }
}

export const pushNotificationService = PushNotificationService.getInstance();