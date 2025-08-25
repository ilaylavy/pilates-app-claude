**do not implement yet**
# Social Features

Enhanced booking system with social interactions, friend management, and calendar integration.

## Features Overview

- **Friend System**: Send/accept friend requests, view friends in classes
- **Attendee Display**: See who's attending classes with avatar display
- **Booking Confirmation**: Success modal with QR code and calendar integration
- **Privacy Controls**: Granular privacy settings for social visibility
- **Enhanced Bookings**: Tabs for upcoming/past/cancelled with search and filters

## Quick Setup

### 1. Database Migration
```bash
psql -U your_username -d pilates_db -f backend/migration_add_social_features.sql
```

### 2. Mobile Dependencies
```bash
npx expo install expo-calendar react-native-gesture-handler
npm install react-native-qrcode-svg
```

### 3. App Configuration
Add to `app.json`:
```json
{
  "expo": {
    "plugins": [
      ["expo-calendar", {
        "calendarPermission": "Add booked classes to your calendar"
      }]
    ]
  }
}
```

### 4. Navigation Setup
```tsx
// Add new screens to navigation
<Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
<Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
```

## Key API Endpoints

```bash
POST /api/v1/social/friend-request           # Send friend request
GET  /api/v1/social/friends                  # Get friend list
GET  /api/v1/social/classes/{id}/attendees   # Get class attendees
POST /api/v1/social/invite-to-class         # Invite friend to class
PUT  /api/v1/social/privacy-settings        # Update privacy settings
```

## Key Components

### AttendeeAvatars
```tsx
<AttendeeAvatars
  attendees={attendees}
  maxVisible={5}
  onAttendeePress={(attendee) => navigateToProfile(attendee)}
/>
```

### BookingConfirmationModal
```tsx
<BookingConfirmationModal
  visible={showModal}
  booking={completedBooking}
  creditsRemaining={creditsLeft}
  onViewSchedule={() => navigateToBookings()}
/>
```

## Privacy Settings

Default settings for new users:
- Show in attendee lists: `true`
- Allow profile viewing: `true` 
- Show statistics: `true`

## Testing

Verify key functionality:
- [ ] Book class and see confirmation modal
- [ ] View attendee avatars in class details
- [ ] Add booking to calendar
- [ ] Send/accept friend requests
- [ ] Update privacy settings

## Troubleshooting

- **Calendar permission denied**: Check Info.plist permissions
- **Avatars not showing**: Verify attendee API endpoint
- **QR code issues**: Check react-native-qrcode-svg installation
- **Friend requests failing**: Verify social API endpoints and database migration