import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';
import { UserPackage } from '../types';

interface Props {
  userPackage: UserPackage;
  onRefresh?: () => void;
}

const SimplePendingCard: React.FC<Props> = ({
  userPackage,
  onRefresh,
}) => {
  const getTimeRemaining = () => {
    if (!userPackage.reservation_expires_at) return null;
    
    const expiryTime = new Date(userPackage.reservation_expires_at);
    const now = new Date();
    const timeLeft = expiryTime.getTime() - now.getTime();
    
    if (timeLeft <= 0) return 'Expired';
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d left`;
    } else if (hours > 0) {
      return `${hours}h left`;
    } else {
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      return `${minutes}m left`;
    }
  };

  const isUrgent = () => {
    if (!userPackage.reservation_expires_at) return false;
    const expiryTime = new Date(userPackage.reservation_expires_at);
    const now = new Date();
    const hoursLeft = (expiryTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursLeft <= 6;
  };

  const getStatusInfo = () => {
    const baseInfo = {
      icon: 'time-outline' as const,
      color: COLORS.warning,
      text: 'Payment Pending'
    };

    switch (userPackage.payment_status) {
      case 'authorized':
        return {
          icon: 'checkmark-circle-outline' as const,
          color: COLORS.success,
          text: 'Ready to Use'
        };
      case 'pending_approval':
      case 'pending':
      default:
        return baseInfo;
    }
  };

  const timeRemaining = getTimeRemaining();
  const urgent = isUrgent();
  const statusInfo = getStatusInfo();

  return (
    <View style={[
      styles.container,
      urgent && styles.urgentContainer
    ]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.packageName}>{userPackage.package.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '15' }]}>
            <Ionicons name={statusInfo.icon} size={14} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          </View>
        </View>
        
        <View style={styles.details}>
          <Text style={styles.creditsText}>
            {userPackage.package.credits} credits • ₪{userPackage.package.price}
          </Text>
          {timeRemaining && (
            <Text style={[
              styles.timeText,
              urgent && { color: COLORS.error, fontWeight: '600' }
            ]}>
              {timeRemaining}
            </Text>
          )}
        </View>

        {userPackage.payment_reference && (
          <View style={styles.referenceRow}>
            <Text style={styles.referenceLabel}>Ref:</Text>
            <Text style={styles.referenceCode}>{userPackage.payment_reference}</Text>
          </View>
        )}
      </View>

      {onRefresh && (
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <Ionicons name="refresh" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgentContainer: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error + '05',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs / 2,
    borderRadius: 8,
    gap: SPACING.xs / 2,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  creditsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  timeText: {
    fontSize: 14,
    color: COLORS.warning,
    fontWeight: '500',
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  referenceLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  referenceCode: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  refreshButton: {
    width: 36,
    height: 36,
    backgroundColor: COLORS.primary + '15',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
});

export default SimplePendingCard;