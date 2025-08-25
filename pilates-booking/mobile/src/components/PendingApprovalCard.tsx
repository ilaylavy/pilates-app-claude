import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { COLORS, SPACING } from '../utils/config';
import { UserPackage } from '../types';
import PaymentStatusBadge from './PaymentStatusBadge';

interface Props {
  userPackage: UserPackage;
  onShowInstructions?: () => void;
  onRefresh?: () => void;
}

const PendingApprovalCard: React.FC<Props> = ({
  userPackage,
  onShowInstructions,
  onRefresh,
}) => {
  const isExpiringSoon = () => {
    if (!userPackage.reservation_expires_at) return false;
    const expiryTime = new Date(userPackage.reservation_expires_at);
    const now = new Date();
    const hoursLeft = (expiryTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursLeft <= 6; // Less than 6 hours left
  };

  const getTimeRemaining = () => {
    if (!userPackage.reservation_expires_at) return null;
    
    const expiryTime = new Date(userPackage.reservation_expires_at);
    const now = new Date();
    const timeLeft = expiryTime.getTime() - now.getTime();
    
    if (timeLeft <= 0) return 'Expired';
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  const getStatusMessage = () => {
    switch (userPackage.payment_status) {
      case 'authorized':
        return {
          title: 'Payment Authorization Status',
          message: `Your ${userPackage.package.name} package has been authorized!\n\n` +
                  '✅ You can start using your credits immediately\n' +
                  '⏳ Payment confirmation is still pending\n' +
                  '📍 Please complete cash payment at reception\n\n' +
                  'Your package will be fully confirmed once payment is received.',
          canUseCredits: true
        };
      case 'pending_approval':
      default:
        return {
          title: 'Cash Payment Process',
          message: `To activate your ${userPackage.package.name} package:\n\n` +
                  '1. Visit the studio reception\n' +
                  '2. Make the cash payment\n' +
                  '3. Show your reference code to staff\n' +
                  '4. Your package will be activated within 2 hours\n\n' +
                  'Note: You cannot book classes until payment is confirmed.',
          canUseCredits: false
        };
    }
  };

  const handleShowInfo = () => {
    const statusInfo = getStatusMessage();
    Alert.alert(
      statusInfo.title,
      statusInfo.message,
      [
        { text: 'Show Instructions', onPress: onShowInstructions },
        { text: 'OK', style: 'default' },
      ]
    );
  };

  const timeRemaining = getTimeRemaining();
  const expiringSoon = isExpiringSoon();

  return (
    <View style={[
      styles.container, 
      expiringSoon && styles.urgentContainer,
      userPackage.payment_status === 'authorized' && styles.authorizedContainer
    ]}>
      <View style={styles.header}>
        <View style={styles.packageInfo}>
          <Text style={styles.packageName}>{userPackage.package.name}</Text>
          <Text style={styles.creditsText}>
            {userPackage.credits_remaining} credits • ₪{userPackage.package.price}
          </Text>
        </View>
        <PaymentStatusBadge 
          status={userPackage.payment_status || 'pending_approval'} 
          size="small"
        />
      </View>

      <View style={styles.statusSection}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Payment Method:</Text>
          <Text style={styles.statusValue}>Cash at Reception</Text>
        </View>
        
        {timeRemaining && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Time to Pay:</Text>
            <Text style={[
              styles.statusValue,
              expiringSoon && styles.urgentText
            ]}>
              {timeRemaining}
            </Text>
          </View>
        )}

        {userPackage.payment_reference && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Reference:</Text>
            <Text style={styles.referenceCode}>{userPackage.payment_reference}</Text>
          </View>
        )}

        {userPackage.payment_status === 'authorized' && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Credits Status:</Text>
            <Text style={styles.creditsActiveText}>✅ Ready to Use</Text>
          </View>
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.infoButton}
          onPress={handleShowInfo}
        >
          <Text style={styles.infoButtonText}>Payment Info</Text>
        </TouchableOpacity>
        
        {onRefresh && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
          >
            <Text style={styles.refreshButtonText}>Check Status</Text>
          </TouchableOpacity>
        )}
      </View>

      {expiringSoon && (
        <View style={styles.urgentNotice}>
          <Text style={styles.urgentNoticeText}>
            ⚠️ Payment deadline approaching! Please pay at reception soon to avoid losing your reservation.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  urgentContainer: {
    borderColor: COLORS.warning,
    backgroundColor: COLORS.warning + '05',
  },
  authorizedContainer: {
    borderColor: '#ff9500',
    backgroundColor: '#ff9500' + '08',
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  packageInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  creditsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statusSection: {
    marginBottom: SPACING.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  statusLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  statusValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    textAlign: 'right',
  },
  urgentText: {
    color: COLORS.warning,
    fontWeight: '600',
  },
  referenceCode: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  infoButton: {
    flex: 1,
    backgroundColor: COLORS.primary + '15',
    borderRadius: 8,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  infoButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  refreshButton: {
    flex: 1,
    backgroundColor: COLORS.secondary + '15',
    borderRadius: 8,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  urgentNotice: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.warning + '15',
    borderRadius: 8,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
  },
  urgentNoticeText: {
    fontSize: 12,
    color: COLORS.warning,
    textAlign: 'center',
    lineHeight: 16,
  },
  creditsActiveText: {
    fontSize: 14,
    color: '#28a745', // Green color for active credits
    fontWeight: '600',
    textAlign: 'right',
  },
});

export default PendingApprovalCard;