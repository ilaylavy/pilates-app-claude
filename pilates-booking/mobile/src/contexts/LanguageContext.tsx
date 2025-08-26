import React, { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18nManager, { LocaleConfig, SUPPORTED_LOCALES } from '../i18n/config';
import { rtlManager } from '../utils/rtlManager';

interface LanguageContextType {
  // Current language info
  currentLanguage: string;
  currentLocale: LocaleConfig;
  isRTL: boolean;
  
  // Translation functions
  t: (key: string, options?: object) => string;
  pluralize: (count: number, key: string) => string;
  
  // Formatting functions
  formatDate: (date: Date) => string;
  formatTime: (date: Date) => string;
  formatDateTime: (date: Date) => string;
  formatCurrency: (amount: number) => string;
  formatNumber: (number: number, precision?: number) => string;
  
  // Language management
  changeLanguage: (languageCode: string) => Promise<void>;
  getSupportedLanguages: () => LocaleConfig[];
  isLanguageSupported: (languageCode: string) => boolean;
  
  // Loading state
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<string>('en');
  const [currentLocale, setCurrentLocale] = useState<LocaleConfig>(SUPPORTED_LOCALES.en);
  const [isRTL, setIsRTL] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [updateCount, setUpdateCount] = useState<number>(0);

  useEffect(() => {
    initializeLanguage();
  }, []);

  const initializeLanguage = async () => {
    try {
      setIsLoading(true);
      
      // Initialize the i18n manager (this will set up locale from storage or device)
      await new Promise(resolve => setTimeout(resolve, 100)); // Give i18n time to initialize
      
      const locale = i18nManager.getLocale();
      const languageCode = i18nManager.getCurrentLanguageCode();
      
      setCurrentLanguage(languageCode);
      setCurrentLocale(locale);
      setIsRTL(locale.isRTL);
      
      // Sync RTL manager with initial language
      rtlManager.setRTL(locale.isRTL);
      
    } catch (error) {
      console.error('Failed to initialize language:', error);
      // Fallback to English
      setCurrentLanguage('en');
      setCurrentLocale(SUPPORTED_LOCALES.en);
      setIsRTL(false);
      
      // Sync RTL manager with fallback language
      rtlManager.setRTL(false);
    } finally {
      setIsLoading(false);
    }
  };

  const changeLanguage = async (languageCode: string): Promise<void> => {
    if (!SUPPORTED_LOCALES[languageCode]) {
      throw new Error(`Language ${languageCode} is not supported`);
    }

    try {
      setIsLoading(true);
      
      const newLocale = SUPPORTED_LOCALES[languageCode];
      const wasRTL = isRTL;
      const willBeRTL = newLocale.isRTL;
      
      // Set the language in i18n manager
      await i18nManager.setLocale(languageCode);
      
      // Update state
      setCurrentLanguage(languageCode);
      setCurrentLocale(newLocale);
      setIsRTL(willBeRTL);
      
      // Handle RTL change - instant switching without restart
      if (wasRTL !== willBeRTL) {
        // Update RTL manager for instant switching
        rtlManager.setRTL(willBeRTL);
      }
      
      // Force re-render of all components using this context
      setUpdateCount(prev => prev + 1);
      
    } catch (error) {
      console.error('Failed to change language:', error);
      throw new Error('Failed to change language');
    } finally {
      setIsLoading(false);
    }
  };

  const t = (key: string, options?: object): string => {
    return i18nManager.translate(key, options);
  };

  const pluralize = (count: number, key: string): string => {
    return i18nManager.pluralize(count, key);
  };

  const formatDate = (date: Date): string => {
    return i18nManager.formatDate(date);
  };

  const formatTime = (date: Date): string => {
    return i18nManager.formatTime(date);
  };

  const formatDateTime = (date: Date): string => {
    return i18nManager.formatDateTime(date);
  };

  const formatCurrency = (amount: number): string => {
    return i18nManager.formatCurrency(amount);
  };

  const formatNumber = (number: number, precision?: number): string => {
    return i18nManager.formatNumber(number, precision);
  };

  const getSupportedLanguages = (): LocaleConfig[] => {
    return i18nManager.getSupportedLocales();
  };

  const isLanguageSupported = (languageCode: string): boolean => {
    return !!SUPPORTED_LOCALES[languageCode];
  };

  // Include updateCount in dependency to trigger re-renders
  const contextValue: LanguageContextType = useMemo(() => ({
    // Current language info
    currentLanguage,
    currentLocale,
    isRTL,
    
    // Translation functions
    t,
    pluralize,
    
    // Formatting functions
    formatDate,
    formatTime,
    formatDateTime,
    formatCurrency,
    formatNumber,
    
    // Language management
    changeLanguage,
    getSupportedLanguages,
    isLanguageSupported,
    
    // Loading state
    isLoading,
  }), [currentLanguage, currentLocale, isRTL, isLoading, updateCount]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;