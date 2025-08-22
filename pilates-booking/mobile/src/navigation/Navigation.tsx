import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../hooks/useAuth';
import { useUserRole } from '../hooks/useUserRole';
import { COLORS } from '../utils/config';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Main app screens
import HomeScreen from '../screens/HomeScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import BookingsScreen from '../screens/BookingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PackagesScreen from '../screens/PackagesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PaymentScreen from '../screens/PaymentScreen';
import PaymentHistoryScreen from '../screens/PaymentHistoryScreen';
import PurchaseConfirmationScreen from '../screens/PurchaseConfirmationScreen';

// Admin screens
import UserManagementScreen from '../screens/UserManagementScreen';
import PackageManagementScreen from '../screens/PackageManagementScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SystemSettingsScreen from '../screens/SystemSettingsScreen';
import AdminApprovalScreen from '../screens/AdminApprovalScreen';
import AddClassScreen from '../screens/AddClassScreen';
import EditClassScreen from '../screens/EditClassScreen';
import TemplateManagementScreen from '../screens/TemplateManagementScreen';
import BulkOperationsScreen from '../screens/BulkOperationsScreen';

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
  AdminApproval: undefined;
  AddClass: undefined;
  EditClass: { classInstance: any };
  TemplateManagement: undefined;
  BulkOperations: undefined;
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
  Bookings: undefined;
  Profile: undefined;
  Users?: undefined; // Only for admin/instructor
  Packages?: undefined; // Only for admin
  Reports?: undefined; // Only for admin
  Approvals?: undefined; // Only for admin
};

const RootStack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

const AuthNavigator = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
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

  const getIconName = (routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
    const iconMap: Record<string, [string, string]> = {
      'Home': ['home', 'home-outline'],
      'Schedule': ['calendar', 'calendar-outline'],
      'Bookings': ['list', 'list-outline'],
      'Profile': ['person', 'person-outline'],
      'Users': ['people', 'people-outline'],
      'Packages': ['cube', 'cube-outline'],
      'Reports': ['analytics', 'analytics-outline'],
      'Approvals': ['checkmark-circle', 'checkmark-circle-outline'],
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
      })}
    >
      {/* Common screens for all users */}
      {isStudent && (
        <>
          <MainTab.Screen name="Home" component={HomeScreen} />
          <MainTab.Screen name="Schedule" component={ScheduleScreen} />
          <MainTab.Screen name="Bookings" component={BookingsScreen} />
        </>
      )}

      {/* Instructor screens */}
      {isInstructor && (
        <>
          <MainTab.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'My Classes' }} />
          <MainTab.Screen name="Users" component={UserManagementScreen} options={{ title: 'Students' }} />
        </>
      )}

      {/* Admin screens */}
      {isAdmin && (
        <>
          <MainTab.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'Classes' }} />
          <MainTab.Screen name="Users" component={UserManagementScreen} options={{ title: 'Students' }} />
          <MainTab.Screen name="Packages" component={PackageManagementScreen} />
          <MainTab.Screen name="Approvals" component={AdminApprovalScreen} options={{ title: 'Approvals' }} />
          <MainTab.Screen name="Reports" component={ReportsScreen} />
        </>
      )}

      {/* Profile is common for all roles */}
      <MainTab.Screen name="Profile" component={ProfileScreen} />
    </MainTab.Navigator>
  );
};

const Navigation = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // TODO: Add loading screen
    return null;
  }

  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {isAuthenticated ? (
        <>
          <RootStack.Screen name="Main" component={MainNavigator} />
          <RootStack.Screen 
            name="Packages" 
            component={PackagesScreen}
            options={{ headerShown: true, title: 'Packages' }}
          />
          <RootStack.Screen 
            name="UserManagement" 
            component={UserManagementScreen}
            options={{ headerShown: true, title: 'User Management' }}
          />
          <RootStack.Screen 
            name="PackageManagement" 
            component={PackageManagementScreen}
            options={{ headerShown: true, title: 'Package Management' }}
          />
          <RootStack.Screen 
            name="Reports" 
            component={ReportsScreen}
            options={{ headerShown: true, title: 'Reports' }}
          />
          <RootStack.Screen 
            name="SystemSettings" 
            component={SystemSettingsScreen}
            options={{ headerShown: true, title: 'System Settings' }}
          />
          <RootStack.Screen 
            name="AdminApproval" 
            component={AdminApprovalScreen}
            options={{ headerShown: true, title: 'Cash Payment Approvals' }}
          />
          <RootStack.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{ headerShown: true, title: 'Settings' }}
          />
          <RootStack.Screen 
            name="BookingHistory" 
            component={BookingsScreen}
            options={{ headerShown: true, title: 'Booking History' }}
          />
          <RootStack.Screen 
            name="AdminPackages" 
            component={PackageManagementScreen}
            options={{ headerShown: true, title: 'Manage Packages' }}
          />
          <RootStack.Screen 
            name="Payment" 
            component={PaymentScreen}
            options={{ headerShown: true, title: 'Payment' }}
          />
          <RootStack.Screen 
            name="PaymentHistory" 
            component={PaymentHistoryScreen}
            options={{ headerShown: true, title: 'Payment History' }}
          />
          <RootStack.Screen 
            name="PurchaseConfirmation" 
            component={PurchaseConfirmationScreen}
            options={{ headerShown: true, title: 'Purchase Confirmation' }}
          />
          <RootStack.Screen 
            name="AddClass" 
            component={AddClassScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen 
            name="EditClass" 
            component={EditClassScreen}
            options={{ headerShown: false }}
          />
          <RootStack.Screen 
            name="TemplateManagement" 
            component={TemplateManagementScreen}
            options={{ headerShown: true, title: 'Class Templates' }}
          />
          <RootStack.Screen 
            name="BulkOperations" 
            component={BulkOperationsScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
};

export default Navigation;