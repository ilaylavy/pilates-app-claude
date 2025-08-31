import { apiClient } from './client';
import { Logger } from '../services/LoggingService';

// Types matching backend schemas
export interface NotificationResponse {
  id: number;
  type: string;
  title: string;
  body: string;
  data: any;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  created_at: string;
  expires_at?: string;
  source_type?: string;
  source_id?: number;
  extra_data?: any;
  is_broadcast: boolean;
  is_read: boolean;
  is_dismissed: boolean;
}

export interface NotificationPaginationResponse {
  notifications: NotificationResponse[];
  pagination: {
    total: number;
    skip: number;
    limit: number;
    has_more: boolean;
  };
  unread_count: number;
}

export interface NotificationUnreadCount {
  count: number;
}

export interface NotificationMarkRead {
  notification_ids: number[];
}

export interface NotificationRenderRequest {
  notification_type: string;
  language: 'en' | 'he';
  variables: Record<string, any>;
}

export interface NotificationRenderResponse {
  title: string;
  body: string;
}

export interface NotificationTypesResponse {
  notification_types: Array<{
    value: string;
    name: string;
  }>;
}

export interface NotificationPreferenceResponse {
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

export interface NotificationPreferenceUpdate {
  channel_email?: boolean;
  channel_push?: boolean;
  channel_in_app?: boolean;
  enabled?: boolean;
}

// Priority-based UI configuration
export const PRIORITY_CONFIG = {
  CRITICAL: { 
    color: '#FF4444', 
    icon: 'alert-circle', 
    vibrate: true, 
    sound: true,
    order: 0 
  },
  HIGH: { 
    color: '#FF8800', 
    icon: 'alert-triangle', 
    badge: true, 
    sound: false,
    order: 1 
  },
  NORMAL: { 
    color: '#4285F4', 
    icon: 'information-circle', 
    badge: true, 
    sound: false,
    order: 2 
  },
  LOW: { 
    color: '#888888', 
    icon: 'none', 
    badge: false, 
    sound: false,
    order: 3 
  }
} as const;

// Notification metrics tracking
class NotificationMetrics {
  private pollLatency: number[] = [];
  private renderTimes: number[] = [];
  private cacheHitRate = 0;
  private errorRate = 0;
  private totalRequests = 0;
  private totalErrors = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  logPollLatency(latency: number) {
    this.pollLatency.push(latency);
    if (this.pollLatency.length > 100) {
      this.pollLatency.shift();
    }
    
    Logger.trackEvent('notification.poll_latency', { latency });
  }

  logRenderTime(renderTime: number) {
    this.renderTimes.push(renderTime);
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift();
    }
    
    if (renderTime > 500) { // Log slow renders
      Logger.warn('Slow notification render', { renderTime });
    }
  }

  logApiError() {
    this.totalErrors++;
    this.totalRequests++;
    this.errorRate = this.totalErrors / this.totalRequests;
    
    Logger.trackEvent('notification.api_error', { 
      errorRate: this.errorRate,
      totalErrors: this.totalErrors 
    });
  }

  logApiSuccess() {
    this.totalRequests++;
    this.errorRate = this.totalErrors / this.totalRequests;
  }

  logCacheHit() {
    this.cacheHits++;
    this.cacheHitRate = this.cacheHits / (this.cacheHits + this.cacheMisses);
    
    Logger.trackEvent('notification.cache_hit', { 
      hitRate: this.cacheHitRate 
    });
  }

  logCacheMiss() {
    this.cacheMisses++;
    this.cacheHitRate = this.cacheHits / (this.cacheHits + this.cacheMisses);
  }

  getMetrics() {
    return {
      avgPollLatency: this.pollLatency.length ? 
        this.pollLatency.reduce((a, b) => a + b, 0) / this.pollLatency.length : 0,
      avgRenderTime: this.renderTimes.length ?
        this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length : 0,
      cacheHitRate: this.cacheHitRate,
      errorRate: this.errorRate,
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors
    };
  }
}

export const notificationMetrics = new NotificationMetrics();

// Action handlers for different notification types
export interface NotificationAction {
  type: 'booking_view' | 'payment_retry' | 'package_view' | 'class_view' | 'admin_action';
  data: any;
}

