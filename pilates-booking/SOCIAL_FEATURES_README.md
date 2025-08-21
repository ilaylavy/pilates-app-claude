# Social Features & Booking Management System

This document outlines the comprehensive social booking management system that has been implemented for the Pilates booking application.

## 🚀 Features Overview

### 1. Enhanced Booking Confirmation
- **Success Animation**: Celebratory checkmark animation upon booking
- **Class Details Display**: Complete class information with instructor details
- **Credits Tracking**: Real-time display of remaining credits
- **QR Code Generation**: Check-in QR code for studio use
- **Quick Actions**:
  - Add to Calendar (with expo-calendar integration)
  - Invite Friends (share class link)
  - View Schedule
  - Auto-dismiss after 10 seconds

### 2. Social Class Attendees
- **Avatar Display**: Circular avatars showing class attendees (max 5 visible)
- **Avatar Styling**:
  - Profile pictures or colored initials
  - Consistent user colors based on user ID
  - 32px avatars with 4px white border
  - 8px overlap for compact display
- **"You" Badge**: Special indicator for current user
- **Expandable View**: Tap to see all attendees in modal
- **Search & Filter**: Find specific attendees
- **Privacy Respecting**: Users control their visibility

### 3. Friend System
- **Friend Requests**: Send, accept, reject friend requests
- **Friend Management**: View friend list with mutual connections
- **Blocking**: Block unwanted users
- **Privacy Controls**: Comprehensive privacy settings
- **Friend Discovery**: See friends in class attendee lists

### 4. Public Profile System
- **Profile Viewing**: View other users' public profiles
- **Member Information**: Join date, stats, achievements
- **Mutual Classes**: Classes attended together with friends
- **Privacy Compliance**: Respects user privacy settings
- **Add Friend**: Direct friend request from profile

### 5. Advanced My Bookings Screen
- **Three Tabs**: Upcoming, Past, Cancelled bookings
- **Rich Booking Cards**: 
  - Class details and status badges
  - Attendee avatars
  - Quick action buttons
- **Search & Filter**:
  - By instructor name
  - By class type
  - By date range
  - Friends-only filter
- **Swipe Actions**:
  - Swipe left to cancel
  - Swipe right to share
- **Smart Sorting**: Upcoming classes first, past classes by recency

### 6. Calendar Integration
- **Auto-Add to Calendar**: Seamless calendar integration
- **Permission Management**: Proper calendar access handling
- **Event Details**: Rich event information with location and reminders
- **Sync Management**: 
  - Auto-add future bookings
  - Auto-remove cancelled bookings
  - Update changed classes

### 7. Enhanced Class Invitations
- **Friend Invitations**: Invite friends to specific classes
- **Shared Links**: Generate shareable class links
- **Social Proof**: "X friends attending" indicators
- **Notification System**: Friends notified of invitations

### 8. Privacy & Security
- **Privacy Settings Screen**: Comprehensive privacy controls
- **Granular Permissions**:
  - Show in attendee lists
  - Allow profile viewing
  - Show statistics
- **Friend-Only Visibility**: Some features only visible to friends
- **Block System**: Block unwanted users
- **Data Protection**: Personal info never shared

## 📁 File Structure

### Backend Files Created/Modified:
```
backend/
├── app/
│   ├── models/
│   │   ├── friendship.py              # New: Friendship & invitation models
│   │   └── user.py                    # Modified: Added privacy_settings
│   ├── services/
│   │   └── social_service.py          # New: Social features business logic
│   ├── api/v1/endpoints/
│   │   └── social.py                  # New: Social API endpoints
│   └── api/v1/api.py                  # Modified: Added social router
└── migration_add_social_features.sql  # New: Database migration
```

### Mobile Files Created/Modified:
```
mobile/src/
├── components/
│   ├── AttendeeAvatars.tsx           # New: Attendee display component
│   ├── BookingCard.tsx               # New: Enhanced booking display
│   └── BookingConfirmationModal.tsx   # New: Success modal with actions
├── screens/
│   ├── BookingsScreen.tsx            # Modified: Complete redesign
│   ├── ClassDetailsScreen.tsx        # Modified: Added social features
│   ├── PublicProfileScreen.tsx       # New: View other users
│   └── PrivacySettingsScreen.tsx     # New: Privacy controls
├── api/
│   └── social.ts                     # New: Social API client
├── utils/
│   └── calendarUtils.ts              # New: Calendar integration utilities
└── types/index.ts                    # Modified: Added social types
```

## 🛠 Installation & Setup

### 1. Database Migration
Run the database migration to add social features:
```sql
-- Execute the migration file
psql -d your_database -f backend/migration_add_social_features.sql
```

### 2. Backend Dependencies
No additional backend dependencies required.

### 3. Mobile Dependencies
The following expo packages are required:
```bash
npx expo install expo-calendar
npx expo install react-native-qrcode-svg
npx expo install react-native-gesture-handler
```

