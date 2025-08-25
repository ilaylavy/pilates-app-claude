import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';

interface StreakCounterProps {
  weekStreak: number;
  isActive?: boolean;
}

const StreakCounter: React.FC<StreakCounterProps> = ({ weekStreak, isActive = false }) => {
  const getStreakColor = () => {
    if (weekStreak === 0) return COLORS.textSecondary;
    if (weekStreak >= 4) return COLORS.success;
    if (weekStreak >= 2) return COLORS.primary;
    return COLORS.warning;
  };

  const getStreakMessage = () => {
    if (weekStreak === 0) return 'Start your streak!';
    if (weekStreak === 1) return 'Keep it up!';
    if (weekStreak >= 8) return 'Amazing streak!';
    if (weekStreak >= 4) return 'Great consistency!';
    return 'Building momentum!';
  };

  return (
    <View style={[styles.container, isActive && styles.activeContainer]}>
      <View style={styles.header}>
        <Ionicons 
          name={weekStreak > 0 ? 'flame' : 'flame-outline'} 
          size={24} 
          color={getStreakColor()} 
        />
        <Text style={[styles.streakNumber, { color: getStreakColor() }]}>
          {weekStreak}
        </Text>
      </View>
      <Text style={styles.streakLabel}>
        Week{weekStreak !== 1 ? 's' : ''} in a row
      </Text>
      <Text style={styles.streakMessage}>
        {getStreakMessage()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: SPACING.xs,
  },
  activeContainer: {
    borderWidth: 2,
    borderColor: COLORS.primary + '30',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  streakNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: SPACING.xs,
  },
  streakLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  streakMessage: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default StreakCounter;