export const getNotificationAction = (notification: NotificationResponse): NotificationAction | null => {
  // Extract action from notification data
  if (notification.data?.action) {
    return notification.data.action;
  }

  // Infer action from notification type and source
  switch (notification.type) {
    case 'BOOKING_SUCCESS':
    case 'BOOKING_CANCELLED':
      return {
        type: 'booking_view',
        data: { booking_id: notification.source_id }
      };
    
    case 'PAYMENT_PROCESSED':
    case 'PAYMENT_FAILED':
      return {
        type: 'payment_retry',
        data: { 
          payment_id: notification.source_id,
          can_retry: notification.type === 'PAYMENT_FAILED'
        }
      };
    
    case 'PACKAGE_ACTIVATED':
      return {
        type: 'package_view',
        data: { package_id: notification.source_id }
      };
    
    case 'WAITLIST_PROMOTED':
    case 'CLASS_REMINDER':
      return {
        type: 'class_view',
        data: { class_id: notification.source_id }
      };
    
    case 'ADMIN_ANNOUNCEMENT':
    case 'URGENT_ANNOUNCEMENT':
    case 'GENERAL_ANNOUNCEMENT':
      return {
        type: 'admin_action',
        data: { announcement_id: notification.source_id }
      };
    
    default:
      return null;
  }
};

// Main API service
export const notificationsApi = {
  /**
   * Get paginated notifications for the current user
   */
  getNotifications: async (
    skip: number = 0,
    limit: number = 50,
    unread_only: boolean = false,
    types?: string[]
  ): Promise<NotificationPaginationResponse> => {
    const startTime = Date.now();
    
    try {
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
        unread_only: unread_only.toString(),
      });
      
      if (types && types.length > 0) {
        types.forEach(type => params.append('types', type));
      }
      
      const response = await apiClient.get<NotificationPaginationResponse>(
        `/api/v1/notifications?${params.toString()}`
      );
      
      const latency = Date.now() - startTime;
      notificationMetrics.logPollLatency(latency);
      notificationMetrics.logApiSuccess();
      
      Logger.info('Notifications fetched successfully', {
        count: response.data.notifications.length,
        unread_count: response.data.unread_count,
        latency,
        skip,
        limit
      });
      
      return response.data;
    } catch (error) {
      const latency = Date.now() - startTime;
      notificationMetrics.logPollLatency(latency);
      notificationMetrics.logApiError();
      
      Logger.error('Failed to fetch notifications', error as Error, {
        skip,
        limit,
        unread_only,
        types
      });
      
      throw error;
    }
  },

  /**
   * Get unread notification count
   */
  getUnreadCount: async (): Promise<NotificationUnreadCount> => {
    const startTime = Date.now();
    
    try {
      const response = await apiClient.get<NotificationUnreadCount>('/api/v1/notifications/unread-count');
      
      const latency = Date.now() - startTime;
      notificationMetrics.logPollLatency(latency);
      notificationMetrics.logApiSuccess();
      
      return response.data;
    } catch (error) {
      const latency = Date.now() - startTime;
      notificationMetrics.logPollLatency(latency);
      notificationMetrics.logApiError();
      
      Logger.error('Failed to fetch unread count', error as Error);
      throw error;
    }
  },

  /**
   * Mark a single notification as read
   */
  markAsRead: async (notificationId: number): Promise<void> => {
    try {
      await apiClient.post(`/api/v1/notifications/${notificationId}/mark-read`);
      
      Logger.info('Notification marked as read', { notificationId });
      Logger.trackEvent('notification.marked_read', { notificationId });
      
    } catch (error) {
      Logger.error('Failed to mark notification as read', error as Error, {
        notificationId
      });
      throw error;
    }
  },

  /**
   * Mark multiple notifications as read
   */
  bulkMarkAsRead: async (notificationIds: number[]): Promise<void> => {
    if (notificationIds.length === 0) return;
    
    try {
      const payload: NotificationMarkRead = { notification_ids: notificationIds };
      await apiClient.post('/api/v1/notifications/bulk-mark-read', payload);
      
      Logger.info('Bulk notifications marked as read', { 
        count: notificationIds.length,
        notificationIds 
      });
      Logger.trackEvent('notification.bulk_marked_read', { 
        count: notificationIds.length 
      });
      
    } catch (error) {
      Logger.error('Failed to bulk mark notifications as read', error as Error, {
        count: notificationIds.length,
        notificationIds
      });
      throw error;
    }
  },

  /**
   * Dismiss (soft delete) a notification
   */
  dismissNotification: async (notificationId: number): Promise<void> => {
    try {
      await apiClient.delete(`/api/v1/notifications/${notificationId}`);
      
      Logger.info('Notification dismissed', { notificationId });
      Logger.trackEvent('notification.dismissed', { notificationId });
      
    } catch (error) {
      Logger.error('Failed to dismiss notification', error as Error, {
        notificationId
      });
      throw error;
    }
  },

  /**
   * Render a notification template with variables
   */
  renderTemplate: async (request: NotificationRenderRequest): Promise<NotificationRenderResponse> => {
    try {
      const response = await apiClient.post<NotificationRenderResponse>(
        '/api/v1/notifications/render-template',
        request
      );
      
      return response.data;
    } catch (error) {
      Logger.error('Failed to render notification template', error as Error, {
        notification_type: request.notification_type,
        language: request.language
      });
      throw error;
    }
  },

  /**
   * Get available notification types
   */
  getNotificationTypes: async (): Promise<NotificationTypesResponse> => {
    try {
      const response = await apiClient.get<NotificationTypesResponse>('/api/v1/notifications/types');
      return response.data;
    } catch (error) {
      Logger.error('Failed to fetch notification types', error as Error);
      throw error;
    }
  },

  /**
   * Get notification preferences for current user
   */
  getPreferences: async (): Promise<NotificationPreferenceResponse[]> => {
    try {
      const response = await apiClient.get<NotificationPreferenceResponse[]>('/api/v1/notifications/preferences');
      return response.data;
    } catch (error) {
      Logger.error('Failed to fetch notification preferences', error as Error);
      throw error;
    }
  },

  /**
   * Update notification preferences
   */
  updatePreferences: async (
    notificationType: string,
    updates: NotificationPreferenceUpdate
  ): Promise<NotificationPreferenceResponse> => {
    try {
      const response = await apiClient.patch<NotificationPreferenceResponse>(
        `/api/v1/notifications/preferences/${notificationType}`,
        updates
      );
      
      Logger.info('Notification preferences updated', {
        notificationType,
        updates
      });
      Logger.trackEvent('notification.preferences_updated', {
        notificationType,
        updates
      });
      
      return response.data;
    } catch (error) {
      Logger.error('Failed to update notification preferences', error as Error, {
        notificationType,
        updates
      });
      throw error;
    }
  }
};

