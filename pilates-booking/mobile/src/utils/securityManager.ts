import { AppState, Alert, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { secureStorage } from './secureStorage';

export interface SecurityConfig {
  autoLogoutMinutes: number;
  enableBiometric: boolean;
  clearDataOnBackground: boolean;
  enableJailbreakDetection: boolean;
}

export class SecurityManager {
  private static instance: SecurityManager;
  private autoLogoutTimer: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null;
  private lastActiveTime: number = Date.now();
  private config: SecurityConfig = {
    autoLogoutMinutes: 15,
    enableBiometric: false,
    clearDataOnBackground: true,
    enableJailbreakDetection: true,
  };
  private onAutoLogout?: () => void;
  private onAppBackground?: () => void;

  public static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  async initialize(config: Partial<SecurityConfig> = {}): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Load saved configuration
    const savedConfig = await secureStorage.getItem('security_config');
    if (savedConfig) {
      try {
        this.config = { ...this.config, ...JSON.parse(savedConfig) };
      } catch (error) {
        console.warn('Failed to parse saved security config:', error);
      }
    }

    this.setupAppStateHandling();
    this.setupAutoLogout();
    
    if (this.config.enableJailbreakDetection) {
      await this.checkDeviceSecurity();
    }
  }

  setCallbacks(onAutoLogout: () => void, onAppBackground?: () => void): void {
    this.onAutoLogout = onAutoLogout;
    this.onAppBackground = onAppBackground;
  }

  async updateConfig(newConfig: Partial<SecurityConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    await secureStorage.setItem('security_config', JSON.stringify(this.config));
    
    // Restart auto-logout with new timing
    this.setupAutoLogout();
  }

  private setupAppStateHandling(): void {
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        this.handleAppForeground();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        this.handleAppBackground();
      }
    });
  }

  private setupAutoLogout(): void {
    if (this.autoLogoutTimer) {
      clearTimeout(this.autoLogoutTimer);
    }

    const timeoutMs = this.config.autoLogoutMinutes * 60 * 1000;
    this.autoLogoutTimer = setTimeout(() => {
      this.triggerAutoLogout();
    }, timeoutMs);
  }

  resetAutoLogoutTimer(): void {
    this.lastActiveTime = Date.now();
    this.setupAutoLogout();
  }

  private async handleAppBackground(): Promise<void> {
    if (this.config.clearDataOnBackground && this.onAppBackground) {
      this.onAppBackground();
    }
    
    // Store the time when app went to background
    await secureStorage.setItem('background_time', Date.now().toString());
  }

  private async handleAppForeground(): Promise<void> {
    const backgroundTimeStr = await secureStorage.getItem('background_time');
    if (backgroundTimeStr) {
      const backgroundTime = parseInt(backgroundTimeStr, 10);
      const timeInBackground = Date.now() - backgroundTime;
      const autoLogoutMs = this.config.autoLogoutMinutes * 60 * 1000;

      if (timeInBackground > autoLogoutMs) {
        this.triggerAutoLogout();
        return;
      }
    }

    // Check if biometric authentication is required
    if (this.config.enableBiometric) {
      const biometricAvailable = await secureStorage.isBiometricAvailable();
      if (biometricAvailable) {
        const authenticated = await secureStorage.authenticateWithBiometric();
        if (!authenticated) {
          this.triggerAutoLogout();
          return;
        }
      }
    }

    this.resetAutoLogoutTimer();
  }

  private triggerAutoLogout(): void {
    if (this.onAutoLogout) {
      this.onAutoLogout();
    }
  }

  async enableBiometric(): Promise<boolean> {
    const available = await secureStorage.isBiometricAvailable();
    if (!available) {
      Alert.alert(
        'Biometric Not Available',
        'Biometric authentication is not available on this device or not set up.'
      );
      return false;
    }

    const authenticated = await secureStorage.authenticateWithBiometric();
    if (authenticated) {
      await this.updateConfig({ enableBiometric: true });
      return true;
    }
    return false;
  }

  async disableBiometric(): Promise<void> {
    await this.updateConfig({ enableBiometric: false });
  }

  private async checkDeviceSecurity(): Promise<void> {
    try {
      const isJailbroken = await this.detectJailbreak();
      if (isJailbroken) {
        Alert.alert(
          'Security Warning',
          'This app cannot run on jailbroken/rooted devices for security reasons.',
          [{ text: 'OK', onPress: () => this.triggerAutoLogout() }]
        );
        return;
      }
    } catch (error) {
      console.warn('Failed to check device security:', error);
    }
  }

  private async detectJailbreak(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // Check for common jailbreak indicators on iOS
        const jailbreakPaths = [
          '/Applications/Cydia.app',
          '/Library/MobileSubstrate/MobileSubstrate.dylib',
          '/bin/bash',
          '/usr/sbin/sshd',
          '/etc/apt',
          '/private/var/lib/apt/',
        ];

        // Note: In a real app, you'd use native modules to check these paths
        // React Native can't access file system directly for security checks
        return false; // Placeholder - implement with native modules
      } else {
        // Check for common root indicators on Android
        const rootPaths = [
          '/system/app/Superuser.apk',
          '/sbin/su',
          '/system/bin/su',
          '/system/xbin/su',
          '/data/local/xbin/su',
          '/data/local/bin/su',
          '/system/sd/xbin/su',
          '/system/bin/failsafe/su',
          '/data/local/su',
        ];

        // Note: Similar to iOS, implement with native modules
        return false; // Placeholder
      }
    } catch (error) {
      console.warn('Jailbreak detection failed:', error);
      return false;
    }
  }

  async getDeviceInfo(): Promise<any> {
    try {
      return {
        deviceId: await Application.getAndroidId(), // Android only
        deviceName: Device.deviceName,
        deviceType: Device.deviceType,
        osName: Device.osName,
        osVersion: Device.osVersion,
        brand: Device.brand,
        manufacturer: Device.manufacturer,
        modelName: Device.modelName,
      };
    } catch (error) {
      console.warn('Failed to get device info:', error);
      return {};
    }
  }

  cleanup(): void {
    if (this.autoLogoutTimer) {
      clearTimeout(this.autoLogoutTimer);
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }

  async clearAllSecureData(): Promise<void> {
    await secureStorage.clear();
  }

  getConfig(): SecurityConfig {
    return { ...this.config };
  }
}

export const securityManager = SecurityManager.getInstance();