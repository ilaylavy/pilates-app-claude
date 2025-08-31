import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQuery, useQueryClient, useMutation, UseQueryResult } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

import { 
  notificationsApi, 
  NotificationResponse, 
  NotificationPaginationResponse,
  NotificationUnreadCount,
  notificationMetrics,
  sortNotificationsByPriority,
  filterActiveNotifications,
  groupNotificationsByDate,
  getNotificationAction
} from '../api/notifications';
import { networkQueue } from '../services/NetworkQueueService';
import { Logger } from '../services/LoggingService';
import { useAuth } from './useAuth';

// Query keys for React Query
export const NOTIFICATION_QUERY_KEYS = {
  notifications: ['notifications'] as const,
  unreadCount: ['notifications', 'unreadCount'] as const,
  preferences: ['notifications', 'preferences'] as const,
  types: ['notifications', 'types'] as const,
} as const;

// Notification state interface
export interface NotificationState {
  notifications: NotificationResponse[];
  unreadCount: number;
  lastFetchTime: Date | null;
  isPolling: boolean;
  error: Error | null;
  hasMore: boolean;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  totalCount: number;
}

// Polling configuration
interface PollingConfig {
  enabled: boolean;
  baseInterval: number;
  maxInterval: number;
  backoffMultiplier: number;
  activeStateMultiplier: number;
}

const DEFAULT_POLLING_CONFIG: PollingConfig = {
  enabled: true,
  baseInterval: 30000, // 30 seconds
  maxInterval: 300000, // 5 minutes
  backoffMultiplier: 1.5,
  activeStateMultiplier: 0.33, // 10 seconds when active
};

// Adaptive polling strategy
class AdaptivePoller {
  private config: PollingConfig;
  private currentInterval: number;
  private errorCount: number = 0;
  private isUserInteracting: boolean = false;
  private appState: AppStateStatus = 'active';
  private isOnline: boolean = true;

  constructor(config: PollingConfig = DEFAULT_POLLING_CONFIG) {
    this.config = config;
    this.currentInterval = config.baseInterval;
    
    this.setupAppStateListener();
    this.setupNetworkListener();
    this.setupUserInteractionDetection();
  }

  private setupAppStateListener() {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const wasBackground = this.appState === 'background';
      this.appState = nextAppState;
      
      if (wasBackground && nextAppState === 'active') {
        // App came to foreground - reset interval and trigger immediate fetch
        this.resetInterval();
        Logger.info('App foregrounded - resetting poll interval');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }

  private setupNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (wasOffline && this.isOnline) {
        // Network restored - reset error count and interval
        this.errorCount = 0;
        this.resetInterval();
        Logger.info('Network restored - resetting poll interval');
      }
    });
  }

  private setupUserInteractionDetection() {
    // Simple user interaction detection
    let interactionTimeout: NodeJS.Timeout;
    
    const handleInteraction = () => {
      this.isUserInteracting = true;
      clearTimeout(interactionTimeout);
      interactionTimeout = setTimeout(() => {
        this.isUserInteracting = false;
      }, 30000); // Consider user inactive after 30s
    };

    // This would typically be attached to global touch events
    // For now, we'll rely on app state changes
  }

  getPollingInterval(): number {
    if (!this.config.enabled || !this.isOnline) return 0;
    
    // Don't poll in background
    if (this.appState === 'background') return 0;
    
    let interval = this.currentInterval;
    
    // Reduce interval when app is active and user is interacting
    if (this.appState === 'active' && this.isUserInteracting) {
      interval *= this.config.activeStateMultiplier;
    }
    
    // Apply exponential backoff for errors
    if (this.errorCount > 0) {
      interval *= Math.pow(this.config.backoffMultiplier, this.errorCount);
      interval = Math.min(interval, this.config.maxInterval);
    }
    
    return Math.max(interval, 5000); // Minimum 5 seconds
  }

  onSuccess() {
    this.errorCount = 0;
    this.currentInterval = this.config.baseInterval;
  }

  onError() {
    this.errorCount++;
    Logger.warn('Notification poll error', { errorCount: this.errorCount });
  }

  resetInterval() {
    this.errorCount = 0;
    this.currentInterval = this.config.baseInterval;
  }

  setUserInteracting(interacting: boolean) {
    this.isUserInteracting = interacting;
  }
}

