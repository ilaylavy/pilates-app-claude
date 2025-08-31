# Firebase Mobile App Setup Guide

This guide explains how to complete the Firebase setup for push notifications in your mobile app.

## ✅ What I've Done

### 1. **Updated Gradle Configuration**
- ✅ Added Google services plugin to project-level `android/build.gradle`
- ✅ Added Google services plugin to app-level `android/app/build.gradle`  
- ✅ Added Firebase BoM and messaging dependencies
- ✅ Fixed package name consistency

### 2. **Updated App Configuration**
- ✅ Fixed Android package name to match: `com.ilays_apps.pilatesbooking`
- ✅ Added Google services file path configuration
- ✅ Added expo-notifications plugin with configuration

## 🔥 Firebase Console Steps (You Need To Do)

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Name: **"pilates-booking-app"** (or your preference)
4. Enable/disable Google Analytics as desired
5. Click "Create project"

### Step 2: Add Android App
1. In Firebase project, click "Add app" > Android icon
2. **Android package name**: `com.ilays_apps.pilatesbooking` 
   *(This must match exactly what's in the build.gradle)*
3. **App nickname**: "Pilates Booking" (optional)
4. **Debug signing certificate SHA-1**: Get from development keystore
5. Click "Register app"

### Step 3: Get SHA-1 Certificate
```bash
# Navigate to your mobile directory
cd mobile

# Get SHA-1 from debug keystore
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Look for the SHA1 fingerprint and paste it in Firebase
```

### Step 4: Download google-services.json
1. Download the `google-services.json` file from Firebase
2. **Important**: Place it at `mobile/android/app/google-services.json`
3. **Security**: Add to `.gitignore`:
   ```gitignore
   # Firebase config
   android/app/google-services.json
   ```

### Step 5: Get Service Account Key (Modern Approach)
1. In Firebase Console → Project Settings (gear icon)
2. Go to "Service Accounts" tab
3. Click "Generate new private key"
4. Download the JSON file (e.g., `pilates-booking-firebase-adminsdk-abc123.json`)
5. **IMPORTANT**: Keep this file secure and never commit to version control
6. Add to backend environment:
   ```env
   # Method 1: JSON file path (recommended for production)
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
   FIREBASE_PROJECT_ID=your-firebase-project-id

   # Method 2: JSON content as string (for containerized environments)
   FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project"...}'
   FIREBASE_PROJECT_ID=your-firebase-project-id
   ```

## 📦 Install Dependencies

```bash
cd mobile

# Install expo-notifications if not already installed
npm install expo-notifications

# Install other required packages
npm install expo-device expo-constants

# Clear cache and rebuild
npx expo install --fix
```

## 🏗️ Build and Test

### Development Build
```bash
# Build for Android with new Firebase config
npx expo run:android

# OR if using EAS Build
eas build --platform android --profile development
```

### Test Push Notifications
1. **Run the app** on Android device/emulator
2. **Grant notification permissions** when prompted
3. **Check device registration** in backend logs:
   ```bash
   docker-compose logs backend -f | grep -i "device token"
   ```
4. **Test notification** via backend API:
   ```bash
   # Use /api/v1/notification-testing/test-booking-flow
   ```

## 📋 Complete File Structure

After setup, you should have:

```
mobile/
├── android/
│   ├── app/
│   │   ├── google-services.json          # ← Firebase config file
│   │   └── build.gradle                  # ← Updated with Firebase deps
│   └── build.gradle                      # ← Updated with Google services plugin
├── app.json                              # ← Updated with notifications config
└── package.json                          # ← Should include expo-notifications
```

## 🔍 Verify Setup

### 1. Build Without Errors
```bash
cd mobile
npx expo run:android
```

Should build successfully without Firebase-related errors.

### 2. Check Device Token Registration
In your app, the push notification service should:
- Request permissions
- Register device token with backend
- Show "Push notifications enabled" in settings

### 3. Backend Integration
Check backend logs for:
```
[INFO] Device token registered for user X
[INFO] Push notification sent successfully
```

## 🚫 Common Issues

### Build Errors
- **"google-services.json not found"**: Ensure file is in `mobile/android/app/`
- **"Duplicate class"**: Clean and rebuild: `cd android && ./gradlew clean`
- **Package name mismatch**: Verify Firebase project uses `com.ilays_apps.pilatesbooking`

### Runtime Issues
- **No push notifications**: Check permissions, device token registration
- **401 Unauthorized**: Verify FCM_SERVER_KEY in backend environment
- **Token not found**: Ensure user is logged in and has granted permissions

### Debug Commands
```bash
# Check if google-services.json exists
ls -la mobile/android/app/google-services.json

# View Firebase configuration
cat mobile/android/app/google-services.json | jq .

# Check backend FCM configuration
curl -X GET http://localhost:8000/api/v1/notification-testing/system-status
```

## 🎯 Testing Checklist

- [ ] Firebase project created with correct package name
- [ ] google-services.json downloaded and placed correctly
- [ ] App builds without errors
- [ ] Push permission requested in app
- [ ] Device token registered with backend
- [ ] Backend shows "FCM enabled: true" in logs
- [ ] Test notification successfully sent and received
- [ ] Booking flow triggers push notification

## 🔐 Security Notes

1. **Never commit** `google-services.json` to version control
2. **Never commit** `FCM_SERVER_KEY` to version control  
3. Use environment variables for all keys
4. Consider using Firebase service accounts for production
5. Rotate keys periodically

## 📱 iOS Support (Future)

When you get Apple Developer account:
1. Add iOS app to Firebase project
2. Download `GoogleService-Info.plist` 
3. Configure APNs certificates
4. Update app.json with iOS notification config
5. Test on iOS devices

For now, iOS users see "coming soon" messaging.

---

## Summary

Your mobile app is now configured for Firebase push notifications! 

**Next steps:**
1. ✅ Complete Firebase Console setup (create project, add Android app)
2. ✅ Download and place `google-services.json`  
3. ✅ Build and test the app
4. ✅ Verify push notifications work end-to-end

The Phase 3 notification system will then be fully operational with email + push + in-app notifications! 🚀