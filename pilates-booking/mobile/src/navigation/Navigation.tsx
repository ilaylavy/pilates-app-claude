import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../hooks/useAuth';
import { useUserRole } from '../hooks/useUserRole';
import { useTranslation } from '../hooks/useTranslation';
import { StyleUtils } from '../utils/styleUtils';
import { COLORS } from '../utils/config';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Main app screens
import HomeScreen from '../screens/HomeScreen';
import ScheduleScreen from '../screens/ScheduleScreen'; // Unified schedule
import BookingsScreen from '../screens/BookingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PackagesScreen from '../screens/PackagesScreen';
import PackageNavigator from './PackageNavigator';
import SettingsScreen from '../screens/SettingsScreen';
import PaymentScreen from '../screens/PaymentScreen';
import PaymentHistoryScreen from '../screens/PaymentHistoryScreen';
import PurchaseConfirmationScreen from '../screens/PurchaseConfirmationScreen';
import PackageHistoryScreen from '../screens/packages/PackageHistoryScreen';

// Admin screens
import UserManagementScreen from '../screens/UserManagementScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SystemSettingsScreen from '../screens/SystemSettingsScreen';
import AdminPackagesScreen from '../screens/AdminPackagesScreen';
// Removed: AddClassScreen, EditClassScreen, TemplateManagementScreen, BulkOperationsScreen
// These are now integrated into the unified ScheduleScreen

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Packages: undefined;
  Settings: undefined;
  BookingHistory: undefined;
  AdminPackages: undefined;
  UserManagement: undefined;
  PackageManagement: undefined;
  Reports: undefined;
  SystemSettings: undefined;
  PackageHistory: undefined;
  // Removed: AddClass, EditClass, TemplateManagement, BulkOperations - integrated into Schedule
  Payment: { 
    packageId: number; 
    packageName: string; 
    price: number; 
    currency: string; 
  };
  PaymentHistory: undefined;
  PurchaseConfirmation: {
    paymentMethod: string;
    packageName: string;
    price: string;
    currency: string;
    paymentId?: number;
    reservationId?: string;
    credits?: number;
    expiryDate?: string;
  };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Schedule: undefined;
  Packages?: undefined; // For students - new enhanced packages hub
  Profile: undefined;
  Users?: undefined; // Only for admin/instructor
  AdminPackages?: undefined; // Only for admin - unified packages and approvals
  Reports?: undefined; // Only for admin
};

const RootStack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

const AuthNavigator = () => {
  
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animationTypeForReplace: 'push',
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
};

const MainNavigator = () => {
  const { isAdmin, isInstructor, isStudent } = useUserRole();
  const { t, rtlText, rtlRow } = useTranslation();

  const getIconName = (routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
    const iconMap: Record<string, [string, string]> = {
      'Home': ['home', 'home-outline'],
      'Schedule': ['calendar', 'calendar-outline'],
      'Profile': ['person', 'person-outline'],
      'Users': ['people', 'people-outline'],
      'Packages': ['storefront', 'storefront-outline'],
      'AdminPackages': ['construct', 'construct-outline'], // Changed to construction/admin icon
      'Reports': ['analytics', 'analytics-outline'],
    };

    const [focusedIcon, unfocusedIcon] = iconMap[routeName] || ['help-outline', 'help-outline'];
    return (focused ? focusedIcon : unfocusedIcon) as keyof typeof Ionicons.glyphMap;
  };

  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const iconName = getIconName(route.name, focused);
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        headerShown: false,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          ...StyleUtils.flexDirection('row'),
        },
      })}
    >
      {/* Home screen for all users */}
      <MainTab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={() => ({ title: t('navigation.home') })}
      />

      {/* Role-specific screens */}
      {isStudent && (
        <>
          <MainTab.Screen 
            name="Schedule" 
            component={ScheduleScreen}
            options={() => ({ title: t('navigation.schedule') })}
          />
          <MainTab.Screen 
            name="Packages" 
            component={PackageNavigator}
            options={() => ({ title: t('navigation.packages') })}
          />
        </>
      )}

      {/* Instructor screens */}
      {isInstructor && (
        <>
          <MainTab.Screen 
            name="Schedule" 
            component={ScheduleScreen} 
            options={() => ({ title: t('instructor.myClasses') })} 
          />
          <MainTab.Screen 
            name="Users" 
            component={UserManagementScreen} 
            options={() => ({ title: t('instructor.students') })} 
          />
        </>
      )}

      {/* Admin screens */}
      {isAdmin && (
        <>
          <MainTab.Screen 
            name="Schedule" 
            component={ScheduleScreen} 
            options={() => ({ title: t('navigation.schedule') })} 
          />
          <MainTab.Screen 
            name="Users" 
            component={UserManagementScreen} 
            options={() => ({ title: t('admin.users') })} 
          />
          <MainTab.Screen 
            name="AdminPackages" 
            component={AdminPackagesScreen} 
            options={() => ({ title: t('navigation.admin') })} 
          />
          <MainTab.Screen 
            name="Reports" 
            component={ReportsScreen}
            options={() => ({ title: t('admin.reports') })}
          />
        </>
      )}

      {/* Profile is common for all roles */}
      <MainTab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={() => ({ title: t('navigation.profile') })}
      />
    </MainTab.Navigator>
  );
};