// Main notification hook
export const useNotifications = (options: {
  enabled?: boolean;
  pollingConfig?: Partial<PollingConfig>;
  pageSize?: number;
  initialSkip?: number;
} = {}) => {
  const { 
    enabled = true, 
    pollingConfig = {},
    pageSize = 50,
    initialSkip = 0
  } = options;
  
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  
  // Polling setup
  const pollerRef = useRef(new AdaptivePoller({ ...DEFAULT_POLLING_CONFIG, ...pollingConfig }));
  const [currentSkip, setCurrentSkip] = useState(initialSkip);
  
  // Get current polling interval
  const getPollingInterval = useCallback(() => {
    return pollerRef.current.getPollingInterval();
  }, []);

  // Fetch notifications query
  const notificationsQuery = useQuery({
    queryKey: [...NOTIFICATION_QUERY_KEYS.notifications, currentSkip, pageSize],
    queryFn: async (): Promise<NotificationPaginationResponse> => {
      const startTime = Date.now();
      
      try {
        const result = await notificationsApi.getNotifications(currentSkip, pageSize);
        
        pollerRef.current.onSuccess();
        
        // Log render time
        const renderTime = Date.now() - startTime;
        notificationMetrics.logRenderTime(renderTime);
        
        return result;
      } catch (error) {
        pollerRef.current.onError();
        throw error;
      }
    },
    enabled: enabled && isAuthenticated,
    refetchInterval: getPollingInterval,
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.response?.status === 401) return false;
      
      // Retry up to 3 times with exponential backoff
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 30000)
  });

  // Unread count query
  const unreadCountQuery = useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount,
    queryFn: () => notificationsApi.getUnreadCount(),
    enabled: enabled && isAuthenticated,
    refetchInterval: getPollingInterval,
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 15000, // 15 seconds - more frequent updates
    gcTime: 60000, // 1 minute
    retry: 3
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (notificationId: number) => notificationsApi.markAsRead(notificationId),
    onMutate: async (notificationId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
      
      const previousData = queryClient.getQueriesData({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
      
      // Update all notification queries
      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.notifications },
        (old: NotificationPaginationResponse | undefined) => {
          if (!old || !old.notifications) return old;
          
          return {
            ...old,
            notifications: old.notifications.map(notification =>
              notification.id === notificationId
                ? { ...notification, is_read: true }
                : notification
            ),
            unread_count: Math.max(0, old.unread_count - 1)
          };
        }
      );
      
      // Update unread count
      queryClient.setQueryData(
        NOTIFICATION_QUERY_KEYS.unreadCount,
        (old: NotificationUnreadCount | undefined) => ({
          count: Math.max(0, (old?.count ?? 1) - 1)
        })
      );
      
      return { previousData };
    },
    onError: (error, notificationId, context) => {
      // Revert optimistic update
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      
      Logger.error('Failed to mark notification as read', error as Error, { notificationId });
    },
    onSuccess: (_, notificationId) => {
      Logger.info('Notification marked as read', { notificationId });
      
      // Invalidate queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
    }
  });

  // Bulk mark as read mutation
  const bulkMarkAsReadMutation = useMutation({
    mutationFn: (notificationIds: number[]) => notificationsApi.bulkMarkAsRead(notificationIds),
    onMutate: async (notificationIds) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
      
      const previousData = queryClient.getQueriesData({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
      
      // Update all notification queries
      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.notifications },
        (old: NotificationPaginationResponse | undefined) => {
          if (!old || !old.notifications) return old;
          
          const updatedNotifications = old.notifications.map(notification =>
            notificationIds.includes(notification.id)
              ? { ...notification, is_read: true }
              : notification
          );
          
          const markedCount = notificationIds.filter(id => 
            old.notifications?.some(n => n.id === id && !n.is_read)
          ).length;
          
          return {
            ...old,
            notifications: updatedNotifications,
            unread_count: Math.max(0, old.unread_count - markedCount)
          };
        }
      );
      
      return { previousData };
    },
    onError: (error, notificationIds, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      
      Logger.error('Failed to bulk mark notifications as read', error as Error, { 
        count: notificationIds.length 
      });
    },
    onSuccess: (_, notificationIds) => {
      Logger.info('Bulk notifications marked as read', { count: notificationIds.length });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
    }
  });

  // Dismiss notification mutation
  const dismissMutation = useMutation({
    mutationFn: (notificationId: number) => notificationsApi.dismissNotification(notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
      
      const previousData = queryClient.getQueriesData({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
      
      // Remove notification from all queries
      queryClient.setQueriesData(
        { queryKey: NOTIFICATION_QUERY_KEYS.notifications },
        (old: NotificationPaginationResponse | undefined) => {
          if (!old || !old.notifications) return old;
          
          const notification = old.notifications.find(n => n.id === notificationId);
          const wasUnread = notification && !notification.is_read;
          
          return {
            ...old,
            notifications: old.notifications.filter(n => n.id !== notificationId),
            unread_count: wasUnread ? Math.max(0, old.unread_count - 1) : old.unread_count,
            pagination: {
              ...old.pagination,
              total: Math.max(0, old.pagination.total - 1)
            }
          };
        }
      );
      
      return { previousData };
    },
    onError: (error, notificationId, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      
      Logger.error('Failed to dismiss notification', error as Error, { notificationId });
    },
    onSuccess: (_, notificationId) => {
      Logger.info('Notification dismissed', { notificationId });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.notifications });
    }
  });

  // Refresh function
  const refresh = useCallback(async (resetSkip = false) => {
    if (resetSkip) {
      setCurrentSkip(0);
    }
    
    pollerRef.current.resetInterval();
    
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.notifications }),
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEYS.unreadCount })
    ]);
  }, [queryClient]);

  // Load more function for pagination
  const loadMore = useCallback(async () => {
    const data = notificationsQuery.data as NotificationPaginationResponse | undefined;
    if (!data?.pagination.has_more || notificationsQuery.isFetching) {
      return;
    }
    
    const nextSkip = currentSkip + pageSize;
    setCurrentSkip(nextSkip);
  }, [currentSkip, pageSize, notificationsQuery.data, notificationsQuery.isFetching]);

  // Processed notifications with sorting and filtering
  const processedNotifications = useCallback(() => {
    const data = notificationsQuery.data as NotificationPaginationResponse | undefined;
    if (!data?.notifications) return [];
    
    const active = filterActiveNotifications(data.notifications);
    return sortNotificationsByPriority(active);
  }, [notificationsQuery.data]);

  // Grouped notifications by date
  const groupedNotifications = useCallback(() => {
    const notifications = processedNotifications();
    return groupNotificationsByDate(notifications);
  }, [processedNotifications]);

  // Handle notification action
  const handleNotificationAction = useCallback((notification: NotificationResponse) => {
    const action = getNotificationAction(notification);
    
    if (action) {
      Logger.info('Notification action triggered', {
        notificationId: notification.id,
        actionType: action.type,
        actionData: action.data
      });
      
      Logger.trackEvent('notification.action_triggered', {
        notificationId: notification.id,
        notificationType: notification.type,
        actionType: action.type
      });
      
      // Mark as read when action is taken
      markAsReadMutation.mutate(notification.id);
      
      return action;
    }
    
    return null;
  }, [markAsReadMutation]);

  // Queue notification actions for offline handling
  const queueNotificationAction = useCallback(async (
    action: 'mark_read' | 'dismiss' | 'bulk_mark_read',
    data: any
  ) => {
    const actionMap = {
      mark_read: (notificationId: number) => notificationsApi.markAsRead(notificationId),
      dismiss: (notificationId: number) => notificationsApi.dismissNotification(notificationId),
      bulk_mark_read: (notificationIds: number[]) => notificationsApi.bulkMarkAsRead(notificationIds)
    };
    
    const requestId = await networkQueue.enqueue(
      `/api/v1/notifications/${action}`,
      'POST',
      data,
      {
        priority: 'low', // Notification actions are not critical
        maxRetries: 3,
        conflictKey: `notification_${action}_${JSON.stringify(data)}`
      }
    );
    
    Logger.info('Notification action queued for offline processing', {
      action,
      data,
      requestId
    });
    
    return requestId;
  }, []);

  // Compute current state
  const state: NotificationState = {
    notifications: processedNotifications(),
    unreadCount: (unreadCountQuery.data as NotificationUnreadCount | undefined)?.count ?? 0,
    lastFetchTime: notificationsQuery.dataUpdatedAt ? new Date(notificationsQuery.dataUpdatedAt) : null,
    isPolling: getPollingInterval() > 0,
    error: notificationsQuery.error as Error | null,
    hasMore: (notificationsQuery.data as NotificationPaginationResponse | undefined)?.pagination.has_more ?? false,
    syncStatus: notificationsQuery.isLoading ? 'syncing' : 
                notificationsQuery.error ? 'error' :
                getPollingInterval() === 0 ? 'offline' : 'synced',
    totalCount: (notificationsQuery.data as NotificationPaginationResponse | undefined)?.pagination.total ?? 0
  };

  // Effect to trigger immediate fetch on certain events
  useEffect(() => {
    const handleAppForeground = () => {
      pollerRef.current.setUserInteracting(true);
      refresh();
    };

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        handleAppForeground();
      } else {
        pollerRef.current.setUserInteracting(false);
      }
    });

    return () => subscription?.remove();
  }, [refresh]);

  // Effect to log successful notification fetches
  useEffect(() => {
    if (notificationsQuery.data && notificationsQuery.isSuccess) {
      const data = notificationsQuery.data as NotificationPaginationResponse;
      Logger.info('Notifications fetched successfully', {
        count: data.notifications.length,
        unreadCount: data.unread_count,
        hasMore: data.pagination.has_more
      });
    }
  }, [notificationsQuery.data, notificationsQuery.isSuccess]);

  // Effect to log notification fetch errors
  useEffect(() => {
    if (notificationsQuery.error) {
      Logger.error('Failed to fetch notifications', notificationsQuery.error as Error);
    }
  }, [notificationsQuery.error]);

  // Effect to log unread count errors
  useEffect(() => {
    if (unreadCountQuery.error) {
      Logger.error('Failed to fetch unread count', unreadCountQuery.error as Error);
    }
  }, [unreadCountQuery.error]);

  return {
    // State
    ...state,
    
    // Processed data
    groupedNotifications: groupedNotifications(),
    
    // Query objects for direct access
    notificationsQuery,
    unreadCountQuery,
    
    // Actions
    markAsRead: markAsReadMutation.mutate,
    bulkMarkAsRead: bulkMarkAsReadMutation.mutate,
    dismiss: dismissMutation.mutate,
    refresh,
    loadMore,
    handleNotificationAction,
    queueNotificationAction,
    
    // Loading states
    isLoading: notificationsQuery.isLoading,
    isRefreshing: notificationsQuery.isFetching,
    isLoadingMore: notificationsQuery.isFetching && currentSkip > 0,
    
    // Mutation states
    isMarkingAsRead: markAsReadMutation.isPending,
    isDismissing: dismissMutation.isPending,
    isBulkMarkingAsRead: bulkMarkAsReadMutation.isPending,
    
    // Configuration
    currentSkip,
    pageSize,
    pollingInterval: getPollingInterval(),
    
    // Metrics
    metrics: notificationMetrics.getMetrics()
  };
};

// Specialized hook for just unread count (lighter weight)
export const useUnreadCount = (enabled: boolean = true) => {
  const { isAuthenticated } = useAuth();
  
  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount,
    queryFn: () => notificationsApi.getUnreadCount(),
    enabled: enabled && isAuthenticated,
    refetchInterval: 30000, // 30 seconds
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 15000,
    gcTime: 60000,
    retry: 3,
  });
};