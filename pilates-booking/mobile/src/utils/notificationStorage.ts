import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Notification {
  id: string;
  type: 'package_activation' | 'booking_success' | 'booking_cancelled' | 'waitlist_joined' | 'general';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = 'dismissed_notifications';
const NOTIFICATIONS_KEY = 'user_notifications';

export class NotificationStorage {
  // Track dismissed message IDs
  static async getDismissedMessages(): Promise<Set<string>> {
    try {
      const dismissed = await AsyncStorage.getItem(STORAGE_KEY);
      return new Set(dismissed ? JSON.parse(dismissed) : []);
    } catch (error) {
      console.error('Error getting dismissed messages:', error);
      return new Set();
    }
  }

  static async dismissMessage(messageId: string): Promise<void> {
    try {
      const dismissed = await this.getDismissedMessages();
      dismissed.add(messageId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
    } catch (error) {
      console.error('Error dismissing message:', error);
    }
  }

  static async isMessageDismissed(messageId: string): Promise<boolean> {
    const dismissed = await this.getDismissedMessages();
    return dismissed.has(messageId);
  }

  // Store and manage notifications
  static async getNotifications(): Promise<Notification[]> {
    try {
      const notifications = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      return notifications ? JSON.parse(notifications) : [];
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  static async addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const newNotification: Notification = {
        ...notification,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        read: false,
      };
      
      notifications.unshift(newNotification); // Add to beginning
      
      // Keep only last 50 notifications
      if (notifications.length > 50) {
        notifications.splice(50);
      }
      
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  }

  static async markAsRead(notificationId: string): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const notification = notifications.find(n => n.id === notificationId);
      if (notification) {
        notification.read = true;
        await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  static async markAllAsRead(): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      notifications.forEach(n => n.read = true);
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  static async clearOldNotifications(daysToKeep: number = 30): Promise<void> {
    try {
      const notifications = await this.getNotifications();
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      const filtered = notifications.filter(n => n.timestamp > cutoffTime);
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error clearing old notifications:', error);
    }
  }
}

// Helper function to generate consistent message IDs
export const generateMessageId = (type: string, context?: string): string => {
  return `${type}_${context || 'default'}`;
};