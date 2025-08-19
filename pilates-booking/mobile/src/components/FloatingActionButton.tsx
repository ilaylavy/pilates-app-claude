import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';

interface FloatingActionButtonProps {
  onAddClass?: () => void;
  onBatchOperations?: () => void;
  onCopyClass?: () => void;
  onCreateRecurring?: () => void;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onAddClass,
  onBatchOperations,
  onCopyClass,
  onCreateRecurring,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [rotation] = useState(new Animated.Value(0));

  const toggleExpanded = () => {
    const toValue = expanded ? 0 : 1;
    
    Animated.spring(rotation, {
      toValue,
      useNativeDriver: true,
    }).start();
    
    setExpanded(!expanded);
  };

  const rotateStyle = {
    transform: [
      {
        rotate: rotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '45deg'],
        }),
      },
    ],
  };

  const actions = [
    {
      icon: 'add-circle',
      label: 'Add Class',
      onPress: () => {
        setExpanded(false);
        onAddClass?.();
      },
    },
    {
      icon: 'copy',
      label: 'Copy Class',
      onPress: () => {
        setExpanded(false);
        onCopyClass?.();
      },
    },
    {
      icon: 'repeat',
      label: 'Recurring Class',
      onPress: () => {
        setExpanded(false);
        onCreateRecurring?.();
      },
    },
    {
      icon: 'checkmark-done',
      label: 'Batch Operations',
      onPress: () => {
        setExpanded(false);
        onBatchOperations?.();
      },
    },
  ];

  return (
    <>
      <View style={styles.container}>
        {expanded && (
          <View style={styles.actionsContainer}>
            {actions.map((action, index) => (
              <View key={action.label} style={styles.actionItem}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={action.onPress}
                >
                  <Ionicons name={action.icon as any} size={20} color={COLORS.white} />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </View>
            ))}
          </View>
        )}
        
        <TouchableOpacity
          style={styles.fab}
          onPress={toggleExpanded}
          activeOpacity={0.8}
        >
          <Animated.View style={rotateStyle}>
            <Ionicons name="add" size={28} color={COLORS.white} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Backdrop */}
      {expanded && (
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setExpanded(false)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
    alignItems: 'center',
  },
  actionsContainer: {
    marginBottom: SPACING.md,
    alignItems: 'flex-end',
    gap: SPACING.md,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  actionLabel: {
    backgroundColor: COLORS.text,
    color: COLORS.white,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
});

export default FloatingActionButton;