// Utility functions for sorting and filtering notifications
export const sortNotificationsByPriority = (notifications: NotificationResponse[]): NotificationResponse[] => {
  return [...notifications].sort((a, b) => {
    // First sort by priority (lower order = higher priority)
    // Convert to uppercase to match PRIORITY_CONFIG keys
    const aPriority = a.priority?.toUpperCase() as keyof typeof PRIORITY_CONFIG;
    const bPriority = b.priority?.toUpperCase() as keyof typeof PRIORITY_CONFIG;
    
    const aConfig = PRIORITY_CONFIG[aPriority];
    const bConfig = PRIORITY_CONFIG[bPriority];
    
    // Handle missing priority config gracefully
    if (!aConfig && !bConfig) return 0;
    if (!aConfig) return 1; // Put unknown priorities at the end
    if (!bConfig) return -1;
    
    const priorityDiff = aConfig.order - bConfig.order;
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then sort by created date (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

export const filterActiveNotifications = (notifications: NotificationResponse[]): NotificationResponse[] => {
  const now = new Date();
  return notifications.filter(notification => {
    // Filter out dismissed notifications
    if (notification.is_dismissed) return false;
    
    // Filter out expired notifications
    if (notification.expires_at) {
      const expiresAt = new Date(notification.expires_at);
      if (now > expiresAt) return false;
    }
    
    return true;
  });
};

export const groupNotificationsByDate = (notifications: NotificationResponse[]): Record<string, NotificationResponse[]> => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, NotificationResponse[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Earlier: []
  };

  notifications.forEach(notification => {
    const createdAt = new Date(notification.created_at);
    const createdDate = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());

    if (createdDate.getTime() === today.getTime()) {
      groups.Today.push(notification);
    } else if (createdDate.getTime() === yesterday.getTime()) {
      groups.Yesterday.push(notification);
    } else if (createdDate > weekAgo) {
      groups['This Week'].push(notification);
    } else {
      groups.Earlier.push(notification);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
};