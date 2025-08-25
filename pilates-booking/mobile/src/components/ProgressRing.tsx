import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Svg, Circle } from 'react-native-svg';
import { COLORS } from '../utils/config';

interface ProgressRingProps {
  size?: number;
  strokeWidth?: number;
  progress: number; // 0-1
  color?: string;
  backgroundColor?: string;
  children?: React.ReactNode;
  label?: string;
  value?: string;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
  size = 80,
  strokeWidth = 8,
  progress,
  color = COLORS.primary,
  backgroundColor = COLORS.surface,
  children,
  label,
  value,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress * circumference);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.content}>
        {children || (
          <View style={styles.defaultContent}>
            {value && <Text style={[styles.value, { color }]}>{value}</Text>}
            {label && <Text style={styles.label}>{label}</Text>}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  content: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultContent: {
    alignItems: 'center',
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default ProgressRing;