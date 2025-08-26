import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';
import { NotificationStorage, generateMessageId } from '../utils/notificationStorage';
import { DismissibleMessageProps } from '../types';

const DismissibleMessage: React.FC<DismissibleMessageProps> = ({
  id,
  type = 'info',
  title,
  message,
  icon,
  onDismiss,
  autoHide = false,
  autoHideDelay = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if message is already dismissed
    const checkDismissed = async () => {
      const isDismissed = await NotificationStorage.isMessageDismissed(id);
      if (isDismissed) {
        setIsVisible(false);
        setDismissed(true);
        return;
      }
      
      // Animate in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    };

    checkDismissed();
  }, [id, fadeAnim]);

  useEffect(() => {
    if (autoHide && isVisible && !dismissed) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay, isVisible, dismissed]);

  const handleDismiss = async () => {
    if (dismissed) return;

    // Add to notifications before dismissing
    await NotificationStorage.addNotification({
      type: type === 'success' ? 'package_activation' : 'general',
      title,
      message,
    });

    // Mark as dismissed
    await NotificationStorage.dismissMessage(id);
    setDismissed(true);

    // Animate out
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      onDismiss?.();
    });
  };

  if (!isVisible || dismissed) {
    return null;
  }

  const getBannerStyle = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: COLORS.success + '15',
          borderColor: COLORS.success + '30',
        };
      case 'warning':
        return {
          backgroundColor: COLORS.warning + '15',
          borderColor: COLORS.warning + '30',
        };
      case 'error':
        return {
          backgroundColor: COLORS.error + '15',
          borderColor: COLORS.error + '30',
        };
      default:
        return {
          backgroundColor: COLORS.primary + '15',
          borderColor: COLORS.primary + '30',
        };
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return COLORS.success;
      case 'warning':
        return COLORS.warning;
      case 'error':
        return COLORS.error;
      default:
        return COLORS.primary;
    }
  };

  const getDefaultIcon = () => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'warning':
        return 'warning';
      case 'error':
        return 'close-circle';
      default:
        return 'information-circle';
    }
  };

  const bannerStyle = getBannerStyle();
  const iconColor = getIconColor();
  const displayIcon = icon || getDefaultIcon();

  return (
    <Animated.View
      style={[
        styles.banner,
        bannerStyle,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={displayIcon as any} size={24} color={iconColor} />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      
      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.dismissButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: COLORS.text,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  content: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  dismissButton: {
    padding: SPACING.xs,
  },
});

export default DismissibleMessage;