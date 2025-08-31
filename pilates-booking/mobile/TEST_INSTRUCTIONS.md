# Phase 2 Notification System Testing Instructions

## How to Run the Tests

1. **Open Expo Dev Client** on your device or simulator (the Metro bundler is running)

2. **Open Developer Menu** (shake device or press Ctrl+M on Android/Cmd+D on iOS)

3. **Open Remote JS Debugger** or use Flipper for debugging

4. **In the browser console/debugger**, run these commands:

### Test 1: Run All Tests Automatically
```javascript
// This runs the full test suite
NotificationTestUtils.runAllTests()
```

### Test 2: Individual Tests (run one by one)

```javascript
// Test migration status
NotificationTestUtils.testMigration()

// Test API performance
NotificationTestUtils.testPerformance()

// Test notification flow
NotificationTestUtils.testNotificationFlow()

// Test service triggers (requires user actions)
NotificationTestUtils.testServiceTriggers()

// Test preferences functionality
NotificationTestUtils.testPreferences()

// Debug current state
NotificationTestUtils.debugNotificationState()
```

### Test 3: Manual Testing Steps

#### End-to-End Flow Test:
1. **Make a booking** in the app
2. **Check notification bell** within 10 seconds
3. **Verify** BOOKING_SUCCESS notification appears
4. **Tap notification** and verify it opens correct screen

#### Offline Behavior Test:
1. **Turn on airplane mode**
2. **Try to mark a notification as read**
3. **Turn off airplane mode** 
4. **Verify** the action syncs automatically

#### Priority Styling Test:
1. **Look at notification bell** for different priority indicators
2. **Check colors**: Critical=red, High=orange, Normal=blue, Low=gray
3. **Test haptic feedback** when notifications arrive

#### Language Switch Test:
1. **Change app language** to Hebrew/English
2. **Check notifications** display in correct language
3. **Verify RTL layout** works properly in Hebrew

#### Service Integration Test:
1. **Make a booking** → Check for BOOKING_SUCCESS notification
2. **Cancel a booking** → Check for BOOKING_CANCELLED notification  
3. **Make a payment** → Check for PAYMENT_PROCESSED notification
4. **Join waitlist** → Check for waitlist notification

## Expected Results

### Migration Test:
- ✅ Migration status should be "completed" 
- ✅ Old notifications should be preserved
- ✅ Backup should exist

### Performance Test:
- ✅ All API calls should complete < 2000ms
- ✅ Success rate should be 100%
- ✅ No memory leaks

### Priority Test:
- ✅ Critical notifications show red icon + vibration
- ✅ High priority shows orange + badge
- ✅ Normal shows blue
- ✅ Low shows gray

### Offline Test:
- ✅ Actions queue when offline
- ✅ Auto-sync when online
- ✅ No data loss

### Service Triggers:
- ✅ Booking actions trigger notifications within 10s
- ✅ Payment actions trigger notifications
- ✅ Waitlist actions trigger notifications

## Troubleshooting

If tests fail:
1. **Check backend connection**: `curl http://localhost:8000/health`
2. **Clear app storage**: Delete and reinstall
3. **Reset migration**: `AsyncStorage.removeItem('notifications_migrated_v2')`
4. **Check logs**: Look at Metro bundler logs for errors

## Reporting Results

After running tests, note:
- ✅ **PASSED** tests
- ❌ **FAILED** tests with error messages
- 📊 **Performance metrics**
- 🐛 **Any bugs discovered**

Ready to proceed to **Phase 3** when all tests pass!