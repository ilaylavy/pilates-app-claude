/**
 * Jest setup file for React Native tests.
 * Configures mocks, test environment, and global utilities.
 */

import 'react-native-gesture-handler/jestSetup';
// Use built-in matchers from @testing-library/react-native instead of deprecated jest-native
// See: https://callstack.github.io/react-native-testing-library/docs/migration/jest-matchers

// Mock React Native modules that don't work well in Jest
// jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');

// Mock Expo modules
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
  authenticateAsync: jest.fn(() => 
    Promise.resolve({ success: true })
  ),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => 
    Promise.resolve({ status: 'granted' })
  ),
  requestPermissionsAsync: jest.fn(() => 
    Promise.resolve({ status: 'granted' })
  ),
  scheduleNotificationAsync: jest.fn(),
  cancelNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() => 
    Promise.resolve({
      cancelled: false,
      assets: [{
        uri: 'file://test-image.jpg',
        width: 100,
        height: 100,
      }]
    })
  ),
  MediaTypeOptions: {
    Images: 'Images',
  },
  ImagePickerResult: {},
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-1234'),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
    setOptions: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
    key: 'test-route',
    name: 'TestScreen',
  }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: jest.fn(),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: jest.fn(),
}));

// Mock Stripe
jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: () => ({
    initPaymentSheet: jest.fn(() => Promise.resolve({ error: null })),
    presentPaymentSheet: jest.fn(() => Promise.resolve({ error: null })),
    confirmPayment: jest.fn(() => Promise.resolve({ error: null, paymentIntent: { status: 'succeeded' } })),
  }),
  StripeProvider: ({ children }: any) => children,
  CardField: 'CardField',
}));

// Mock React Native Calendars
jest.mock('react-native-calendars', () => ({
  Calendar: 'Calendar',
  CalendarList: 'CalendarList',
  Agenda: 'Agenda',
}));

// Mock Gesture Handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: View,
    gestureHandlerRootHOC: (component: any) => component,
    Directions: {},
  };
});

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock Vector Icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
  MaterialIcons: 'MaterialIcons',
  AntDesign: 'AntDesign',
  FontAwesome: 'FontAwesome',
  Feather: 'Feather',
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Global test utilities
global.__TEST__ = true;

// Silence console warnings in tests
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  if (
    args[0]?.includes?.('Warning: ReactDOM.render') ||
    args[0]?.includes?.('Warning: React.createElement') ||
    args[0]?.includes?.('componentWillReceiveProps') ||
    args[0]?.includes?.('"deprecated"')
  ) {
    return;
  }
  originalWarn.call(console, ...args);
};

// Increase test timeout for async operations
jest.setTimeout(10000);