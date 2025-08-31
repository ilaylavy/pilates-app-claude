import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationStorage, Notification as LocalNotification } from './notificationStorage';
import { Logger } from '../services/LoggingService';

// Migration configuration
interface MigrationConfig {
  version: string;
  migratedKey: string;
  backupKey: string;
  preserveLocal: boolean;
}

const MIGRATION_CONFIG: MigrationConfig = {
  version: '2.0.0',
  migratedKey: 'notifications_migrated_v2',
  backupKey: 'notifications_backup_v1',
  preserveLocal: true
};

// Enhanced notification type for migration
export interface MigratedNotification extends LocalNotification {
  source: 'local_migration' | 'backend';
  synced: boolean;
  migrationVersion: string;
  originalId?: string;
}

// Migration statistics
export interface MigrationStats {
  totalFound: number;
  migrated: number;
  skipped: number;
  errors: number;
  preservedLocal: number;
  startTime: string;
  endTime: string;
  duration: number;
}

// Migration service class
export class NotificationMigrationService {
  private config: MigrationConfig;
  
  constructor(config: MigrationConfig = MIGRATION_CONFIG) {
    this.config = config;
  }

  /**
   * Check if migration has already been completed
   */
  async isMigrationCompleted(): Promise<boolean> {
    try {
      const migrationFlag = await AsyncStorage.getItem(this.config.migratedKey);
      return migrationFlag === this.config.version;
    } catch (error) {
      Logger.error('Failed to check migration status', error as Error);
      return false;
    }
  }

  /**
   * Get local notifications for migration
   */
  async getLocalNotifications(): Promise<LocalNotification[]> {
    try {
      return await NotificationStorage.getNotifications();
    } catch (error) {
      Logger.error('Failed to get local notifications for migration', error as Error);
      return [];
    }
  }

  /**
   * Convert local notification to migrated format
   */
  private convertLocalNotification(local: LocalNotification): MigratedNotification {
    return {
      ...local,
      source: 'local_migration',
      synced: false,
      migrationVersion: this.config.version,
      originalId: local.id
    };
  }

  /**
   * Create backup of local notifications
   */
  private async createBackup(notifications: LocalNotification[]): Promise<void> {
    try {
      const backup = {
        notifications,
        timestamp: new Date().toISOString(),
        version: this.config.version
      };
      
      await AsyncStorage.setItem(this.config.backupKey, JSON.stringify(backup));
      
      Logger.info('Local notifications backup created', {
        count: notifications.length,
        backupKey: this.config.backupKey
      });
    } catch (error) {
      Logger.error('Failed to create notifications backup', error as Error);
      throw new Error('Backup creation failed');
    }
  }

  /**
   * Store migrated notifications
   */
  private async storeMigratedNotifications(notifications: MigratedNotification[]): Promise<void> {
    try {
      const storageKey = 'migrated_notifications_v2';
      await AsyncStorage.setItem(storageKey, JSON.stringify(notifications));
      
      Logger.info('Migrated notifications stored', {
        count: notifications.length,
        storageKey
      });
    } catch (error) {
      Logger.error('Failed to store migrated notifications', error as Error);
      throw error;
    }
  }

