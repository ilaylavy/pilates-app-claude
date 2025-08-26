import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  // ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import { BlurView } from 'expo-blur';
// import * as Haptics from 'expo-haptics';

import { COLORS, SPACING } from '../../utils/config';
import { packagesApi } from '../../api/packages';
import { Package, PaymentMethodType, CashPaymentInstructions } from '../../types';
import Button from '../common/Button';

interface QuickPurchaseModalProps {
  visible: boolean;
  package: Package;
  onClose: () => void;
  onPurchase: () => void;
}

const QuickPurchaseModal: React.FC<QuickPurchaseModalProps> = ({
  visible,
  package: pkg,
  onClose,
  onPurchase,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('CREDIT_CARD');
  // const [showPaymentMethods, setShowPaymentMethods] = useState(false);

  const formatCurrency = (amount: number) => {
    return `₪${Number(amount).toFixed(0)}`;
  };

  const paymentMethods = [
    {
      id: 'CREDIT_CARD' as PaymentMethodType,
      name: 'Credit Card',
      icon: 'card',
      description: 'Pay with Visa, Mastercard',
      quickPay: true,
    },
    {
      id: 'STRIPE' as PaymentMethodType,
      name: 'Apple Pay',
      icon: 'logo-apple',
      description: 'Touch ID or Face ID',
      quickPay: true,
    },
    {
      id: 'CASH' as PaymentMethodType,
      name: 'Cash at Studio',
      icon: 'cash',
      description: 'Pay at reception desk',
      quickPay: false,
    },
  ];

  const handleQuickPurchase = async () => {
    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (selectedMethod === 'CASH') {
      await handleCashPurchase();
    } else {
      await handleDigitalPurchase();
    }
  };

  const handleCashPurchase = async () => {
    setIsLoading(true);
    try {
      const result = await packagesApi.purchasePackage(pkg.id, 'CASH');
      
      if ('reference_code' in result) {
        const instructions = result as CashPaymentInstructions;
        
        Alert.alert(
          'Cash Payment Setup Complete! 💸',
          `Your ${pkg.name} package is ready to use!\n\n` +
          `Credits: ${pkg.credits} (Available Now)\n` +
          `Reference: ${instructions.reference_code}\n\n` +
          `📍 Please pay ₪${pkg.price} at the reception desk when convenient.\n\n` +
          `✅ You can start booking classes immediately!`,
          [
            { text: 'Got it!', style: 'default' }
          ]
        );
        
        onPurchase();
        onClose();
      }
    } catch (error: any) {
      Alert.alert(
        'Purchase Failed',
        error.response?.data?.detail || 'Failed to create package. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDigitalPurchase = async () => {
    setIsLoading(true);
    try {
      // Simulate Apple Pay / Card processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // For demo - show success
      Alert.alert(
        'Payment Successful! 🎉',
        `Your ${pkg.name} package has been activated!\n\n` +
        `✅ ${pkg.credits} credits added to your account\n` +
        `📅 Valid until ${new Date(Date.now() + pkg.validity_days * 24 * 60 * 60 * 1000).toLocaleDateString()}\n\n` +
        `Start booking classes now!`,
        [
          { text: 'Start Booking', onPress: () => {
            onPurchase();
            onClose();
          }}
        ]
      );
    } catch {
      Alert.alert('Payment Failed', 'Please try again or contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderPaymentMethodSelector = () => (
    <View style={styles.paymentSection}>
      <Text style={styles.sectionTitle}>Payment Method</Text>
      <View style={styles.paymentMethods}>
        {paymentMethods.map((method) => (
          <TouchableOpacity
            key={method.id}
            style={[
              styles.paymentMethod,
              selectedMethod === method.id && styles.paymentMethodSelected
            ]}
            onPress={() => setSelectedMethod(method.id)}
          >
            <View style={styles.paymentMethodContent}>
              <View style={styles.paymentMethodIcon}>
                <Ionicons 
                  name={method.icon} 
                  size={24} 
                  color={selectedMethod === method.id ? COLORS.primary : COLORS.textSecondary} 
                />
              </View>
              <View style={styles.paymentMethodText}>
                <Text style={[
                  styles.paymentMethodName,
                  selectedMethod === method.id && styles.selectedText
                ]}>
                  {method.name}
                </Text>
                <Text style={styles.paymentMethodDescription}>
                  {method.description}
                </Text>
              </View>
              {method.quickPay && (
                <View style={styles.quickPayBadge}>
                  <Text style={styles.quickPayText}>⚡ Instant</Text>
                </View>
              )}
            </View>
            
            <View style={[
              styles.radioButton,
              selectedMethod === method.id && styles.radioButtonSelected
            ]}>
              {selectedMethod === method.id && (
                <View style={styles.radioButtonInner} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderPackageSummary = () => (
    <View style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.packageIcon}>
          <Ionicons 
            name={pkg.is_unlimited ? "infinite" : "flash"} 
            size={24} 
            color={COLORS.primary} 
          />
        </View>
        <View style={styles.packageInfo}>
          <Text style={styles.packageName}>{pkg.name}</Text>
          <Text style={styles.packageDetails}>
            {pkg.is_unlimited ? 'Unlimited classes' : `${pkg.credits} credits`} • 
            Valid {pkg.validity_days} days
          </Text>
        </View>
        <Text style={styles.packagePrice}>{formatCurrency(pkg.price)}</Text>
      </View>
      
      {pkg.description && (
        <Text style={styles.packageDescription}>{pkg.description}</Text>
      )}
    </View>
  );

  const getButtonText = () => {
    if (isLoading) {
      return selectedMethod === 'CASH' ? 'Setting up...' : 'Processing...';
    }
    
    switch (selectedMethod) {
      case 'CASH':
        return `Reserve for ${formatCurrency(pkg.price)}`;
      case 'STRIPE':
        return `Pay with Apple Pay ${formatCurrency(pkg.price)}`;
      default:
        return `Pay ${formatCurrency(pkg.price)}`;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.backdrop} onPress={onClose} />
          
          <View style={styles.modal}>
            <View style={styles.header}>
              <Text style={styles.title}>Quick Purchase</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {renderPackageSummary()}
              {renderPaymentMethodSelector()}

              {/* Security Notice */}
              <View style={styles.securityNotice}>
                <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
                <Text style={styles.securityText}>
                  Secure payment • 256-bit SSL encryption
                </Text>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <Button
                title={getButtonText()}
                onPress={handleQuickPurchase}
                disabled={isLoading}
                loading={isLoading}
                style={[
                  styles.purchaseButton,
                  selectedMethod === 'CASH' && styles.cashButton
                ]}
              />
              
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: COLORS.background,
    borderRadius: 24,
    width: '90%',
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  content: {
    maxHeight: 400,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    margin: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  packageIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  packageDetails: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  packageDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  paymentSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  paymentMethods: {
    gap: SPACING.sm,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  paymentMethodSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  paymentMethodContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  paymentMethodText: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  selectedText: {
    color: COLORS.primary,
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  quickPayBadge: {
    backgroundColor: COLORS.success + '20',
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginRight: SPACING.sm,
  },
  quickPayText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '600',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: COLORS.primary,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  securityText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  footer: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  purchaseButton: {
    borderRadius: 16,
    marginBottom: SPACING.md,
  },
  cashButton: {
    backgroundColor: COLORS.warning,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  cancelButtonText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});

export default QuickPurchaseModal;