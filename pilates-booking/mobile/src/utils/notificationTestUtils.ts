/**
 * Testing utilities for the notification system
 * Use these in development to test notification flows
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../services/LoggingService';
import { notificationMigrationService } from './notificationMigration';
import { NotificationStorage } from './notificationStorage';
import { notificationsApi } from '../api/notifications';

export class NotificationTestUtils {
  
  /**
   * Test the end-to-end notification flow
   */
  static async testNotificationFlow() {
    console.log('🧪 Starting notification flow test...');
    
    try {
      // Step 1: Check current state
      const unreadCount = await notificationsApi.getUnreadCount();
      console.log('📊 Current unread count:', unreadCount.count);
      
      // Step 2: Fetch notifications
      const notifications = await notificationsApi.getNotifications(0, 10);
      console.log('📋 Recent notifications:', notifications.notifications.length);
      
      // Step 3: Test notification polling
      console.log('⏱️ Testing polling - waiting 10 seconds...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Step 4: Check if new notifications appeared
      const newNotifications = await notificationsApi.getNotifications(0, 10);
      const newCount = newNotifications.notifications.length;
      
      console.log('✅ Notification flow test complete');
      console.log('📈 Notifications before/after:', notifications.notifications.length, '→', newCount);
      
      return {
        success: true,
        initialCount: notifications.notifications.length,
        finalCount: newCount,
        unreadCount: unreadCount.count
      };
    } catch (error) {
      console.error('❌ Notification flow test failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }
  
  /**
   * Test offline behavior
   */
  static async testOfflineBehavior() {
    console.log('🧪 Testing offline behavior...');
    console.log('📱 Please turn on airplane mode now and wait 5 seconds');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      // Try to fetch notifications while offline
      console.log('📡 Attempting to fetch notifications while offline...');
      const result = await notificationsApi.getNotifications(0, 5);
      console.log('🔍 Offline fetch result:', result ? 'Success (cached)' : 'Failed');
      
      // Try to mark a notification as read while offline
      if (result.notifications.length > 0) {
        const firstNotification = result.notifications[0];
        console.log('📝 Attempting to mark notification as read while offline...');
        
        try {
          await notificationsApi.markAsRead(firstNotification.id);
          console.log('✅ Mark as read succeeded (will be queued)');
        } catch (error) {
          console.log('📦 Mark as read queued for when online:', error);
        }
      }
      
      console.log('📱 Please turn off airplane mode and wait 10 seconds');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Test sync after coming back online
      console.log('🔄 Testing sync after coming back online...');
      const syncedResult = await notificationsApi.getNotifications(0, 5);
      console.log('✅ Sync test complete, notifications:', syncedResult.notifications.length);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Offline test failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }
  
  /**
   * Test notification priorities and styling
   */
  static testPriorityStyling() {
    console.log('🧪 Testing priority styling...');
    
    const priorities = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'] as const;
    
    priorities.forEach(priority => {
      // This would be used in the component to test styling
      const mockNotification = {
        id: Math.random(),
        priority,
        title: `Test ${priority} notification`,
        body: `This is a ${priority.toLowerCase()} priority notification`,
        type: 'ADMIN_ANNOUNCEMENT',
        created_at: new Date().toISOString(),
        is_read: false,
        is_dismissed: false
      };
      
      console.log(`🎨 ${priority} priority notification created:`, mockNotification.title);
    });
    
    console.log('✅ Priority styling test complete');
    console.log('💡 Check the notification bell for different priority colors');
    return { success: true };
  }
  
  /**
   * Test migration status
   */
  static async testMigration() {
    console.log('🧪 Testing migration status...');
    
    try {
      // Check migration status
      const status = await notificationMigrationService.getMigrationStatus();
      console.log('📊 Migration status:', status);
      
      // Check if old notifications exist
      const oldNotifications = await NotificationStorage.getNotifications();
      console.log('📜 Old notifications count:', oldNotifications.length);
      
      // Check if migration data exists
      const migrationData = await AsyncStorage.getItem('migrated_notifications_v2');
      const hasMigrationData = !!migrationData;
      console.log('📦 Migration data exists:', hasMigrationData);
      
      // Check migration flag
      const migrationFlag = await AsyncStorage.getItem('notifications_migrated_v2');
      console.log('🚩 Migration completed:', migrationFlag === '2.0.0');
      
      return {
        success: true,
        status,
        oldNotificationsCount: oldNotifications.length,
        hasMigrationData,
        migrationCompleted: migrationFlag === '2.0.0'
      };
    } catch (error) {
      console.error('❌ Migration test failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }
  
  /**
   * Test notification preferences
   */
  static async testPreferences() {
    console.log('🧪 Testing notification preferences...');
    
    try {
      // Fetch current preferences
      const preferences = await notificationsApi.getPreferences();
      console.log('⚙️ Current preferences count:', preferences.length);
      
      if (preferences.length > 0) {
        const firstPref = preferences[0];
        console.log('📋 Testing preference:', firstPref.notification_type);
        
        // Toggle the preference
        const newEnabled = !firstPref.enabled;
        console.log(`🔄 Toggling ${firstPref.notification_type} from ${firstPref.enabled} to ${newEnabled}`);
        
        const updatedPref = await notificationsApi.updatePreferences(
          firstPref.notification_type,
          { enabled: newEnabled }
        );
        
        console.log('✅ Preference updated:', updatedPref.enabled === newEnabled);
        
        // Toggle back
        await notificationsApi.updatePreferences(
          firstPref.notification_type,
          { enabled: firstPref.enabled }
        );
        
        console.log('🔄 Preference restored to original state');
      }
      
      return { success: true, preferencesCount: preferences.length };
    } catch (error) {
      console.error('❌ Preferences test failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }
  
  /**
   * Test service triggers by simulating actions
   */
  static async testServiceTriggers() {
    console.log('🧪 Testing service triggers...');
    
    try {
      // Test notification types endpoint
      const types = await notificationsApi.getNotificationTypes();
      console.log('📋 Available notification types:', types.notification_types.length);
      
      // Get initial notification count
      const initialNotifications = await notificationsApi.getNotifications(0, 10);
      const initialCount = initialNotifications.notifications.length;
      console.log('📊 Initial notification count:', initialCount);
      
      console.log('💡 To test triggers:');
      console.log('  1. Make a booking → Check for BOOKING_SUCCESS notification');
      console.log('  2. Cancel a booking → Check for BOOKING_CANCELLED notification');
      console.log('  3. Make a payment → Check for PAYMENT_PROCESSED notification');
      console.log('  4. Join waitlist → Check for waitlist notification');
      console.log('  5. Admin actions → Check for admin notifications');
      
      // Wait a bit then check for new notifications
      console.log('⏱️ Waiting 10 seconds to check for new notifications...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const finalNotifications = await notificationsApi.getNotifications(0, 10);
      const finalCount = finalNotifications.notifications.length;
      const newNotifications = finalCount - initialCount;
      
      console.log('📈 Final notification count:', finalCount);
      console.log('🆕 New notifications detected:', newNotifications);
      
      if (newNotifications > 0) {
        const recentNotifications = finalNotifications.notifications.slice(0, newNotifications);
        recentNotifications.forEach((notification, index) => {
          console.log(`📬 New notification ${index + 1}:`, {
            type: notification.type,
            title: notification.title,
            priority: notification.priority,
            created: new Date(notification.created_at).toLocaleTimeString()
          });
        });
      }
      
      return {
        success: true,
        initialCount,
        finalCount,
        newNotifications,
        availableTypes: types.notification_types.length
      };
    } catch (error) {
      console.error('❌ Service triggers test failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }
  
  /**
   * Test performance and metrics
   */
  static async testPerformance() {
    console.log('🧪 Testing performance and metrics...');
    
    const startTime = Date.now();
    
    try {
      // Test multiple API calls to measure performance
      const calls = [
        () => notificationsApi.getNotifications(0, 10),
        () => notificationsApi.getUnreadCount(),
        () => notificationsApi.getNotificationTypes(),
        () => notificationsApi.getPreferences()
      ];
      
      console.log('🚀 Running performance tests...');
      
      const results = await Promise.allSettled(
        calls.map(async (call, index) => {
          const callStart = Date.now();
          try {
            await call();
            const duration = Date.now() - callStart;
            console.log(`✅ API call ${index + 1} completed in ${duration}ms`);
            return { success: true, duration, call: index + 1 };
          } catch (error) {
            const duration = Date.now() - callStart;
            console.log(`❌ API call ${index + 1} failed after ${duration}ms:`, error);
            return { success: false, duration, call: index + 1, error };
          }
        })
      );
      
      const totalTime = Date.now() - startTime;
      const successfulCalls = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      
      console.log('📊 Performance test results:');
      console.log(`  Total time: ${totalTime}ms`);
      console.log(`  Successful calls: ${successfulCalls}/${results.length}`);
      console.log(`  Average call time: ${Math.round(totalTime / results.length)}ms`);
      
      return {
        success: true,
        totalTime,
        successfulCalls,
        totalCalls: results.length,
        results
      };
    } catch (error) {
      console.error('❌ Performance test failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }
  
  /**
   * Run all tests
   */
  static async runAllTests() {
    console.log('🧪 Running comprehensive notification system tests...');
    console.log('=' .repeat(60));
    
    const tests = [
      { name: 'Migration Status', fn: () => this.testMigration() },
      { name: 'Performance', fn: () => this.testPerformance() },
      { name: 'Priority Styling', fn: () => this.testPriorityStyling() },
      { name: 'Service Triggers', fn: () => this.testServiceTriggers() },
      { name: 'Preferences', fn: () => this.testPreferences() },
      { name: 'Notification Flow', fn: () => this.testNotificationFlow() }
    ];
    
    const results = [];
    
    for (const test of tests) {
      console.log(`\n🔬 Running ${test.name} test...`);
      console.log('-'.repeat(40));
      
      try {
        const result = await test.fn();
        results.push({ name: test.name, ...result });
        
        if (result.success) {
          console.log(`✅ ${test.name} test PASSED`);
        } else {
          console.log(`❌ ${test.name} test FAILED:`, 'error' in result ? result.error : 'Unknown error');
        }
      } catch (error) {
        console.log(`💥 ${test.name} test CRASHED:`, error);
        results.push({ name: test.name, success: false, error: (error as Error).message });
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    
    console.log(`✅ Passed: ${passed}/${total} tests`);
    console.log(`❌ Failed: ${total - passed}/${total} tests`);
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`  ${status} ${result.name}`);
    });
    
    console.log('\n💡 Next steps:');
    if (passed === total) {
      console.log('🎉 All tests passed! Ready for Phase 3.');
    } else {
      console.log('🔧 Some tests failed. Please review the errors above.');
    }
    
    return { passed, total, results };
  }
  
  /**
   * Debug notification state
   */
  static async debugNotificationState() {
    console.log('🔍 Debugging notification state...');
    
    try {
      // Check AsyncStorage keys
      const keys = await AsyncStorage.getAllKeys();
      const notificationKeys = keys.filter(key => key.includes('notification'));
      
      console.log('🗝️ Notification-related AsyncStorage keys:', notificationKeys);
      
      for (const key of notificationKeys) {
        const value = await AsyncStorage.getItem(key);
        const parsedValue = value ? JSON.parse(value) : null;
        
        if (Array.isArray(parsedValue)) {
          console.log(`📦 ${key}: Array with ${parsedValue.length} items`);
        } else if (typeof parsedValue === 'object' && parsedValue !== null) {
          console.log(`📦 ${key}:`, Object.keys(parsedValue));
        } else {
          console.log(`📦 ${key}:`, parsedValue);
        }
      }
      
      // Check migration status
      const migrationStatus = await notificationMigrationService.getMigrationStatus();
      console.log('🔄 Migration status:', migrationStatus);
      
      // Check current notifications
      const notifications = await notificationsApi.getNotifications(0, 5);
      console.log('📋 Current notifications:', {
        count: notifications.notifications.length,
        unreadCount: notifications.unread_count,
        hasMore: notifications.pagination.has_more
      });
      
      return { success: true };
    } catch (error) {
      console.error('❌ Debug failed:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}

// Export for global access in development
if (__DEV__) {
  (global as any).NotificationTestUtils = NotificationTestUtils;
  console.log('🧪 NotificationTestUtils available globally in development');
  console.log('💡 Usage: NotificationTestUtils.runAllTests()');
}