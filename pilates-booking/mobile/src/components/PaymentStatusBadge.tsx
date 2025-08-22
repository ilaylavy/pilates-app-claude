import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../utils/config';
import { PaymentStatusType } from '../types';

interface Props {
  status: PaymentStatusType;
  size?: 'small' | 'medium' | 'large';
  showIcon?: boolean;
}

const PaymentStatusBadge: React.FC<Props> = ({ 
  status, 
  size = 'medium', 
  showIcon = true 
}) => {
  const getStatusConfig = (status: PaymentStatusType) => {
    switch (status) {
      case 'pending_approval':
        return {
          label: 'Pending Payment',
          color: COLORS.warning,
          backgroundColor: COLORS.warning + '15',
          icon: '⏳',
        };
      case 'approved':
        return {
          label: 'Active',
          color: COLORS.success,
          backgroundColor: COLORS.success + '15',
          icon: '✅',
        };
      case 'rejected':
        return {
          label: 'Payment Rejected',
          color: COLORS.error,
          backgroundColor: COLORS.error + '15',
          icon: '❌',
        };
      default:
        return {
          label: 'Unknown',
          color: COLORS.textSecondary,
          backgroundColor: COLORS.border + '15',
          icon: '❓',
        };
    }
  };

  const getSizeStyles = (size: 'small' | 'medium' | 'large') => {
    switch (size) {
      case 'small':
        return {
          container: styles.containerSmall,
          text: styles.textSmall,
          icon: styles.iconSmall,
        };
      case 'large':
        return {
          container: styles.containerLarge,
          text: styles.textLarge,
          icon: styles.iconLarge,
        };
      default:
        return {
          container: styles.containerMedium,
          text: styles.textMedium,
          icon: styles.iconMedium,
        };
    }
  };

  const config = getStatusConfig(status);
  const sizeStyles = getSizeStyles(size);

  return (
    <View
      style={[
        styles.container,
        sizeStyles.container,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.color + '40',
        },
      ]}
    >
      {showIcon && (
        <Text style={[sizeStyles.icon]}>
          {config.icon}
        </Text>
      )}
      <Text
        style={[
          styles.text,
          sizeStyles.text,
          { color: config.color },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  
  // Size variants - container
  containerSmall: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs / 2,
    borderRadius: 8,
  },
  containerMedium: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 10,
  },
  containerLarge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
  },
  
  // Size variants - text
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  textSmall: {
    fontSize: 10,
  },
  textMedium: {
    fontSize: 12,
  },
  textLarge: {
    fontSize: 14,
  },
  
  // Size variants - icon
  iconSmall: {
    fontSize: 10,
    marginRight: SPACING.xs / 2,
  },
  iconMedium: {
    fontSize: 12,
    marginRight: SPACING.xs,
  },
  iconLarge: {
    fontSize: 14,
    marginRight: SPACING.sm,
  },
});

export default PaymentStatusBadge;