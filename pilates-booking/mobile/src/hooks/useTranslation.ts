import { useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { rtlManager } from '../utils/rtlManager';
import { StyleUtils } from '../utils/styleUtils';

/**
 * Advanced translation hook with RTL support and formatting utilities
 */
export const useTranslation = () => {
  const {
    currentLanguage,
    currentLocale,
    isRTL,
    t,
    pluralize,
    formatDate,
    formatTime,
    formatDateTime,
    formatCurrency,
    formatNumber,
    changeLanguage,
    getSupportedLanguages,
    isLanguageSupported,
    isLoading,
  } = useLanguage();

  // Memoized RTL utilities
  const rtlUtils = useMemo(() => ({
    isRTL,
    textAlign: isRTL ? 'left' : 'right',
    flexDirection: isRTL ? 'row-reverse' : 'row',
    alignSelf: isRTL ? 'flex-end' : 'flex-start',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  }), [isRTL]);

  // Enhanced translation function with nested key support
  const translate = useCallback((key: string, options?: object): string => {
    try {
      return t(key, options);
    } catch (error) {
      console.warn(`Translation missing for key: ${key}`);
      return key; // Return key as fallback
    }
  }, [t]);

  // Translation with fallback
  const translateWithFallback = useCallback((key: string, fallback: string, options?: object): string => {
    try {
      const translation = t(key, options);
      return translation === key ? fallback : translation;
    } catch (error) {
      console.warn(`Translation missing for key: ${key}, using fallback: ${fallback}`);
      return fallback;
    }
  }, [t]);

  // Pluralization with smart counting
  const pluralizeCount = useCallback((count: number, key: string, options?: object): string => {
    try {
      return pluralize(count, key);
    } catch (error) {
      console.warn(`Pluralization failed for key: ${key}`);
      return `${count} ${translate(key + (count === 1 ? '.one' : '.other'), options) || key}`;
    }
  }, [pluralize, translate]);

  // Date formatting with relative time support
  const formatDateRelative = useCallback((date: Date, includeTime: boolean = false): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return includeTime 
        ? translate('common.today') + ' ' + formatTime(date)
        : translate('common.today');
    } else if (days === 1) {
      return includeTime
        ? translate('common.yesterday') + ' ' + formatTime(date)
        : translate('common.yesterday');
    } else if (days === -1) {
      return includeTime
        ? translate('common.tomorrow') + ' ' + formatTime(date)
        : translate('common.tomorrow');
    } else if (days < 7 && days > 0) {
      return pluralizeCount(days, 'time.daysAgo');
    } else if (days < 0 && days > -7) {
      return pluralizeCount(Math.abs(days), 'time.inDays');
    }
    
    return includeTime ? formatDateTime(date) : formatDate(date);
  }, [translate, formatDate, formatTime, formatDateTime]);

  // Price formatting with currency awareness
  const formatPrice = useCallback((amount: number, showCurrency: boolean = true): string => {
    if (showCurrency) {
      return formatCurrency(amount);
    }
    return formatNumber(amount, currentLocale.numberFormat.precision);
  }, [formatCurrency, formatNumber, currentLocale]);

  // Duration formatting (minutes to human readable)
  const formatDuration = useCallback((minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours === 0) {
      return pluralizeCount(remainingMinutes, 'time.minutes');
    } else if (remainingMinutes === 0) {
      return pluralizeCount(hours, 'time.hours');
    } else {
      return `${pluralizeCount(hours, 'time.hours')} ${pluralizeCount(remainingMinutes, 'time.minutes')}`;
    }
  }, [pluralizeCount]);

  // Credits formatting with proper pluralization
  const formatCredits = useCallback((count: number, includeCount: boolean = true): string => {
    const creditText = pluralizeCount(count, 'packages.credits');
    return includeCount ? creditText : creditText.replace(/\d+\s*/, '');
  }, [pluralizeCount]);

  // Time range formatting
  const formatTimeRange = useCallback((startDate: Date, endDate: Date): string => {
    const startTime = formatTime(startDate);
    const endTime = formatTime(endDate);
    
    // Use appropriate separator for the locale
    const separator = isRTL ? ' - ' : ' - ';
    return `${startTime}${separator}${endTime}`;
  }, [formatTime, isRTL]);

  // Smart text truncation that respects RTL
  const truncateText = useCallback((text: string, maxLength: number, suffix: string = '...'): string => {
    if (text.length <= maxLength) {
      return text;
    }
    
    // For RTL, we might want to truncate from the start
    if (isRTL) {
      return suffix + text.slice(text.length - maxLength + suffix.length);
    } else {
      return text.slice(0, maxLength - suffix.length) + suffix;
    }
  }, [isRTL]);

  // Style helpers with RTL awareness
  const getTextStyle = useCallback((align?: 'left' | 'right' | 'center' | 'auto') => {
    return StyleUtils.textAlign(align);
  }, []);

  const getLayoutStyle = useCallback((direction: 'row' | 'column' = 'row') => {
    return StyleUtils.flexDirection(direction);
  }, []);

  const getSpacingStyle = useCallback((start: number, end?: number) => {
    return StyleUtils.marginHorizontal(start, end);
  }, []);

  // Enhanced RTL helpers for consistent usage
  const rtlText = useCallback((align?: 'left' | 'right' | 'center' | 'auto') => {
    return StyleUtils.textAlign(align || 'auto');
  }, []);

  const rtlRow = useCallback(() => {
    return StyleUtils.flexDirection('row');
  }, []);

  const rtlStyle = useCallback((style: any) => {
    return StyleUtils.flipStyle(style);
  }, []);

  const rtlAlign = useCallback((align: 'start' | 'end' | 'center' = 'start') => {
    if (align === 'center') return { alignItems: 'center' as const };
    const rtlAlign = align === 'start' 
      ? (isRTL ? 'flex-end' : 'flex-start')
      : (isRTL ? 'flex-start' : 'flex-end');
    return { alignItems: rtlAlign as const };
  }, [isRTL]);

  const rtlJustify = useCallback((justify: 'start' | 'end' | 'center' | 'between' = 'start') => {
    switch (justify) {
      case 'center': return { justifyContent: 'center' as const };
      case 'between': return { justifyContent: 'space-between' as const };
      case 'start': 
        return { justifyContent: (isRTL ? 'flex-end' : 'flex-start') as const };
      case 'end':
        return { justifyContent: (isRTL ? 'flex-start' : 'flex-end') as const };
    }
  }, [isRTL]);

  // Common translation shortcuts
  const common = useMemo(() => ({
    ok: translate('common.ok'),
    cancel: translate('common.cancel'),
    save: translate('common.save'),
    delete: translate('common.delete'),
    edit: translate('common.edit'),
    add: translate('common.add'),
    back: translate('common.back'),
    loading: translate('common.loading'),
    error: translate('common.error'),
    success: translate('common.success'),
  }), [translate]);

  // Error handling for translations
  const getErrorMessage = useCallback((errorKey: string, fallback?: string): string => {
    const errorMessage = translateWithFallback(`errors.${errorKey}`, fallback || translate('errors.generic'));
    return errorMessage;
  }, [translateWithFallback, translate]);

  // Language switching with loading state
  const switchLanguage = useCallback(async (languageCode: string) => {
    try {
      await changeLanguage(languageCode);
    } catch (error) {
      console.error('Failed to switch language:', error);
      throw error;
    }
  }, [changeLanguage]);

  return {
    // Core translation
    t: translate,
    translate,
    translateWithFallback,
    pluralize: pluralizeCount,
    
    // Language info
    currentLanguage,
    currentLocale,
    isRTL,
    isLoading,
    rtl: rtlUtils,
    
    // Formatting
    formatDate,
    formatTime,
    formatDateTime,
    formatDateRelative,
    formatCurrency,
    formatNumber,
    formatPrice,
    formatDuration,
    formatCredits,
    formatTimeRange,
    
    // Text utilities
    truncateText,
    
    // Style utilities
    getTextStyle,
    getLayoutStyle,
    getSpacingStyle,
    
    // Enhanced RTL helpers
    rtlText,
    rtlRow,
    rtlStyle,
    rtlAlign,
    rtlJustify,
    
    // Common translations
    common,
    
    // Error handling
    getErrorMessage,
    
    // Language management
    switchLanguage,
    getSupportedLanguages,
    isLanguageSupported,
  };
};

export default useTranslation;