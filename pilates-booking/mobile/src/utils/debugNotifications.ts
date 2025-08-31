/**
 * Debug script for notification system
 * Run this in the Expo dev tools console to test notifications
 */

import { API_BASE_URL } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Add to global scope in development
if (__DEV__) {
  (global as any).debugNotifications = {
    // Test 1: Check API connectivity
    async testApiConnection() {
      console.log('🧪 Testing API connection...');
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const result = await response.text();
        console.log('✅ API Health:', result);
        return { success: true, result };
      } catch (error) {
        console.error('❌ API connection failed:', error);
        return { success: false, error: (error as Error).message };
      }
    },

    // Test 2: Check authentication status
    async checkAuth() {
      console.log('🧪 Checking authentication...');
      try {
        const token = await AsyncStorage.getItem('access_token');
        const userData = await AsyncStorage.getItem('user_data');
        
        console.log('Access Token:', token ? 'Present' : 'Missing');
        console.log('User Data:', userData ? JSON.parse(userData) : 'Missing');
        
        if (!token) {
          console.log('❌ No authentication token found');
          console.log('💡 Please login first: Go to Login screen and sign in');
          return { success: false, error: 'No authentication token' };
        }
        
        return { success: true, token: token ? 'Present' : 'Missing' };
      } catch (error) {
        console.error('❌ Auth check failed:', error);
        return { success: false, error: (error as Error).message };
      }
    },

    // Test 3: Test notification API directly
    async testNotificationAPI() {
      console.log('🧪 Testing notification API...');
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
          console.log('❌ No token found. Please login first.');
          return { success: false, error: 'Not authenticated' };
        }

        const response = await fetch(`${API_BASE_URL}/api/v1/notifications/?limit=3`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error:', response.status, errorText);
          return { success: false, error: `HTTP ${response.status}: ${errorText}` };
        }

        const data = await response.json();
        console.log('✅ Notification API Response:');
        console.log('- Total notifications:', data.notifications?.length || 0);
        console.log('- Unread count:', data.unread_count || 0);
        
        if (data.notifications?.length > 0) {
          console.log('📱 Sample notifications:');
          data.notifications.slice(0, 3).forEach((notif: any, i: number) => {
            console.log(`  ${i + 1}. [${notif.priority}] ${notif.title}`);
          });
        }
        
        return { success: true, data };
      } catch (error) {
        console.error('❌ Notification API test failed:', error);
        return { success: false, error: (error as Error).message };
      }
    },

    // Test 4: Login with test credentials
    async loginAsTestUser() {
      console.log('🧪 Attempting login with test credentials...');
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'admin@pilates.co.il',
            password: 'admin123'
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Login failed:', response.status, errorText);
          return { success: false, error: `Login failed: ${errorText}` };
        }

        const data = await response.json();
        console.log('✅ Login successful!');
        
        // Save tokens
        await AsyncStorage.setItem('access_token', data.access_token);
        await AsyncStorage.setItem('refresh_token', data.refresh_token);
        
        // Get user info
        const userResponse = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
          headers: {
            'Authorization': `Bearer ${data.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          await AsyncStorage.setItem('user_data', JSON.stringify(userData));
          console.log('✅ User data saved:', userData.email, userData.role);
        }
        
        console.log('🎉 Ready to test notifications!');
        return { success: true, tokens: 'Saved' };
      } catch (error) {
        console.error('❌ Login failed:', error);
        return { success: false, error: (error as Error).message };
      }
    },

    // Test 5: Run all tests
    async runAllTests() {
      console.log('🚀 Running all notification system tests...\n');
      
      const results = {
        api: await this.testApiConnection(),
        auth: await this.checkAuth(),
        notifications: { success: false, error: 'Skipped - no auth' }
      };
      
      if (results.auth.success) {
        results.notifications = await this.testNotificationAPI();
      } else {
        console.log('💡 Attempting auto-login...');
        const loginResult = await this.loginAsTestUser();
        if (loginResult.success) {
          results.notifications = await this.testNotificationAPI();
        }
      }
      
      console.log('\n📊 Test Results Summary:');
      console.log('- API Connection:', results.api.success ? '✅' : '❌');
      console.log('- Authentication:', results.auth.success ? '✅' : '❌');
      console.log('- Notifications:', results.notifications.success ? '✅' : '❌');
      
      if (results.api.success && results.auth.success && results.notifications.success) {
        console.log('\n🎉 All tests passed! Notifications should be working.');
        console.log('💡 If notification bell is still empty, try refreshing the app or restarting Metro.');
      } else {
        console.log('\n🔧 Some tests failed. Check the errors above.');
      }
      
      return results;
    },

    // Test 6: Clear stored data (for debugging)
    async clearStoredData() {
      console.log('🧹 Clearing stored authentication data...');
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user_data']);
      console.log('✅ Cleared tokens and user data');
    }
  };

  console.log('🔧 Debug tools available:');
  console.log('- debugNotifications.runAllTests()');
  console.log('- debugNotifications.testApiConnection()');
  console.log('- debugNotifications.checkAuth()');
  console.log('- debugNotifications.testNotificationAPI()');
  console.log('- debugNotifications.loginAsTestUser()');
  console.log('- debugNotifications.clearStoredData()');
}