import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';
import { packagesApi } from '../api/packages';
import { PaymentMethodType, CashPaymentInstructions } from '../types';
import PaymentMethodSelector from './PaymentMethodSelector';
import CashPaymentInstructionsModal from './CashPaymentInstructions';
import Button from './common/Button';

interface Package {
  id: number;
  name: string;
  description?: string;
  credits: number;
  price: number;
  validity_days: number;
  is_active: boolean;
  is_unlimited: boolean;
  is_featured: boolean;
}

interface PurchaseModalProps {
  visible: boolean;
  package: Package;
  onClose: () => void;
  onPurchase: () => void;
  onNavigateToPayment?: (packageData: { packageId: number; packageName: string; price: number; currency: string }) => void;
}

const PurchaseModal: React.FC<PurchaseModalProps> = ({
  visible,
  package: pkg,
  onClose,
  onPurchase,
  onNavigateToPayment,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('CREDIT_CARD');
  const [showCashInstructions, setShowCashInstructions] = useState(false);
  const [cashInstructions, setCashInstructions] = useState<CashPaymentInstructions | null>(null);
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);

  const formatCurrency = (amount: number) => {
    const numAmount = Number(amount) || 0;
    return `₪${numAmount.toFixed(2)}`;
  };

  const formatValidityDays = (days: number) => {
    if (days >= 365) {
      const years = Math.floor(days / 365);
      return `${years} year${years !== 1 ? 's' : ''}`;
    }
    if (days >= 30) {
      const months = Math.floor(days / 30);
      return `${months} month${months !== 1 ? 's' : ''}`;
    }
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  const getExpiryDate = () => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + pkg.validity_days);
    return expiry.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handlePurchase = async () => {
    if (paymentMethod === 'credit_card') {
      // Navigate to payment screen for card payments
      if (onNavigateToPayment) {
        onNavigateToPayment({
          packageId: pkg.id,
          packageName: pkg.name,
          price: pkg.price,
          currency: 'ils'
        });
        onClose();
      }
      return;
    }

    // Handle cash payment
    if (paymentMethod === 'CASH') {
      setIsLoading(true);
      try {
        const result = await packagesApi.purchasePackage(pkg.id, 'CASH');
        
        // Check if it's cash payment instructions
        if ('reference_code' in result) {
          setCashInstructions(result);
          setShowCashInstructions(true);
          onPurchase(); // Notify parent that purchase was initiated
        } else {
          // Unexpected response format
          Alert.alert('Error', 'Unexpected response from server. Please try again.');
        }
      } catch (error: any) {
        console.error('Cash purchase error:', error);
        Alert.alert(
          'Purchase Failed',
          error.response?.data?.detail || 'Failed to create cash payment reservation. Please try again.'
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    onClose();
  };

  const handleCashInstructionsClose = () => {
    setShowCashInstructions(false);
    setCashInstructions(null);
    onClose(); // Close the main modal too
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Purchase Package</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Package Details */}
          <View style={styles.packageCard}>
            <View style={styles.packageHeader}>
              <View style={styles.packageIconContainer}>
                <Ionicons
                  name={pkg.is_unlimited ? 'infinite' : 'fitness'}
                  size={32}
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.packageInfo}>
                <Text style={styles.packageName}>{pkg.name}</Text>
                {pkg.is_featured && (
                  <View style={styles.featuredBadge}>
                    <Text style={styles.featuredText}>BEST VALUE</Text>
                  </View>
                )}
              </View>
              <Text style={styles.packagePrice}>{formatCurrency(pkg.price)}</Text>
            </View>

            {pkg.description && (
              <Text style={styles.packageDescription}>{pkg.description}</Text>
            )}

            <View style={styles.packageDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="ticket" size={16} color={COLORS.textSecondary} />
                <Text style={styles.detailText}>
                  {pkg.is_unlimited ? 'Unlimited classes' : `${pkg.credits} credits`}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={16} color={COLORS.textSecondary} />
                <Text style={styles.detailText}>
                  Valid for {formatValidityDays(pkg.validity_days)}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="time" size={16} color={COLORS.textSecondary} />
                <Text style={styles.detailText}>Expires on {getExpiryDate()}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="calculator" size={16} color={COLORS.success} />
                <Text style={[styles.detailText, styles.valueText]}>
                  {pkg.is_unlimited
                    ? `₪${(Number(pkg.price) / 30).toFixed(2)} per day`
                    : `₪${(Number(pkg.price) / Number(pkg.credits)).toFixed(2)} per class`}
                </Text>
              </View>
            </View>
          </View>

          {/* Payment Methods */}
          <PaymentMethodSelector
            selectedMethod={paymentMethod}
            onSelectMethod={setPaymentMethod}
            showInfoModal={showPaymentInfo}
            onHideInfoModal={() => setShowPaymentInfo(false)}
          />

          {/* Terms */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Terms & Conditions</Text>
            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                • Credits are non-transferable and cannot be refunded
              </Text>
              <Text style={styles.termsText}>
                • Classes must be booked at least 2 hours in advance
              </Text>
              <Text style={styles.termsText}>
                • Cancellations must be made at least 4 hours before class time
              </Text>
              <Text style={styles.termsText}>
                • Package expires on {getExpiryDate()} regardless of usage
              </Text>
              <Text style={styles.termsText}>
                • Studio reserves the right to modify class schedules
              </Text>
            </View>
          </View>

          {/* Purchase Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Purchase Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Package</Text>
              <Text style={styles.summaryValue}>{pkg.name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Credits</Text>
              <Text style={styles.summaryValue}>
                {pkg.is_unlimited ? 'Unlimited' : pkg.credits}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Validity</Text>
              <Text style={styles.summaryValue}>{formatValidityDays(pkg.validity_days)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalValue}>{formatCurrency(pkg.price)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={isLoading ? "Processing..." : `Purchase for ${formatCurrency(pkg.price)}`}
            onPress={handlePurchase}
            disabled={isLoading}
            loading={isLoading}
            style={styles.purchaseButton}
          />
        </View>
      </View>

      {/* Cash Payment Instructions Modal */}
      {cashInstructions && (
        <CashPaymentInstructionsModal
          visible={showCashInstructions}
          instructions={cashInstructions}
          onClose={handleCashInstructionsClose}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  packageCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.lg,
    marginVertical: SPACING.lg,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  packageIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${COLORS.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  featuredBadge: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  featuredText: {
    fontSize: 10,
    color: COLORS.background,
    fontWeight: '600',
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  packageDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  packageDetails: {
    gap: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  detailText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  valueText: {
    color: COLORS.success,
    fontWeight: '600',
  },
  section: {
    marginVertical: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  paymentMethod: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  paymentMethodSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}05`,
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  paymentMethodText: {
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
  },
  paymentMethodTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: COLORS.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  termsContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  termsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  footer: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  purchaseButton: {
    borderRadius: 12,
  },
});

export default PurchaseModal;