# Social Features Setup Guide

This guide will help you set up and integrate the new social booking management features.

## 📦 Required Dependencies

### Mobile App Dependencies

Install the required Expo packages:

```bash
# Calendar integration
npx expo install expo-calendar

# QR Code generation
npm install react-native-qrcode-svg
npm install --save-dev @types/react-native-qrcode-svg

# Gesture handling for swipe actions
npx expo install react-native-gesture-handler

# Image handling (if not already installed)
npx expo install expo-image
```

Update your `package.json` dependencies:

```json
{
  "dependencies": {
    "expo-calendar": "~12.0.0",
    "react-native-qrcode-svg": "^6.2.0",
    "react-native-gesture-handler": "~2.14.0",
    "expo-image": "~1.10.1"
  },
  "devDependencies": {
    "@types/react-native-qrcode-svg": "^6.2.0"
  }
}
```

### Backend Dependencies

No additional backend dependencies are required. The social features use existing FastAPI, SQLAlchemy, and PostgreSQL infrastructure.

## 🗄️ Database Setup

### 1. Run Database Migration

Execute the SQL migration to add social features:

```bash
# Connect to your PostgreSQL database
psql -U your_username -d pilates_db

# Run the migration
\i backend/migration_add_social_features.sql

# Verify tables were created
\dt
```

### 2. Verify Migration Success

Check that the following tables were created:
- `friendships`
- `class_invitations`
- `users` table should have new `privacy_settings` column

```sql
-- Verify friendships table
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'friendships';

-- Verify privacy_settings column
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'privacy_settings';
```

## ⚙️ Backend Configuration

### 1. Update API Router

The social endpoints should already be included in `backend/app/api/v1/api.py`. Verify the import:

```python
from .endpoints import (auth, bookings, classes, logs, packages, payments,
                        social, users, webhooks)

# Social router should be included
api_router.include_router(social.router, tags=["social"])
```

### 2. Update Models Import

Verify `backend/app/models/__init__.py` includes the new models:

```python
from .friendship import Friendship, ClassInvitation

__all__ = [
    # ... existing models ...
    "Friendship",
    "ClassInvitation",
]
```

## 📱 Mobile App Configuration

### 1. Navigation Setup

Add the new screens to your navigation stack:

```tsx
// In your main navigation file (e.g., Navigation.tsx)
import PublicProfileScreen from '../screens/PublicProfileScreen';
import PrivacySettingsScreen from '../screens/PrivacySettingsScreen';

// Add to your Stack Navigator
<Stack.Screen 
  name="PublicProfile" 
  component={PublicProfileScreen}
  options={{ title: 'Profile' }}
/>
<Stack.Screen 
  name="PrivacySettings" 
  component={PrivacySettingsScreen}
  options={{ title: 'Privacy Settings' }}
/>
```

### 2. App Configuration (app.json/expo.json)

Add calendar permissions to your Expo configuration:

```json
{
  "expo": {
    "name": "Pilates Studio",
    "plugins": [
      [
        "expo-calendar",
        {
          "calendarPermission": "The app needs access to your calendar to add class bookings."
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "NSCalendarsUsageDescription": "This app needs access to calendar to add your booked classes.",
        "NSRemindersUsageDescription": "This app needs access to reminders to set up class notifications."
      }
    },
    "android": {
      "permissions": [
        "android.permission.READ_CALENDAR",
        "android.permission.WRITE_CALENDAR"
      ]
    }
  }
}
```

### 3. Gesture Handler Setup

For React Navigation v6 with gesture handler, ensure proper setup in your main App.tsx:

```tsx
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Your app content */}
    </GestureHandlerRootView>
  );
}
```

## 🔧 Integration Steps

### 1. Update Existing Screens

Replace your existing `BookingsScreen.tsx` with the enhanced version that includes social features.

### 2. Update ClassDetailsScreen

The provided `ClassDetailsScreen.tsx` includes social features. Key additions:
- Attendee avatars display
- Friends in class indicator
- Enhanced booking confirmation

### 3. Add Privacy Settings to Profile

