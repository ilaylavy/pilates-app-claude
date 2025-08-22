import React from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { COLORS, SPACING } from '../utils/config';

export type PaymentMethodType = 'CREDIT_CARD' | 'CASH';

interface PaymentMethodOption {
  id: PaymentMethodType;
  title: string;
  description: string;
  icon: string;
}

interface Props {
  selectedMethod: PaymentMethodType;
  onSelectMethod: (method: PaymentMethodType) => void;
  showInfoModal?: boolean;
  onHideInfoModal?: () => void;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: 'CREDIT_CARD',
    title: 'Credit/Debit Card',
    description: 'Pay securely with your card',
    icon: '💳',
  },
  {
    id: 'CASH',
    title: 'Pay with Cash',
    description: 'Reserve now, pay at studio reception',
    icon: '💵',
  },
];

const PaymentMethodSelector: React.FC<Props> = ({
  selectedMethod,
  onSelectMethod,
  showInfoModal = false,
  onHideInfoModal,
}) => {
  const renderPaymentMethod = (method: PaymentMethodOption) => {
    const isSelected = selectedMethod === method.id;
    
    return (
      <TouchableOpacity
        key={method.id}
        style={[
          styles.methodButton,
          isSelected && styles.selectedMethod,
        ]}
        onPress={() => onSelectMethod(method.id)}
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected }}
      >
        <View style={styles.methodContent}>
          <View style={styles.methodHeader}>
            <Text style={styles.methodIcon}>{method.icon}</Text>
            <View style={styles.methodTextContainer}>
              <Text style={[
                styles.methodTitle,
                isSelected && styles.selectedText
              ]}>
                {method.title}
              </Text>
              <Text style={[
                styles.methodDescription,
                isSelected && styles.selectedDescriptionText
              ]}>
                {method.description}
              </Text>
            </View>
          </View>
          
          <View style={[
            styles.radioButton,
            isSelected && styles.selectedRadio
          ]}>
            {isSelected && <View style={styles.radioButtonInner} />}
          </View>
        </View>
        
        {method.id === 'CASH' && (
          <View style={styles.cashNote}>
            <Text style={styles.cashNoteText}>
              ⚠️ Package will be reserved for 48 hours
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderInfoModal = () => (
    <Modal
      visible={showInfoModal}
      animationType="slide"
      transparent={true}
      onRequestClose={onHideInfoModal}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>Why Pay with Cash?</Text>
            
            <View style={styles.infoSection}>
              <Text style={styles.infoSubtitle}>How it works:</Text>
              <Text style={styles.infoText}>
                • Reserve your package now without payment{'\n'}
                • Package is held for 48 hours{'\n'}
                • Pay at reception before your first class{'\n'}
                • Credits activate after payment confirmation
              </Text>
            </View>
            
            <View style={styles.infoSection}>
              <Text style={styles.infoSubtitle}>Benefits:</Text>
              <Text style={styles.infoText}>
                • No online payment fees{'\n'}
                • Speak with staff about package options{'\n'}
                • Pay exactly when you're ready to start
              </Text>
            </View>
            
            <View style={styles.infoSection}>
              <Text style={styles.infoSubtitle}>Important:</Text>
              <Text style={styles.infoText}>
                • Reservation expires after 48 hours{'\n'}
                • Credits cannot be used until payment is made{'\n'}
                • Popular classes may fill up during reservation period
              </Text>
            </View>
          </ScrollView>
          
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={onHideInfoModal}
          >
            <Text style={styles.modalCloseText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payment Method</Text>
        {selectedMethod === 'CASH' && (
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => onHideInfoModal && onHideInfoModal()}
          >
            <Text style={styles.infoButtonText}>ℹ️</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.methodsContainer}>
        {PAYMENT_METHODS.map(renderPaymentMethod)}
      </View>
      
      {renderInfoModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  infoButton: {
    padding: SPACING.xs,
  },
  infoButtonText: {
    fontSize: 16,
  },
  methodsContainer: {
    gap: SPACING.sm,
  },
  methodButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  selectedMethod: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  methodContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIcon: {
    fontSize: 24,
    marginRight: SPACING.md,
  },
  methodTextContainer: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  methodDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  selectedText: {
    color: COLORS.primary,
  },
  selectedDescriptionText: {
    color: COLORS.primary + 'CC',
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
  selectedRadio: {
    borderColor: COLORS.primary,
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  cashNote: {
    backgroundColor: COLORS.warning + '15',
    padding: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.warning + '30',
  },
  cashNoteText: {
    fontSize: 12,
    color: COLORS.warning,
    textAlign: 'center',
    fontWeight: '500',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  infoSection: {
    marginBottom: SPACING.lg,
  },
  infoSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  modalCloseButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  modalCloseText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PaymentMethodSelector;