### 4. Navigation Updates
Add new screens to your navigation:
```tsx
// Add to your navigation stack
import PublicProfileScreen from '../screens/PublicProfileScreen';
import PrivacySettingsScreen from '../screens/PrivacySettingsScreen';

// In your stack navigator:
<Stack.Screen name="PublicProfile" component={PublicProfileScreen} />
<Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
```

## 📱 API Endpoints

### Social Endpoints (`/api/v1/social/`)
- `POST /friend-request` - Send friend request
- `POST /friend-request/{user_id}/accept` - Accept friend request
- `DELETE /friend-request/{user_id}` - Reject/remove friendship
- `POST /block/{user_id}` - Block user
- `GET /friends` - Get friend list
- `GET /friend-requests` - Get pending requests
- `GET /classes/{class_id}/attendees` - Get class attendees
- `GET /classes/{class_id}/friends` - Get friends in class
- `POST /invite-to-class` - Invite friend to class
- `GET /users/{user_id}/public-profile` - Get public profile
- `GET /mutual-classes/{friend_id}` - Get mutual classes
- `PUT /privacy-settings` - Update privacy settings

## 🎨 UI Components

### AttendeeAvatars
```tsx
<AttendeeAvatars
  attendees={attendees}
  maxVisible={5}
  size={32}
  onAttendeePress={(attendee) => navigateToProfile(attendee)}
/>
```

### BookingConfirmationModal
```tsx
<BookingConfirmationModal
  visible={showModal}
  onClose={() => setShowModal(false)}
  booking={completedBooking}
  classInstance={classInstance}
  creditsRemaining={creditsLeft}
  onViewSchedule={() => navigateToBookings()}
/>
```

### BookingCard
```tsx
<BookingCard
  booking={booking}
  attendees={attendees}
  onPress={() => viewClass()}
  onCancel={() => cancelBooking()}
  onShare={() => shareClass()}
  onReschedule={() => rescheduleClass()}
/>
```

## 🔒 Privacy Features

### Default Privacy Settings
New users get these default privacy settings:
- `show_in_attendees`: `true`
- `allow_profile_viewing`: `true`
- `show_stats`: `true`

### Privacy Hierarchy
1. **Blocked Users**: Cannot see any information
2. **Privacy Settings**: Control visibility to non-friends
3. **Friends**: Always see profile and attendance (overrides privacy)
4. **Admin/Instructors**: Can always see attendee lists for operational purposes

## 📅 Calendar Integration Features

### Automatic Sync
- **Booking Created**: Automatically adds to calendar (if enabled)
- **Booking Cancelled**: Removes from calendar
- **Class Updated**: Updates calendar event

### Calendar Event Details
- **Title**: "[Class Name] Class"
- **Location**: "Pilates Studio" (configurable)
- **Notes**: Instructor info, booking ID, app attribution
- **Reminders**: 30 minutes before (configurable)
- **Time Zone**: Proper handling across platforms

## 🧪 Testing Recommendations

### Backend Testing
1. **Friendship System**:
   - Test friend request flow
   - Test blocking functionality
   - Test privacy filtering

2. **API Security**:
   - Test authorization on social endpoints
   - Verify privacy settings enforcement

### Mobile Testing
1. **UI Components**:
   - Test avatar displays with various attendee counts
   - Test modal animations and auto-dismiss
   - Test swipe gestures on booking cards

2. **Calendar Integration**:
   - Test on both iOS and Android
   - Test permission handling
   - Test calendar event creation/updates

3. **Social Features**:
   - Test friend request notifications
   - Test privacy setting changes
   - Test attendee list updates

## 🚀 Future Enhancements

### Planned Features
1. **Real-time Updates**: WebSocket integration for live attendee updates
2. **Push Notifications**: Friend activity notifications
3. **Messaging System**: Direct messages between friends
4. **Group Classes**: Create and manage friend groups
5. **Achievements**: Social achievements and badges
6. **Class Reviews**: Rate and review classes with friends

### Performance Optimizations
1. **Caching**: Implement Redis caching for social queries
2. **Pagination**: Add pagination to large friend/attendee lists
3. **Image Optimization**: Optimize avatar images
4. **Background Sync**: Background calendar synchronization

## 📄 Usage Examples

### Adding Social Features to Existing Class View
```tsx
// In your ClassDetailsScreen
import { socialApi } from '../api/social';
import AttendeeAvatars from '../components/AttendeeAvatars';

const { data: attendees } = useQuery({
  queryKey: ['attendees', classId],
  queryFn: () => socialApi.getClassAttendees(classId),
});

// In render:
{attendees?.length > 0 && (
  <AttendeeAvatars
    attendees={attendees}
    onAttendeePress={(attendee) => 
      navigation.navigate('PublicProfile', { userId: attendee.id })
    }
  />
)}
```

### Implementing Booking Success Flow
```tsx
const bookingMutation = useMutation({
  mutationFn: bookClass,
  onSuccess: (booking) => {
    setCompletedBooking(booking);
    setShowSuccessModal(true);
    // Calendar will be handled in modal
  },
});
```

This comprehensive social booking management system transforms the basic class booking app into a social, engaging platform that encourages community building while respecting user privacy and providing powerful management tools.