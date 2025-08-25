import React from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';
import { CashPaymentInstructions as CashPaymentInstructionsType } from '../types';
import Button from './common/Button';

interface Props {
  visible: boolean;
  instructions: CashPaymentInstructionsType;
  onClose: () => void;
}

const CashPaymentInstructions: React.FC<Props> = ({
  visible,
  instructions,
  onClose,
}) => {
  const getReservationHours = () => {
    if (instructions.reservation_expires_at) {
      const expiryTime = new Date(instructions.reservation_expires_at);
      const now = new Date();
      const hoursLeft = Math.ceil((expiryTime.getTime() - now.getTime()) / (1000 * 60 * 60));
      return Math.max(0, hoursLeft);
    }
    return 48; // Default
  };

  const reservationHours = getReservationHours();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Cash Payment</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.headerIcon}>💵</Text>
            <Text style={styles.headerTitle}>{instructions.message}</Text>
            <Text style={styles.headerSubtitle}>
              Reserve now, pay at studio reception
            </Text>
          </View>

          <View style={styles.packageSummary}>
            <Text style={styles.packageName}>{instructions.package_name}</Text>
            <Text style={styles.packagePrice}>
              {instructions.currency === 'ILS' ? '₪' : instructions.currency}{Number(instructions.price || 0).toFixed(2)}
            </Text>
            <Text style={styles.referenceCode}>
              Reference: {instructions.reference_code}
            </Text>
          </View>

      <View style={styles.instructionsContainer}>
        <Text style={styles.sectionTitle}>What happens next:</Text>
        
        <View style={styles.stepContainer}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Package Reserved</Text>
            <Text style={styles.stepDescription}>
              Your package will be reserved for {reservationHours} hours
            </Text>
          </View>
        </View>

        <View style={styles.stepContainer}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Visit the Studio</Text>
            <Text style={styles.stepDescription}>
              Come to our reception desk and pay in cash before your first class
            </Text>
          </View>
        </View>

        <View style={styles.stepContainer}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Credits Activated</Text>
            <Text style={styles.stepDescription}>
              After payment, your credits will be immediately available for booking
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.importantNotice}>
        <Text style={styles.noticeIcon}>⚠️</Text>
        <View style={styles.noticeContent}>
          <Text style={styles.noticeTitle}>Important Notes:</Text>
          <Text style={styles.noticeText}>
            • Reservation expires in {reservationHours} hours if not paid{'\n'}
            • Credits cannot be used until payment is made{'\n'}
            • Bring exact change or card as backup{'\n'}
            • Reception hours: Sunday-Thursday 6:00-22:00, Friday 6:00-15:00
          </Text>
        </View>
      </View>

          <View style={styles.instructionsListContainer}>
            <Text style={styles.instructionTitle}>Payment Instructions:</Text>
            {instructions.payment_instructions.map((instruction, index) => (
              <Text key={index} style={styles.instructionText}>
                • {instruction}
              </Text>
            ))}
          </View>

          <View style={styles.confirmationNote}>
            <Text style={styles.confirmationText}>
              Estimated approval time: {instructions.estimated_approval_time}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Got it!"
            onPress={onClose}
            style={styles.closeButtonStyle}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
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
  modalTitle: {
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
  header: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  headerIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  packageSummary: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 8,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  packageName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  referenceCode: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.secondary,
    fontFamily: 'monospace',
    backgroundColor: COLORS.secondary + '15',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
  },
  instructionsContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  stepNumberText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  stepDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  importantNotice: {
    backgroundColor: COLORS.warning + '15',
    borderRadius: 8,
    padding: SPACING.md,
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  noticeIcon: {
    fontSize: 24,
    marginRight: SPACING.sm,
  },
  noticeContent: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.warning,
    marginBottom: SPACING.xs,
  },
  noticeText: {
    fontSize: 14,
    color: COLORS.warning,
    lineHeight: 18,
  },
  confirmationNote: {
    backgroundColor: COLORS.success + '15',
    borderRadius: 8,
    padding: SPACING.md,
    alignItems: 'center',
  },
  confirmationText: {
    fontSize: 14,
    color: COLORS.success,
    textAlign: 'center',
    lineHeight: 18,
  },
  instructionsListContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  footer: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  closeButtonStyle: {
    borderRadius: 12,
  },
});

export default CashPaymentInstructions;