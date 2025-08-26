import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../utils/config';

// Import the packages screen
import PackagesScreen from '../screens/PackagesScreen';

const PackageNavigator: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenContainer}>
        <PackagesScreen />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenContainer: {
    flex: 1,
  },
});

export default PackageNavigator;