Add a link to privacy settings in your existing ProfileScreen:

```tsx
<TouchableOpacity
  style={styles.settingRow}
  onPress={() => navigation.navigate('PrivacySettings')}
>
  <Ionicons name="shield-checkmark" size={24} color={COLORS.primary} />
  <View style={styles.settingContent}>
    <Text style={styles.settingTitle}>Privacy Settings</Text>
    <Text style={styles.settingDescription}>Control your social visibility</Text>
  </View>
  <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
</TouchableOpacity>
```

## 🧪 Testing Setup

### 1. Install Testing Dependencies

```bash
npm install --save-dev @testing-library/react-native
npm install --save-dev @testing-library/jest-native
```

### 2. Configure Jest

Update your `jest.config.js`:

```javascript
module.exports = {
  preset: '@react-native/babel-preset',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|react-native-qrcode-svg)/)',
  ],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

### 3. Mock Configuration

Create `__mocks__` directory with necessary mocks:

```typescript
// __mocks__/expo-calendar.ts
export const requestCalendarPermissionsAsync = jest.fn(() =>
  Promise.resolve({ status: 'granted' })
);

export const getCalendarsAsync = jest.fn(() =>
  Promise.resolve([
    {
      id: '1',
      title: 'Default',
      isPrimary: true,
      allowsModifications: true,
    },
  ])
);

export const createEventAsync = jest.fn(() => Promise.resolve('event-id-123'));
```

## 🚀 Deployment Checklist

### Development Environment
- [ ] Database migration completed
- [ ] All dependencies installed
- [ ] Navigation routes added
- [ ] Calendar permissions configured
- [ ] Tests passing

### Production Environment
- [ ] Database migration script ready
- [ ] Environment variables set
- [ ] Calendar permissions configured for production bundle
- [ ] API endpoints tested
- [ ] Privacy settings default values set

## 🔍 Verification Steps

### 1. Backend Verification

Test the API endpoints:

```bash
# Test social endpoints (replace with your API base URL)
curl -X GET "http://localhost:8000/api/v1/social/friends" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

curl -X GET "http://localhost:8000/api/v1/social/classes/1/attendees" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 2. Mobile Verification

1. **Booking Flow**: Book a class and verify the confirmation modal appears
2. **Attendee Display**: Check that class details show attendee avatars
3. **Calendar Integration**: Verify "Add to Calendar" functionality
4. **Privacy Settings**: Test privacy controls in settings
5. **Friend System**: Test friend requests and profile viewing

### 3. Database Verification

Check that data is being stored correctly:

```sql
-- Check friendships
SELECT * FROM friendships LIMIT 5;

-- Check privacy settings
SELECT id, first_name, privacy_settings FROM users LIMIT 5;

-- Check class invitations
SELECT * FROM class_invitations LIMIT 5;
```

## 🐛 Troubleshooting

### Common Issues

1. **Calendar Permission Denied**
   - Ensure Info.plist includes NSCalendarsUsageDescription
   - Check app permissions in device settings

2. **Gesture Handler Issues**
   - Verify react-native-gesture-handler is installed
   - Check GestureHandlerRootView wraps your app

3. **QR Code Not Rendering**
   - Ensure react-native-qrcode-svg is installed correctly
   - Check that QR data is valid JSON

4. **Database Migration Fails**
   - Check PostgreSQL permissions
   - Verify database connection
   - Check for existing table conflicts

5. **API 500 Errors**
   - Check backend logs for detailed errors
   - Verify database schema matches models
   - Check authentication tokens

### Debug Mode

Enable debug logging by setting environment variables:

```bash
# Backend
export LOG_LEVEL=DEBUG

# React Native
export REACT_NATIVE_LOG_LEVEL=debug
```

## 📞 Support

If you encounter issues:

1. Check the logs for specific error messages
2. Verify all dependencies are installed correctly
3. Ensure database migration completed successfully
4. Test API endpoints directly with curl or Postman
5. Check that all required permissions are granted

The social features are designed to be backwards compatible, so existing functionality should continue working even if social features fail to load.