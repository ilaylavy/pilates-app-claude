#!/usr/bin/env node

/**
 * Bulletproof Configuration Validator
 * Checks that all Firebase and Expo configurations are properly set up
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Pilates App Configuration...\n');

const errors = [];
const warnings = [];

// 1. Check app.json configuration
console.log('📱 Checking app.json...');
try {
  const appJsonPath = path.join(__dirname, 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  
  const expoProjectId = appJson.expo?.extra?.eas?.projectId;
  const firebaseConfig = appJson.expo?.extra?.firebase;
  const androidPackage = appJson.expo?.android?.package;
  
  if (!expoProjectId) {
    errors.push('❌ Missing expo.extra.eas.projectId in app.json');
  } else {
    console.log(`   ✅ Expo Project ID: ${expoProjectId}`);
  }
  
  if (!firebaseConfig?.projectId) {
    errors.push('❌ Missing expo.extra.firebase.projectId in app.json');
  } else {
    console.log(`   ✅ Firebase Project ID: ${firebaseConfig.projectId}`);
  }
  
  if (!androidPackage) {
    errors.push('❌ Missing expo.android.package in app.json');
  } else {
    console.log(`   ✅ Android Package: ${androidPackage}`);
  }
  
} catch (error) {
  errors.push(`❌ Cannot read app.json: ${error.message}`);
}

// 2. Check google-services.json
console.log('\n🔥 Checking google-services.json...');
try {
  const googleServicesPath = path.join(__dirname, 'android', 'app', 'google-services.json');
  const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
  
  const projectId = googleServices.project_info?.project_id;
  const androidApp = googleServices.client?.[0];
  const packageName = androidApp?.client_info?.android_client_info?.package_name;
  
  if (!projectId) {
    errors.push('❌ Missing project_id in google-services.json');
  } else {
    console.log(`   ✅ Firebase Project ID: ${projectId}`);
  }
  
  if (!packageName) {
    errors.push('❌ Missing package_name in google-services.json');
  } else {
    console.log(`   ✅ Package Name: ${packageName}`);
  }
  
  // Cross-validate with app.json
  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
  const appJsonPackage = appJson.expo?.android?.package;
  const appJsonFirebaseId = appJson.expo?.extra?.firebase?.projectId;
  
  if (packageName !== appJsonPackage) {
    errors.push(`❌ Package name mismatch: app.json has "${appJsonPackage}" but google-services.json has "${packageName}"`);
  }
  
  if (projectId !== appJsonFirebaseId) {
    errors.push(`❌ Firebase project ID mismatch: app.json has "${appJsonFirebaseId}" but google-services.json has "${projectId}"`);
  }
  
} catch (error) {
  errors.push(`❌ Cannot read google-services.json: ${error.message}`);
}

// 3. Check Android build configuration
console.log('\n🤖 Checking Android build.gradle...');
try {
  const buildGradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');
  const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
  
  if (!buildGradle.includes('com.google.gms.google-services')) {
    errors.push('❌ Missing Google Services plugin in android/app/build.gradle');
  } else {
    console.log('   ✅ Google Services plugin applied');
  }
  
  const applicationIdMatch = buildGradle.match(/applicationId\s+['"]([^'"]+)['"]/);
  if (applicationIdMatch) {
    console.log(`   ✅ Application ID: ${applicationIdMatch[1]}`);
  } else {
    warnings.push('⚠️  Could not find applicationId in build.gradle');
  }
  
} catch (error) {
  errors.push(`❌ Cannot read android/app/build.gradle: ${error.message}`);
}

// 4. Check Java/Kotlin files
console.log('\n☕ Checking Android source files...');
try {
  const javaDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'java');
  
  // Check if package structure exists
  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
  const expectedPackage = appJson.expo?.android?.package;
  
  if (expectedPackage) {
    const packagePath = expectedPackage.replace(/\./g, path.sep);
    const fullPackagePath = path.join(javaDir, packagePath);
    
    if (fs.existsSync(fullPackagePath)) {
      console.log(`   ✅ Package directory exists: ${packagePath}`);
      
      const mainAppPath = path.join(fullPackagePath, 'MainApplication.kt');
      if (fs.existsSync(mainAppPath)) {
        const mainApp = fs.readFileSync(mainAppPath, 'utf8');
        if (mainApp.includes('FirebaseApp.initializeApp')) {
          console.log('   ✅ Firebase initialization found in MainApplication.kt');
        } else {
          warnings.push('⚠️  Firebase.initializeApp not found in MainApplication.kt');
        }
      }
    } else {
      errors.push(`❌ Package directory not found: ${fullPackagePath}`);
    }
  }
  
} catch (error) {
  warnings.push(`⚠️  Could not validate Android source files: ${error.message}`);
}

// 5. Check AndroidManifest.xml
console.log('\n📋 Checking AndroidManifest.xml...');
try {
  const manifestPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  
  if (manifest.includes('android.permission.POST_NOTIFICATIONS')) {
    console.log('   ✅ POST_NOTIFICATIONS permission found');
  } else {
    errors.push('❌ Missing POST_NOTIFICATIONS permission in AndroidManifest.xml');
  }
  
} catch (error) {
  errors.push(`❌ Cannot read AndroidManifest.xml: ${error.message}`);
}

// Summary
console.log('\n📊 Validation Summary:');
console.log('='.repeat(50));

if (errors.length === 0 && warnings.length === 0) {
  console.log('🎉 ALL CONFIGURATIONS ARE VALID!');
  console.log('✅ Your app should work perfectly with push notifications');
} else {
  if (errors.length > 0) {
    console.log('\n❌ ERRORS (must fix):');
    errors.forEach(error => console.log(`   ${error}`));
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (should fix):');
    warnings.forEach(warning => console.log(`   ${warning}`));
  }
  
  console.log('\n🔧 NEXT STEPS:');
  console.log('1. Fix all errors above');
  console.log('2. Clean and rebuild: cd android && ./gradlew clean');
  console.log('3. Run: npx expo run:android');
}

console.log('\n📚 Useful commands:');
console.log('• Test config: node validate-config.js');
console.log('• Clean build: cd android && ./gradlew clean');
console.log('• Rebuild app: npx expo run:android');
console.log('• View logs: npx expo logs --platform android');

process.exit(errors.length > 0 ? 1 : 0);