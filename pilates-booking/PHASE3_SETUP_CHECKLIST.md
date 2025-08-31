# Phase 3 Setup Checklist - What You Need to Fill In

## 🔥 Firebase Configuration

### Step 1: Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Create new project (or use existing)
3. **Copy your Project ID** (you'll need this)

### Step 2: Add Android App to Firebase
1. In Firebase Console → "Add app" → Android
2. **Android package name**: `com.ilays_apps.pilatesbooking` ✅ (already set in app.json)
3. Download `google-services.json`
4. **Place it here**: `mobile/android/app/google-services.json` ⚠️ **YOU NEED TO DO THIS**

### Step 3: Get Service Account Key
1. Firebase Console → Project Settings → Service Accounts tab
2. Click "Generate new private key"
3. Download the JSON file
4. **Place it here**: `backend/firebase-service-account.json` ⚠️ **YOU NEED TO DO THIS**

### Step 4: Update .env File ⚠️ **YOU NEED TO DO THIS**
In your `.env` file, replace:
```env
FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID_HERE
```
With your actual Firebase project ID from Step 1.

## 📧 SendGrid Configuration (Optional but Recommended)

### Step 1: Create SendGrid Account
1. Go to https://sendgrid.com/
2. Sign up (free tier: 100 emails/day)

### Step 2: Get API Key
1. SendGrid Dashboard → Settings → API Keys
2. Create API Key with "Full Access"
3. **Copy the key** (starts with "SG.")

### Step 3: Update .env File ⚠️ **YOU NEED TO DO THIS**
In your `.env` file, replace:
```env
SENDGRID_API_KEY=SG.YOUR_SENDGRID_API_KEY_HERE
SENDGRID_FROM_EMAIL=noreply@YOUR_DOMAIN.com
SENDGRID_FROM_NAME=Your Studio Name
```
With your actual values.

## 📱 Mobile App Dependencies

Install required packages:
```bash
cd mobile
npm install expo-notifications expo-device expo-constants
```

## 🚀 Test Everything

### Step 1: Restart Backend
```bash
docker-compose down
docker-compose up -d
```

### Step 2: Check Logs
```bash
docker-compose logs backend -f
```
Look for:
- ✅ "Firebase initialized with service account key"
- ✅ "Push notification service enabled: True"
- ✅ "Email service initialized"

### Step 3: Build Mobile App
```bash
cd mobile
npx expo run:android
```

### Step 4: Test Notifications
Use the API endpoints at http://localhost:8000/docs:
- `/api/v1/notification-testing/system-status`
- `/api/v1/notification-testing/test-booking-flow`

## 📋 Summary - Files You Need to Create/Update:

### ⚠️ **REQUIRED FILES YOU NEED TO ADD:**
1. **`mobile/android/app/google-services.json`** - Download from Firebase Console
2. **`backend/firebase-service-account.json`** - Download from Firebase Console

### ⚠️ **REQUIRED .env UPDATES:**
3. **`FIREBASE_PROJECT_ID`** - Replace with your Firebase project ID
4. **`SENDGRID_API_KEY`** - Replace with your SendGrid API key (optional)
5. **`SENDGRID_FROM_EMAIL`** - Replace with your email address (optional)
6. **`SENDGRID_FROM_NAME`** - Replace with your studio name (optional)

### ✅ **ALREADY CONFIGURED:**
- ✅ Backend code with Firebase Admin SDK
- ✅ Mobile app build.gradle with Firebase dependencies
- ✅ app.json with correct package names
- ✅ Docker setup ready
- ✅ All email templates created
- ✅ Testing endpoints available

## 🎯 Result After Setup:
- 📱 Android push notifications working
- 📧 HTML email notifications (if SendGrid configured)
- 🔔 In-app notifications always working
- 🧪 Complete testing suite available
- 📊 System status monitoring

**Total time needed**: ~15 minutes once you have Firebase and SendGrid accounts