  /**
   * Clear old local notifications if not preserving
   */
  private async clearOldNotifications(): Promise<void> {
    if (this.config.preserveLocal) return;
    
    try {
      await NotificationStorage.clearOldNotifications(0); // Clear all
      Logger.info('Old local notifications cleared');
    } catch (error) {
      Logger.error('Failed to clear old notifications', error as Error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Mark migration as completed
   */
  private async markMigrationCompleted(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.config.migratedKey, this.config.version);
      Logger.info('Migration marked as completed', { version: this.config.version });
    } catch (error) {
      Logger.error('Failed to mark migration as completed', error as Error);
      throw error;
    }
  }

  /**
   * Perform the complete migration process
   */
  async performMigration(): Promise<MigrationStats> {
    const startTime = new Date();
    const stats: MigrationStats = {
      totalFound: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      preservedLocal: 0,
      startTime: startTime.toISOString(),
      endTime: '',
      duration: 0
    };

    try {
      Logger.info('Starting notification migration', { version: this.config.version });

      // Check if already migrated
      const alreadyMigrated = await this.isMigrationCompleted();
      if (alreadyMigrated) {
        Logger.info('Migration already completed, skipping');
        stats.skipped = 1;
        return this.finalizeMigrationStats(stats, startTime);
      }

      // Get local notifications
      const localNotifications = await this.getLocalNotifications();
      stats.totalFound = localNotifications.length;

      if (localNotifications.length === 0) {
        Logger.info('No local notifications found to migrate');
        await this.markMigrationCompleted();
        return this.finalizeMigrationStats(stats, startTime);
      }

      Logger.info('Found local notifications for migration', { 
        count: localNotifications.length 
      });

      // Create backup
      await this.createBackup(localNotifications);

      // Convert notifications
      const migratedNotifications: MigratedNotification[] = [];
      
      for (const local of localNotifications) {
        try {
          const migrated = this.convertLocalNotification(local);
          migratedNotifications.push(migrated);
          stats.migrated++;
        } catch (error) {
          Logger.error('Failed to convert notification', error as Error, {
            notificationId: local.id,
            type: local.type
          });
          stats.errors++;
        }
      }

      // Store migrated notifications
      if (migratedNotifications.length > 0) {
        await this.storeMigratedNotifications(migratedNotifications);
      }

      // Handle old notifications
      if (this.config.preserveLocal) {
        stats.preservedLocal = localNotifications.length;
        Logger.info('Preserving local notifications', { 
          count: stats.preservedLocal 
        });
      } else {
        await this.clearOldNotifications();
      }

      // Mark migration as completed
      await this.markMigrationCompleted();

      Logger.info('Notification migration completed successfully', stats);
      Logger.trackEvent('notification.migration_completed', stats);

    } catch (error) {
      Logger.error('Notification migration failed', error as Error, stats);
      Logger.trackEvent('notification.migration_failed', {
        ...stats,
        error: (error as Error).message
      });
      throw error;
    }

    return this.finalizeMigrationStats(stats, startTime);
  }

  /**
   * Finalize migration statistics
   */
  private finalizeMigrationStats(stats: MigrationStats, startTime: Date): MigrationStats {
    const endTime = new Date();
    stats.endTime = endTime.toISOString();
    stats.duration = endTime.getTime() - startTime.getTime();
    return stats;
  }

  /**
   * Get migrated notifications (for UI display during transition)
   */
  async getMigratedNotifications(): Promise<MigratedNotification[]> {
    try {
      const storageKey = 'migrated_notifications_v2';
      const data = await AsyncStorage.getItem(storageKey);
      
      if (!data) return [];
      
      const notifications = JSON.parse(data) as MigratedNotification[];
      return notifications;
    } catch (error) {
      Logger.error('Failed to get migrated notifications', error as Error);
      return [];
    }
  }

  /**
   * Clean up migrated notifications (call after successful sync)
   */
  async cleanupMigratedNotifications(): Promise<void> {
    try {
      const storageKey = 'migrated_notifications_v2';
      await AsyncStorage.removeItem(storageKey);
      
      Logger.info('Migrated notifications cleaned up');
    } catch (error) {
      Logger.error('Failed to cleanup migrated notifications', error as Error);
    }
  }

  /**
   * Rollback migration (emergency function)
   */
  async rollbackMigration(): Promise<boolean> {
    try {
      Logger.warn('Rolling back notification migration');

      // Restore from backup
      const backupData = await AsyncStorage.getItem(this.config.backupKey);
      if (backupData) {
        const backup = JSON.parse(backupData);
        
        // Restore notifications using the old storage system
        for (const notification of backup.notifications) {
          await NotificationStorage.addNotification({
            type: notification.type,
            title: notification.title,
            message: notification.message
          });
        }
      }

      // Remove migration flag
      await AsyncStorage.removeItem(this.config.migratedKey);

      // Clean up migrated data
      await AsyncStorage.removeItem('migrated_notifications_v2');

      Logger.info('Migration rollback completed');
      Logger.trackEvent('notification.migration_rollback', {
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      Logger.error('Migration rollback failed', error as Error);
      return false;
    }
  }

  /**
   * Get migration status for UI display
   */
  async getMigrationStatus(): Promise<{
    completed: boolean;
    version: string;
    stats?: MigrationStats;
    hasBackup: boolean;
    hasMigrated: boolean;
  }> {
    try {
      const completed = await this.isMigrationCompleted();
      const hasBackup = !!(await AsyncStorage.getItem(this.config.backupKey));
      const hasMigrated = !!(await AsyncStorage.getItem('migrated_notifications_v2'));

      return {
        completed,
        version: this.config.version,
        hasBackup,
        hasMigrated
      };
    } catch (error) {
      Logger.error('Failed to get migration status', error as Error);
      return {
        completed: false,
        version: this.config.version,
        hasBackup: false,
        hasMigrated: false
      };
    }
  }
}

// Singleton instance
export const notificationMigrationService = new NotificationMigrationService();

// Utility functions for migration
export const migrationUtils = {
  /**
   * Auto-run migration if needed (call on app startup)
   */
  async autoMigrate(): Promise<boolean> {
    try {
      const completed = await notificationMigrationService.isMigrationCompleted();
      
      if (!completed) {
        Logger.info('Auto-starting notification migration');
        await notificationMigrationService.performMigration();
        return true;
      }
      
      return false; // No migration needed
    } catch (error) {
      Logger.error('Auto-migration failed', error as Error);
      return false;
    }
  },

  /**
   * Check if local notifications should be shown alongside backend ones
   */
  async shouldShowLocalNotifications(): Promise<boolean> {
    try {
      const status = await notificationMigrationService.getMigrationStatus();
      return !status.completed || MIGRATION_CONFIG.preserveLocal;
    } catch (error) {
      Logger.error('Failed to check if local notifications should be shown', error as Error);
      return true; // Default to showing local notifications on error
    }
  },

  /**
   * Merge local and backend notifications for display
   */
  async mergeNotificationsForDisplay(backendNotifications: any[]): Promise<any[]> {
    try {
      const shouldShowLocal = await migrationUtils.shouldShowLocalNotifications();
      
      if (!shouldShowLocal) {
        return backendNotifications;
      }

      // Get local notifications
      const localNotifications = await NotificationStorage.getNotifications();
      const migratedNotifications = await notificationMigrationService.getMigratedNotifications();

      // Convert local notifications to display format
      const localForDisplay = localNotifications.map(local => ({
        id: `local_${local.id}`,
        type: local.type.toUpperCase(),
        title: local.title,
        body: local.message,
        created_at: new Date(local.timestamp).toISOString(),
        is_read: local.read,
        is_dismissed: false,
        priority: 'NORMAL',
        source: 'local',
        data: {}
      }));

      // Combine and sort by timestamp
      const combined = [...backendNotifications, ...localForDisplay];
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return combined;
    } catch (error) {
      Logger.error('Failed to merge notifications for display', error as Error);
      return backendNotifications; // Fallback to backend only
    }
  }
};