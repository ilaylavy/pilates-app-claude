# Firebase Admin SDK Setup Guide (Modern Approach)

## 🚨 Important: Server Key Deprecated

The legacy Firebase Server Key approach has been **deprecated as of June 2023**. This guide shows you how to implement the modern Firebase Admin SDK approach.

### What Changed?
- ❌ **Old**: Server Key from Firebase Console Cloud Messaging tab  
- ✅ **New**: Service Account JSON + Firebase Admin SDK
- ❌ **Old**: PyFCM library with HTTP legacy API
- ✅ **New**: Firebase Admin SDK with HTTP v1 API

---

## 🔧 Backend Changes Made

### 1. **Updated Dependencies**
```diff
- pyfcm==1.5.4
+ firebase-admin==6.2.0
```

### 2. **Updated Configuration**
```python
# OLD - Deprecated
FCM_SERVER_KEY: Optional[str] = None

# NEW - Modern Admin SDK
FIREBASE_PROJECT_ID: Optional[str] = None
FIREBASE_SERVICE_ACCOUNT_KEY: Optional[str] = None  # JSON string or file path  
GOOGLE_APPLICATION_CREDENTIALS: Optional[str] = None  # Path to service account JSON
```

### 3. **Completely Rewritten Push Service**
- ✅ Uses Firebase Admin SDK instead of PyFCM
- ✅ Supports both Android and iOS (no more limitations!)
- ✅ Modern HTTP v1 API with OAuth 2.0 authentication
- ✅ Better error handling and token management
- ✅ Bulk messaging support for efficiency

---

## 📋 Setup Instructions

### Step 1: Firebase Console - Get Service Account
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Open your project
3. Go to **Project Settings** (gear icon)
4. Click **Service Accounts** tab
5. Click **"Generate new private key"**
6. **Download the JSON file** (e.g., `pilates-booking-firebase-adminsdk-xyz123.json`)

⚠️ **CRITICAL**: This file contains sensitive credentials. Never commit it to version control!

### Step 2: Configure Backend Environment

Choose one of these methods:

#### Method 1: File Path (Recommended for Development)
```env
# Place the JSON file in a secure location
GOOGLE_APPLICATION_CREDENTIALS=/path/to/pilates-booking-firebase-adminsdk-xyz123.json
FIREBASE_PROJECT_ID=your-firebase-project-id
```

#### Method 2: JSON String (Good for Docker/Production)
```env
# Copy the entire JSON content as a string
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"pilates-booking-app","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQ...","client_email":"firebase-adminsdk-xyz@pilates-booking-app.iam.gserviceaccount.com","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xyz%40pilates-booking-app.iam.gserviceaccount.com"}'
FIREBASE_PROJECT_ID=your-firebase-project-id
```

#### Method 3: For Docker Compose
```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - FIREBASE_PROJECT_ID=your-firebase-project-id
      - GOOGLE_APPLICATION_CREDENTIALS=/app/firebase-service-account.json
    volumes:
      - ./firebase-service-account.json:/app/firebase-service-account.json:ro
```

### Step 3: Security Setup
```bash
# Add to .gitignore
echo "firebase-service-account.json" >> .gitignore
echo "*.json" >> .gitignore  # Or be more specific

# Set proper file permissions (Linux/Mac)
chmod 600 /path/to/firebase-service-account.json
```

### Step 4: Rebuild Backend
```bash
# Rebuild Docker container with new dependencies
docker-compose down
docker-compose build --no-cache backend
docker-compose up -d

# Check logs for initialization
docker-compose logs backend -f
```

### Step 5: Verify Setup
```bash
# Check Firebase initialization in logs - should see:
# "Firebase Admin SDK initialized successfully"
# "Push notification service enabled: True"
```

---

## 🎯 What You Get

### ✅ **Modern Features**
- **iOS Support**: Full iOS push notifications (when you have Apple Developer account)
- **Android Support**: Enhanced Android push notifications
- **Better Security**: OAuth 2.0 instead of static server keys
- **Bulk Messaging**: Efficient multicast messaging for multiple users
- **Token Management**: Automatic cleanup of invalid/expired tokens
- **Error Handling**: Proper handling of unregistered devices

### ✅ **Production Ready**
- **Scalable**: Firebase Admin SDK is designed for server use
- **Reliable**: Direct integration with Firebase services
- **Secure**: Service account credentials with proper scoping
- **Monitoring**: Better error reporting and debugging

---

## 🧪 Testing

### Test Firebase Initialization
```bash
# Check notification system status
curl -X GET "http://localhost:8000/api/v1/notification-testing/system-status" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"

# Should show:
# {
#   "system_status": {
#     "push": {
#       "fcm_enabled": true,
#       "android_supported": true, 
#       "ios_supported": true,
#       "production_ready": true
#     }
#   }
# }
```

### Test Push Notifications
```bash
# Test booking flow (triggers push notification)
curl -X POST "http://localhost:8000/api/v1/notification-testing/test-booking-flow" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Check Logs
```bash
# Look for these success messages:
docker-compose logs backend -f | grep -i firebase

# Expected:
# "Firebase initialized with service account key"
# "Push notification sent successfully to android device"
```

---

## 🚨 Troubleshooting

### Common Issues

#### 1. "Firebase Admin SDK not available"
```bash
# Solution: Rebuild container with new dependencies
docker-compose build --no-cache backend
```

#### 2. "Failed to initialize Firebase"
- **Check**: Service account JSON file exists and is valid
- **Check**: `FIREBASE_PROJECT_ID` matches your Firebase project
- **Check**: File permissions (should be readable by container)

#### 3. "Invalid service account"
- **Verify**: Downloaded JSON from correct Firebase project
- **Verify**: Service account has Cloud Messaging Admin role
- **Check**: JSON format is valid (use `json.loads()` to test)

#### 4. "Permission denied" errors
```bash
# Fix file permissions
chmod 600 /path/to/service-account.json

# For Docker - ensure file is accessible
docker-compose exec backend ls -la /app/firebase-service-account.json
```

### Debug Commands
```bash
# Verify Firebase project
firebase projects:list

# Test service account (if you have Firebase CLI)
firebase auth:test --project your-project-id

# Check Docker container environment
docker-compose exec backend env | grep FIREBASE
```

---

## 🔐 Production Security

### Best Practices
1. **Never commit** service account JSON files
2. **Use environment variables** for all sensitive data  
3. **Rotate service accounts** periodically
4. **Limit service account permissions** to only Cloud Messaging
5. **Monitor usage** through Firebase Console
6. **Use separate projects** for dev/staging/production

### Service Account Permissions
Ensure your service account has these roles:
- `Firebase Cloud Messaging Admin`
- `Firebase Admin SDK Administrator Service Agent`

---

## 📊 Monitoring

### Firebase Console
- Go to Cloud Messaging → Reports
- View delivery statistics
- Monitor quota usage

### Backend Logs
```bash
# Monitor push notification activity
docker-compose logs backend -f | grep -i "push\|firebase"
```

---

## Summary

✅ **Migration Complete**: Modern Firebase Admin SDK implementation  
✅ **iOS Support**: Now available with Admin SDK  
✅ **Better Security**: OAuth 2.0 authentication  
✅ **Production Ready**: Scalable and reliable  

**Next Steps:**
1. Generate service account key from Firebase Console
2. Configure backend environment variables
3. Rebuild and test the system  
4. Deploy with proper security measures

The notification system is now future-proof and ready for production! 🚀