import React, { useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING } from '../utils/config';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const animatedValue = new Animated.Value(0);

  useEffect(() => {
    const startAnimation = () => {
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => startAnimation());
    };
    
    startAnimation();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

const ClassCardSkeleton: React.FC = () => {
  return (
    <View style={styles.cardSkeleton}>
      <View style={styles.cardHeader}>
        <SkeletonLoader width="70%" height={20} />
        <SkeletonLoader width={60} height={18} borderRadius={10} />
      </View>
      
      <SkeletonLoader width="50%" height={16} style={{ marginTop: SPACING.xs }} />
      
      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <SkeletonLoader width={16} height={16} borderRadius={8} />
          <SkeletonLoader width="60%" height={14} />
        </View>
        <View style={styles.detailRow}>
          <SkeletonLoader width={16} height={16} borderRadius={8} />
          <SkeletonLoader width="40%" height={14} />
        </View>
        <View style={styles.detailRow}>
          <SkeletonLoader width={16} height={16} borderRadius={8} />
          <SkeletonLoader width="35%" height={14} />
        </View>
      </View>
      
      <SkeletonLoader width="100%" height={40} style={{ marginTop: SPACING.md }} />
      
      <View style={styles.actionsRow}>
        <SkeletonLoader width={80} height={32} borderRadius={6} />
        <SkeletonLoader width={60} height={32} borderRadius={6} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: COLORS.lightGray,
  },
  cardSkeleton: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardDetails: {
    gap: SPACING.xs,
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
});

export default SkeletonLoader;
export { ClassCardSkeleton };