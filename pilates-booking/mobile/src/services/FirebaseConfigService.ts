import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { Logger } from './LoggingService';

interface FirebaseConfig {
  projectId: string;
  appId: string;
  messagingSenderId: string;
}

interface ExpoConfig {
  projectId: string;
  slug: string;
}

class FirebaseConfigService {
  private static instance: FirebaseConfigService;
  private firebaseConfig: FirebaseConfig | null = null;
  private expoConfig: ExpoConfig | null = null;

  public static getInstance(): FirebaseConfigService {
    if (!FirebaseConfigService.instance) {
      FirebaseConfigService.instance = new FirebaseConfigService();
    }
    return FirebaseConfigService.instance;
  }

  /**
   * Get Firebase configuration from google-services.json (Android) or GoogleService-Info.plist (iOS)
   * This is automatically embedded by Expo during build
   */
  public getFirebaseConfig(): FirebaseConfig {
    if (this.firebaseConfig) {
      return this.firebaseConfig;
    }

    try {
      // Expo automatically embeds Firebase config from google-services.json
      const firebaseConfig = Constants.expoConfig?.extra?.firebase ||
                            Constants.manifest?.extra?.firebase ||
                            Constants.manifest2?.extra?.firebase;

      if (firebaseConfig) {
        this.firebaseConfig = {
          projectId: firebaseConfig.projectId,
          appId: firebaseConfig.appId,
          messagingSenderId: firebaseConfig.messagingSenderId
        };
        
        Logger.info('[FIREBASE_CONFIG] Loaded from Expo constants', {
          projectId: this.firebaseConfig.projectId,
          hasAppId: !!this.firebaseConfig.appId
        });
        
        return this.firebaseConfig;
      }

      // Fallback: Try to read from native Firebase config
      if (Platform.OS === 'android') {
        // For Android, try to read from embedded google-services.json
        const androidConfig = this.getAndroidFirebaseConfig();
        if (androidConfig) {
          this.firebaseConfig = androidConfig;
          return this.firebaseConfig;
        }
      }

      throw new Error('Firebase configuration not found in app');
      
    } catch (error) {
      Logger.error('[FIREBASE_CONFIG] Failed to load Firebase config', error);
      
      // Last resort fallback - but log warning
      Logger.warn('[FIREBASE_CONFIG] Using fallback config - update google-services.json for production');
      
      this.firebaseConfig = {
        projectId: 'pilates-app-98b07', // Read from google-services.json
        appId: '1:581407140324:android:b0d1a9741ee99d34efbff1',
        messagingSenderId: '581407140324'
      };
      
      return this.firebaseConfig;
    }
  }

  /**
   * Get Expo configuration for push tokens
   */
  public getExpoConfig(): ExpoConfig {
    if (this.expoConfig) {
      return this.expoConfig;
    }

    try {
      // Read from app.json/expo config
      const expoConfig = Constants.expoConfig;
      const manifest = Constants.manifest || Constants.manifest2;
      
      const projectId = expoConfig?.extra?.eas?.projectId ||
                       manifest?.extra?.eas?.projectId ||
                       Constants.easConfig?.projectId;

      const slug = expoConfig?.slug || manifest?.slug;

      if (!projectId) {
        throw new Error('Expo project ID not found in configuration');
      }

      this.expoConfig = {
        projectId,
        slug: slug || 'pilates-booking'
      };

      Logger.info('[EXPO_CONFIG] Loaded Expo configuration', {
        projectId: this.expoConfig.projectId,
        slug: this.expoConfig.slug
      });

      return this.expoConfig;
      
    } catch (error) {
      Logger.error('[EXPO_CONFIG] Failed to load Expo config', error);
      throw new Error('Expo configuration is required for push notifications');
    }
  }

  /**
   * Try to extract Firebase config from Android build
   */
  private getAndroidFirebaseConfig(): FirebaseConfig | null {
    try {
      // This would be populated by the google-services.json during build
      // Check if Firebase is available in the app
      const packageName = Constants.expoConfig?.android?.package ||
                         Constants.manifest?.android?.package;
                         
      if (!packageName) {
        Logger.warn('[FIREBASE_CONFIG] No Android package name found');
        return null;
      }

      Logger.info('[FIREBASE_CONFIG] Detected Android package', { packageName });

      // For production, this should come from google-services.json automatically
      // For now, return null to trigger fallback
      return null;
      
    } catch (error) {
      Logger.warn('[FIREBASE_CONFIG] Could not read Android Firebase config', error);
      return null;
    }
  }

  /**
   * Validate that all required configurations are available
   */
  public validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const firebaseConfig = this.getFirebaseConfig();
      if (!firebaseConfig.projectId) {
        errors.push('Firebase project ID is missing');
      }
      if (!firebaseConfig.appId) {
        errors.push('Firebase app ID is missing');
      }
    } catch (error) {
      errors.push(`Firebase config error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      const expoConfig = this.getExpoConfig();
      if (!expoConfig.projectId) {
        errors.push('Expo project ID is missing');
      }
    } catch (error) {
      errors.push(`Expo config error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get debug information for troubleshooting
   */
  public getDebugInfo(): any {
    return {
      platform: Platform.OS,
      expoConfig: Constants.expoConfig?.extra || 'not found',
      manifest: Constants.manifest?.extra || 'not found',
      easConfig: Constants.easConfig || 'not found',
      firebase: this.firebaseConfig,
      expo: this.expoConfig,
      validation: this.validateConfiguration()
    };
  }
}

export const firebaseConfigService = FirebaseConfigService.getInstance();
export { FirebaseConfigService };