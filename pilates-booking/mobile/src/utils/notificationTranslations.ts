/**
 * Notification translation utilities
 * Maps backend notification types and content to localized text
 */

import { useTranslation } from '../hooks/useTranslation';

// Type mapping from backend to frontend
const NOTIFICATION_TYPE_MAP: Record<string, string> = {
  'booking_success': 'bookingSuccess',
  'booking_cancelled': 'bookingCancelled', 
  'waitlist_promoted': 'waitlistPromoted',
  'class_reminder': 'classReminder',
  'payment_processed': 'paymentProcessed',
  'payment_failed': 'paymentFailed',
  'package_activated': 'packageActivated',
  'package_expires': 'packageExpires',
  'admin_announcement': 'adminAnnouncement',
  'general_announcement': 'generalAnnouncement',
  'urgent_announcement': 'urgentAnnouncement',
  'system_maintenance': 'systemMaintenance',
  'account_verified': 'accountVerified',
};

// Default translations for common notification patterns
const TITLE_TRANSLATIONS: Record<string, string> = {
  'booking_success': 'notifications.messages.bookingConfirmed',
  'booking_cancelled': 'notifications.messages.bookingCancelled',
  'waitlist_promoted': 'notifications.messages.waitlistPromoted', 
  'class_reminder': 'notifications.messages.classReminder',
  'payment_processed': 'notifications.messages.paymentSuccess',
  'payment_failed': 'notifications.messages.paymentFailed',
  'package_activated': 'notifications.messages.packageActivated',
  'package_expires': 'notifications.messages.packageExpiring',
  'admin_announcement': 'notifications.messages.adminAnnouncement',
  'general_announcement': 'notifications.messages.generalAnnouncement',
  'urgent_announcement': 'notifications.messages.urgentAnnouncement', 
  'system_maintenance': 'notifications.messages.systemMaintenance',
  'account_verified': 'notifications.messages.accountVerified',
};

export interface TranslatedNotification {
  title: string;
  body: string;
  originalTitle: string;
  originalBody: string;
}

/**
 * Hook to translate notification content based on type and content
 */
export const useNotificationTranslation = () => {
  const { t } = useTranslation();

  const translateNotification = (
    type: string,
    title: string,
    body: string,
    data?: any
  ): TranslatedNotification => {
    
    // Normalize the type (convert to lowercase and handle variations)
    const normalizedType = type.toLowerCase().replace(/[-_]/g, '_');
    
    // Try to get a specific translation key for this notification type
    const titleKey = TITLE_TRANSLATIONS[normalizedType];
    const typeKey = NOTIFICATION_TYPE_MAP[normalizedType];

    let translatedTitle = title;
    let translatedBody = body;

    // Translate title if we have a translation key
    if (titleKey && t(titleKey) !== titleKey) {
      translatedTitle = t(titleKey, data || {});
    } else {
      // Fallback: try common title patterns
      if (title.toLowerCase().includes('booking confirmed') || title.toLowerCase().includes('booking successful')) {
        translatedTitle = t('notifications.messages.bookingConfirmed', data || {});
      } else if (title.toLowerCase().includes('booking cancel')) {
        translatedTitle = t('notifications.messages.bookingCancelled', data || {});
      } else if (title.toLowerCase().includes('payment success') || title.toLowerCase().includes('payment processed')) {
        translatedTitle = t('notifications.messages.paymentSuccess', data || {});
      } else if (title.toLowerCase().includes('payment fail')) {
        translatedTitle = t('notifications.messages.paymentFailed', data || {});
      }
    }

    // Translate body based on common patterns
    if (body.toLowerCase().includes('booking') && body.toLowerCase().includes('confirmed')) {
      const className = data?.class_name || 'your class';
      translatedBody = t('notifications.messages.bookingConfirmedBody', { className });
    } else if (body.toLowerCase().includes('booking') && body.toLowerCase().includes('cancelled')) {
      const className = data?.class_name || 'your class';
      translatedBody = t('notifications.messages.bookingCancelledBody', { className });
    } else if (body.toLowerCase().includes('payment') && body.toLowerCase().includes('processed')) {
      translatedBody = t('notifications.messages.paymentSuccessBody', data || {});
    } else if (body.toLowerCase().includes('payment') && body.toLowerCase().includes('failed')) {
      translatedBody = t('notifications.messages.paymentFailedBody', data || {});
    }

    return {
      title: translatedTitle,
      body: translatedBody,
      originalTitle: title,
      originalBody: body
    };
  };

  return {
    translateNotification,
    getNotificationType: (backendType: string) => NOTIFICATION_TYPE_MAP[backendType.toLowerCase()] || backendType
  };
};

/**
 * Simple translation function for notification types
 */
export const translateNotificationType = (type: string, t: (key: string) => string): string => {
  const normalizedType = NOTIFICATION_TYPE_MAP[type.toLowerCase()] || type;
  const key = `notifications.types.${normalizedType}`;
  const translated = t(key);
  return translated !== key ? translated : type;
};