const Navigation = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    // TODO: Add loading screen
    return null;
  }

  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        headerTitleAlign: 'center',
        animationTypeForReplace: 'push',
      }}
    >
      {isAuthenticated ? (
        <>
          <RootStack.Screen name="Main" component={MainNavigator} />
          <RootStack.Screen 
            name="Packages" 
            component={PackagesScreen}
            options={{ 
              headerShown: true, 
              title: t('navigation.packages'),
              headerTitleAlign: 'center',
            }}
          />
          <RootStack.Screen 
            name="UserManagement" 
            component={UserManagementScreen}
            options={{ 
              headerShown: true, 
              title: t('admin.userManagement'),
              headerTitleAlign: 'center',
            }}
          />
          <RootStack.Screen 
            name="PackageManagement" 
            component={AdminPackagesScreen}
            options={{ 
              headerShown: true, 
              title: t('admin.packageManagement'),
              headerTitleAlign: 'center',
            }}
          />
          <RootStack.Screen 
            name="Reports" 
            component={ReportsScreen}
            options={{ 
              headerShown: true, 
              title: t('admin.reports'),
              headerTitleAlign: 'center',
            }}
          />
          <RootStack.Screen 
            name="SystemSettings" 
            component={SystemSettingsScreen}
            options={{ 
              headerShown: true, 
              title: t('admin.settings'),
              headerTitleAlign: 'center',
            }}
          />
          <RootStack.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{ 
              headerShown: true, 
              title: t('navigation.settings'),
              headerTitleAlign: 'center',
            }}
          />
          <RootStack.Screen 
            name="BookingHistory" 
            component={BookingsScreen}
            options={{ 
              headerShown: true, 
              title: t('bookings.title'),
              headerTitleAlign: 'center',
            }}
          />
          <RootStack.Screen 
            name="AdminPackages" 
            component={AdminPackagesScreen}
            options={{ 
              headerShown: true, 
              title: t('admin.packages'),
              headerTitleAlign: 'center',
            }}
          />
          <RootStack.Screen 
            name="Payment" 
            component={PaymentScreen}
            options={{ 
              headerShown: true, 
              title: t('payments.title'),
              headerTitleAlign: 'center',
            }}
          />
          <RootStack.Screen 
            name="PaymentHistory" 
            component={PaymentHistoryScreen}
            options={{ 
              headerShown: true, 
              title: t('profile.paymentHistory'),
              headerTitleAlign: 'center',
            }}
          />
          <RootStack.Screen 
            name="PackageHistory" 
            component={PackageHistoryScreen}
            options={{ 
              headerShown: true, 
              title: t('packages.title'),
              headerTitleAlign: 'center',
            }}
          />
          <RootStack.Screen 
            name="PurchaseConfirmation" 
            component={PurchaseConfirmationScreen}
            options={{ 
              headerShown: true, 
              title: t('payments.paymentSuccessful'),
              headerTitleAlign: 'center',
            }}
          />
          {/* Removed old class management screens - now integrated into Schedule tab */}
        </>
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
};

export default Navigation;