import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager as RNI18nManager } from 'react-native';

// Import translation files
import en from './locales/en.json';
import he from './locales/he.json';

export interface LocaleConfig {
  code: string;
  name: string;
  isRTL: boolean;
  dateFormat: string;
  timeFormat: string;
  currencySymbol: string;
  currencyCode: string;
  numberFormat: {
    delimiter: string;
    separator: string;
    precision: number;
  };
}

export const SUPPORTED_LOCALES: Record<string, LocaleConfig> = {
  en: {
    code: 'en',
    name: 'English',
    isRTL: false,
    dateFormat: 'MM/DD/YYYY',
    timeFormat: 'h:mm A',
    currencySymbol: '$',
    currencyCode: 'USD',
    numberFormat: {
      delimiter: ',',
      separator: '.',
      precision: 2,
    },
  },
  he: {
    code: 'he',
    name: 'עברית',
    isRTL: true,
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    currencySymbol: '₪',
    currencyCode: 'ILS',
    numberFormat: {
      delimiter: ',',
      separator: '.',
      precision: 2,
    },
  },
};

const LANGUAGE_STORAGE_KEY = '@pilates_app_language';

class I18nManager {
  private i18n: I18n;
  private currentLocale: LocaleConfig;

  constructor() {
    this.i18n = new I18n({
      en,
      he,
    });

    // Set default locale
    this.currentLocale = SUPPORTED_LOCALES.en;
    
    // Configure i18n
    this.i18n.enableFallback = true;
    this.i18n.defaultLocale = 'en';
    
    this.initializeLocale();
  }

  private async initializeLocale() {
    try {
      // Try to get saved language first
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      
      if (savedLanguage && SUPPORTED_LOCALES[savedLanguage]) {
        await this.setLocale(savedLanguage);
        return;
      }

      // Detect device language
      const deviceLocales = Localization.getLocales();
      const deviceLanguage = deviceLocales[0]?.languageCode;

      if (deviceLanguage && SUPPORTED_LOCALES[deviceLanguage]) {
        await this.setLocale(deviceLanguage);
      } else {
        // Fallback to English
        await this.setLocale('en');
      }
    } catch (error) {
      console.warn('Failed to initialize locale:', error);
      await this.setLocale('en');
    }
  }

  async setLocale(localeCode: string): Promise<void> {
    if (!SUPPORTED_LOCALES[localeCode]) {
      throw new Error(`Unsupported locale: ${localeCode}`);
    }

    const locale = SUPPORTED_LOCALES[localeCode];
    
    // Update i18n locale
    this.i18n.locale = localeCode;
    this.currentLocale = locale;

    // Configure RTL - allow RTL support but don't force (to avoid restart requirement)
    RNI18nManager.allowRTL(true); // Always allow RTL
    // Note: We don't use forceRTL as it requires app restart
    // Instead, RTL state is managed through the context and components

    // Save to storage
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, localeCode);
    } catch (error) {
      console.warn('Failed to save language preference:', error);
    }
  }

  getLocale(): LocaleConfig {
    return this.currentLocale;
  }

  translate(key: string, options?: object): string {
    return this.i18n.t(key, options);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString(this.currentLocale.code, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  formatTime(date: Date): string {
    const timeOptions: Intl.DateTimeFormatOptions = this.currentLocale.code === 'he' 
      ? { hour: '2-digit', minute: '2-digit', hour12: false }
      : { hour: 'numeric', minute: '2-digit', hour12: true };

    return date.toLocaleTimeString(this.currentLocale.code, timeOptions);
  }

  formatDateTime(date: Date): string {
    return `${this.formatDate(date)} ${this.formatTime(date)}`;
  }

  formatCurrency(amount: number): string {
    const { currencySymbol, numberFormat } = this.currentLocale;
    const formatted = amount.toFixed(numberFormat.precision)
      .replace(/\d(?=(\d{3})+\.)/g, `$&${numberFormat.delimiter}`)
      .replace('.', numberFormat.separator);
    
    // For Hebrew, put currency symbol after the number
    if (this.currentLocale.isRTL) {
      return `${formatted} ${currencySymbol}`;
    }
    
    return `${currencySymbol}${formatted}`;
  }

  formatNumber(number: number, precision?: number): string {
    const { numberFormat } = this.currentLocale;
    const actualPrecision = precision ?? numberFormat.precision;
    
    return number.toFixed(actualPrecision)
      .replace(/\d(?=(\d{3})+\.)/g, `$&${numberFormat.delimiter}`)
      .replace('.', numberFormat.separator);
  }

  isRTL(): boolean {
    return this.currentLocale.isRTL;
  }

  getCurrentLanguageCode(): string {
    return this.currentLocale.code;
  }

  getSupportedLocales(): LocaleConfig[] {
    return Object.values(SUPPORTED_LOCALES);
  }

  // Pluralization support for Hebrew
  pluralize(count: number, key: string): string {
    const pluralKey = this.currentLocale.code === 'he' 
      ? this.getHebrewPluralKey(count, key)
      : this.getEnglishPluralKey(count, key);
    
    return this.translate(pluralKey, { count });
  }

  private getEnglishPluralKey(count: number, key: string): string {
    return count === 1 ? `${key}.one` : `${key}.other`;
  }

  private getHebrewPluralKey(count: number, key: string): string {
    // Hebrew pluralization rules
    if (count === 1) return `${key}.one`;
    if (count === 2) return `${key}.two`;
    return `${key}.many`;
  }
}

// Create singleton instance
export const i18nManager = new I18nManager();

// Export convenience functions
export const t = (key: string, options?: object) => i18nManager.translate(key, options);
export const formatDate = (date: Date) => i18nManager.formatDate(date);
export const formatTime = (date: Date) => i18nManager.formatTime(date);
export const formatDateTime = (date: Date) => i18nManager.formatDateTime(date);
export const formatCurrency = (amount: number) => i18nManager.formatCurrency(amount);
export const formatNumber = (number: number, precision?: number) => i18nManager.formatNumber(number, precision);
export const isRTL = () => i18nManager.isRTL();
export const getCurrentLanguage = () => i18nManager.getCurrentLanguageCode();
export const pluralize = (count: number, key: string) => i18nManager.pluralize(count, key);

export default i18nManager;