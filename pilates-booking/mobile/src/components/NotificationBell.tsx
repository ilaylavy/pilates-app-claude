import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  RefreshControl,
  Dimensions,
  AppState,
  AppStateStatus,
  Vibration,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { COLORS, SPACING } from '../utils/config';
import { useNotifications } from '../hooks/useNotifications';
import { useTranslation } from '../hooks/useTranslation';
import { useNotificationTranslation } from '../utils/notificationTranslations';
import { migrationUtils } from '../utils/notificationMigration';
import { Logger } from '../services/LoggingService';
import { PRIORITY_CONFIG } from '../api/notifications';

interface NotificationBellProps {
  style?: any;
  pollInterval?: number;
  enableOfflineSync?: boolean;
  maxCachedNotifications?: number;
  enableHaptics?: boolean;
  onNotificationPress?: (notification: any) => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ 
  style,
  pollInterval = 30000,
  enableOfflineSync = true,
  maxCachedNotifications = 100,
  enableHaptics = true,
  onNotificationPress
}) => {
  const { t, formatDateRelative } = useTranslation();
  const { translateNotification } = useNotificationTranslation();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUnreadCount, setLastUnreadCount] = useState(0);
  const appState = useRef(AppState.currentState);
  
  // Use the advanced notifications hook
  const {
    notifications,
    groupedNotifications,
    unreadCount,
    isLoading,
    isRefreshing,
    error,
    syncStatus,
    hasMore,
    lastFetchTime,
    refresh,
    loadMore,
    markAsRead,
    bulkMarkAsRead,
    dismiss,
    handleNotificationAction,
    metrics
  } = useNotifications({
    enabled: true,
    pollingConfig: {
      baseInterval: pollInterval,
      enabled: true
    },
    pageSize: 50
  });

  // Handle app state changes for immediate updates
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - trigger immediate refresh
        refresh();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [refresh]);

  // Focus effect to refresh when screen becomes focused
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Handle unread count changes with haptic feedback
  useEffect(() => {
    if (enableHaptics && unreadCount > lastUnreadCount && lastUnreadCount > 0) {
      // New notification arrived - provide haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setLastUnreadCount(unreadCount);
  }, [unreadCount, lastUnreadCount, enableHaptics]);

  const handleBellPress = async () => {
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    setIsModalVisible(true);
    
    Logger.info('Notification bell pressed', {
      unreadCount,
      totalNotifications: notifications.length,
      syncStatus
    });
    
    Logger.trackEvent('notification.bell_pressed', {
      unreadCount,
      totalNotifications: notifications.length
    });
  };

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    setRefreshing(true);
    
    try {
      await refresh(true); // Reset pagination
      
      Logger.info('Notifications refreshed via pull-to-refresh');
      Logger.trackEvent('notification.pull_to_refresh');
    } catch (error) {
      Logger.error('Failed to refresh notifications', error as Error);
    } finally {
      setRefreshing(false);
    }
  };

  // Handle notification item press
  const handleNotificationPress = async (notification: any) => {
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    try {
      // Mark as read if not already read
      if (!notification.is_read) {
        await markAsRead(notification.id);
      }
      
      // Handle notification-specific action
      const action = handleNotificationAction(notification);
      
      if (onNotificationPress) {
        onNotificationPress(notification);
      }
      
      // Close modal after action
      setIsModalVisible(false);
      
    } catch (error) {
      Logger.error('Failed to handle notification press', error as Error, {
        notificationId: notification.id
      });
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    
    if (enableHaptics) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    try {
      const unreadIds = notifications
        .filter(n => !n.is_read)
        .map(n => n.id);
      
      if (unreadIds.length > 0) {
        await bulkMarkAsRead(unreadIds);
        
        Logger.info('All notifications marked as read', { count: unreadIds.length });
        Logger.trackEvent('notification.mark_all_read', { count: unreadIds.length });
      }
    } catch (error) {
      Logger.error('Failed to mark all notifications as read', error as Error);
      Alert.alert(
        t('errors.generic'),
        t('notifications.markAllReadError'),
        [{ text: t('common.ok'), style: 'default' }]
      );
    }
  };

  // Handle clear all notifications
  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    
    Alert.alert(
      t('notifications.clearAllTitle'),
      t('notifications.clearAllMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              for (const notification of notifications) {
                await dismiss(notification.id);
              }
              
              Logger.info('All notifications cleared', { count: notifications.length });
              Logger.trackEvent('notification.clear_all', { count: notifications.length });
              
            } catch (error) {
              Logger.error('Failed to clear all notifications', error as Error);
            }
          }
        }
      ]
    );
  };

  // Get priority-based styling
  const getPriorityStyle = (priority: string) => {
    // Convert to uppercase to match PRIORITY_CONFIG keys
    const normalizedPriority = priority?.toUpperCase() as keyof typeof PRIORITY_CONFIG;
    const config = PRIORITY_CONFIG[normalizedPriority];
    return {
      color: config?.color || COLORS.primary,
      icon: config?.icon || 'information-circle'
    };
  };

  // Smart refresh indicator
  const shouldShowRefreshIndicator = () => {
    if (!lastFetchTime) return true;
    return Date.now() - lastFetchTime.getTime() > 60000; // Show if data > 1min old
  };

  // Format timestamp using i18n
  const formatNotificationTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return formatDateRelative(date, false);
    } catch (error) {
      return t('common.unknown');
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (type: string, priority: string) => {
    // First check priority-based icons
    const priorityStyle = getPriorityStyle(priority);
    if (priorityStyle.icon && priorityStyle.icon !== 'none') {
      return priorityStyle.icon;
    }
    
    // Fall back to type-based icons
    switch (type) {
      case 'PACKAGE_ACTIVATED':
        return 'card';
      case 'BOOKING_SUCCESS':
        return 'checkmark-circle';
      case 'BOOKING_CANCELLED':
        return 'close-circle';
      case 'WAITLIST_PROMOTED':
        return 'arrow-up-circle';
      case 'CLASS_REMINDER':
        return 'time';
      case 'PAYMENT_PROCESSED':
        return 'card';
      case 'PAYMENT_FAILED':
        return 'alert-circle';
      case 'ADMIN_ANNOUNCEMENT':
      case 'URGENT_ANNOUNCEMENT':
        return 'megaphone';
      case 'GENERAL_ANNOUNCEMENT':
        return 'information-circle';
      case 'SYSTEM_MAINTENANCE':
        return 'construct';
      case 'ACCOUNT_VERIFIED':
        return 'shield-checkmark';
      case 'PASSWORD_RESET':
        return 'key';
      default:
        return 'notifications';
    }
  };

  // Render sync status indicator
  const renderSyncStatus = () => {
    const getStatusColor = () => {
      switch (syncStatus) {
        case 'synced': return COLORS.success;
        case 'syncing': return COLORS.warning;
        case 'offline': return COLORS.textSecondary;
        case 'error': return COLORS.error;
        default: return COLORS.textSecondary;
      }
    };

    const getStatusText = () => {
      switch (syncStatus) {
        case 'synced': return t('notifications.synced');
        case 'syncing': return t('notifications.syncing');
        case 'offline': return t('notifications.offline');
        case 'error': return t('notifications.error');
        default: return '';
      }
    };

    if (syncStatus === 'synced') return null;

    return (
      <View style={styles.syncStatus}>
        <View style={[styles.syncIndicator, { backgroundColor: getStatusColor() }]} />
        <Text style={[styles.syncStatusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-outline" size={64} color={COLORS.textSecondary} />
      <Text style={styles.emptyText}>{t('notifications.noNotifications')}</Text>
      <Text style={styles.emptySubtext}>
        {t('notifications.noNotificationsDescription')}
      </Text>
      {shouldShowRefreshIndicator() && (
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={20} color={COLORS.primary} />
          <Text style={styles.refreshButtonText}>{t('common.refresh')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Render notification item
  const renderNotificationItem = (notification: any) => {
    const priorityStyle = getPriorityStyle(notification.priority);
    const isUnread = !notification.is_read;
    
    return (
      <TouchableOpacity
        key={notification.id}
        style={[
          styles.notificationItem,
          isUnread && styles.unreadNotificationItem
        ]}
        onPress={() => handleNotificationPress(notification)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationIcon}>
          <Ionicons
            name={getNotificationIcon(notification.type, notification.priority) as any}
            size={20}
            color={priorityStyle.color}
          />
        </View>
        
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, isUnread && styles.unreadText]}>
              {translateNotification(notification.type, notification.title, notification.body, notification.data).title}
            </Text>
            {notification.priority === 'CRITICAL' && (
              <View style={styles.criticalBadge}>
                <Text style={styles.criticalBadgeText}>
                  {t('notifications.critical')}
                </Text>
              </View>
            )}
          </View>
          
          <Text style={styles.notificationMessage} numberOfLines={3}>
            {translateNotification(notification.type, notification.title, notification.body, notification.data).body}
          </Text>
          
          <View style={styles.notificationMeta}>
            <Text style={styles.notificationTime}>
              {formatNotificationTime(notification.created_at)}
            </Text>
            {notification.expires_at && (
              <Text style={styles.expirationText}>
                {t('notifications.expires')} {formatNotificationTime(notification.expires_at)}
              </Text>
            )}
          </View>
        </View>
        
        {isUnread && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  // Render grouped notifications
  const renderGroupedNotifications = () => {
    return Object.entries(groupedNotifications).map(([dateGroup, groupNotifications]) => (
      <View key={dateGroup}>
        <View style={styles.dateGroupHeader}>
          <Text style={styles.dateGroupText}>
            {t(`notifications.dateGroups.${dateGroup.toLowerCase().replace(' ', '')}`, dateGroup)}
          </Text>
        </View>
        {groupNotifications.map(renderNotificationItem)}
      </View>
    ));
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleBellPress}
        style={[styles.bellContainer, style]}
        activeOpacity={0.7}
        disabled={isLoading}
      >
        <Ionicons 
          name={isLoading ? "notifications-outline" : "notifications"} 
          size={24} 
          color={error ? COLORS.error : COLORS.text} 
        />
        {unreadCount > 0 && (
          <View style={[
            styles.badge, 
            unreadCount > 99 && styles.largeBadge,
            error && styles.errorBadge
          ]}>
            <Text style={styles.badgeText}>
              {unreadCount > 999 ? '999+' : unreadCount.toString()}
            </Text>
          </View>
        )}
        {syncStatus === 'syncing' && (
          <View style={styles.syncingIndicator}>
            <Ionicons name="sync" size={12} color={COLORS.warning} />
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>{t('notifications.title')}</Text>
              {renderSyncStatus()}
            </View>
            
            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={handleMarkAllAsRead}
                  style={styles.markReadButton}
                  disabled={isLoading}
                >
                  <Text style={styles.markReadButtonText}>
                    {t('notifications.markAllRead')}
                  </Text>
                </TouchableOpacity>
              )}
              
              {notifications.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearAll}
                  style={styles.clearButton}
                  disabled={isLoading}
                >
                  <Text style={styles.clearButtonText}>
                    {t('notifications.clearAll')}
                  </Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                onPress={() => setIsModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            style={styles.notificationsList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={COLORS.primary}
                colors={[COLORS.primary]}
                title={t('common.pullToRefresh')}
              />
            }
            onScroll={({ nativeEvent }) => {
              const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
              const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;
              
              // Load more when close to bottom
              if (isCloseToBottom && hasMore && !isRefreshing) {
                loadMore();
              }
            }}
            scrollEventThrottle={400}
          >
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color={COLORS.error} />
                <Text style={styles.errorText}>
                  {t('notifications.loadError')}
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => refresh()}
                >
                  <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {notifications.length === 0 && !isLoading && !error ? (
              renderEmptyState()
            ) : (
              renderGroupedNotifications()
            )}

            {hasMore && (
              <View style={styles.loadMoreContainer}>
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={loadMore}
                  disabled={isRefreshing}
                >
                  <Ionicons name="chevron-down" size={16} color={COLORS.primary} />
                  <Text style={styles.loadMoreText}>
                    {isRefreshing ? t('common.loading') : t('notifications.loadMore')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Performance metrics in development */}
            {__DEV__ && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugText}>
                  Poll: {metrics.avgPollLatency.toFixed(0)}ms | 
                  Cache: {(metrics.cacheHitRate * 100).toFixed(1)}% | 
                  Errors: {(metrics.errorRate * 100).toFixed(1)}%
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bellContainer: {
    position: 'relative',
    padding: SPACING.xs,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.error,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  largeBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
  },
  errorBadge: {
    backgroundColor: COLORS.error,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  syncingIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  syncIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  syncStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  markReadButton: {
    marginBottom: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  markReadButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    marginBottom: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  clearButtonText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: SPACING.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.errorBackground || `${COLORS.error}15`,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    borderRadius: 8,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginHorizontal: SPACING.sm,
    flex: 1,
  },
  retryButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.error,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  notificationsList: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: 8,
    marginTop: SPACING.md,
  },
  refreshButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  dateGroupHeader: {
    backgroundColor: `${COLORS.textSecondary}10`,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  dateGroupText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  unreadNotificationItem: {
    backgroundColor: `${COLORS.primary}05`,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  notificationIcon: {
    marginRight: SPACING.sm,
    marginTop: 4,
    width: 24,
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
  },
  unreadText: {
    fontWeight: '700',
  },
  criticalBadge: {
    backgroundColor: COLORS.error,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  criticalBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  notificationMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  expirationText: {
    fontSize: 11,
    color: COLORS.warning,
    fontStyle: 'italic',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginTop: 8,
    marginLeft: SPACING.xs,
  },
  loadMoreContainer: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: `${COLORS.primary}15`,
    borderRadius: 20,
  },
  loadMoreText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  debugContainer: {
    padding: SPACING.sm,
    backgroundColor: `${COLORS.textSecondary}10`,
    marginTop: SPACING.md,
  },
  debugText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});

export default NotificationBell;