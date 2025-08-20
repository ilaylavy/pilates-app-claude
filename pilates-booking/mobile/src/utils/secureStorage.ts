import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export class SecureStorage {
  private static instance: SecureStorage;
  
  public static getInstance(): SecureStorage {
    if (!SecureStorage.instance) {
      SecureStorage.instance = new SecureStorage();
    }
    return SecureStorage.instance;
  }

  async setItem(key: string, value: string, requireBiometric: boolean = false): Promise<void> {
    try {
      const options: SecureStore.SecureStoreOptions = {
        requireAuthentication: requireBiometric,
        authenticationPrompt: 'Authenticate to access your secure data',
      };

      // Use keychain on iOS and encrypted shared preferences on Android
      if (Platform.OS === 'ios') {
        options.keychainService = 'PilatesBookingKeychain';
      } else {
        options.encryptionCipher = SecureStore.ENCRYPTION_CIPHER.AES_GCM;
      }

      await SecureStore.setItemAsync(key, value, options);
    } catch (error) {
      console.error(`Failed to store item with key ${key}:`, error);
      throw error;
    }
  }

  async getItem(key: string, requireBiometric: boolean = false): Promise<string | null> {
    try {
      const options: SecureStore.SecureStoreOptions = {
        requireAuthentication: requireBiometric,
        authenticationPrompt: 'Authenticate to access your secure data',
      };

      if (Platform.OS === 'ios') {
        options.keychainService = 'PilatesBookingKeychain';
      }

      return await SecureStore.getItemAsync(key, options);
    } catch (error) {
      console.error(`Failed to retrieve item with key ${key}:`, error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`Failed to remove item with key ${key}:`, error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    // SecureStore doesn't have a clear all method, so we need to remove items individually
    // This should be called with known keys
    const keysToRemove = [
      'access_token',
      'refresh_token', 
      'user_data',
      'biometric_enabled',
      'auto_logout_time'
    ];

    try {
      await Promise.all(keysToRemove.map(key => this.removeItem(key)));
    } catch (error) {
      console.error('Failed to clear secure storage:', error);
      throw error;
    }
  }

  async isBiometricAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Failed to check biometric availability:', error);
      return false;
    }
  }

  async authenticateWithBiometric(): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate with biometrics',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
      });
      return result.success;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }

  async encryptData(data: string): Promise<string> {
    // For additional encryption, you could use expo-crypto
    // For now, SecureStore handles encryption
    return data;
  }

  async decryptData(encryptedData: string): Promise<string> {
    // For additional decryption, you could use expo-crypto
    // For now, SecureStore handles decryption
    return encryptedData;
  }
}

export const secureStorage = SecureStorage.getInstance();