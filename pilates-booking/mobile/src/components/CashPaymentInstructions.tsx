import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { COLORS, SPACING } from '../utils/config';

interface Props {
  packageName: string;
  price: number;
  currency: string;
  reservationHours?: number;
}

const CashPaymentInstructions: React.FC<Props> = ({
  packageName,
  price,
  currency,
  reservationHours = 48,
}) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>💵</Text>
        <Text style={styles.headerTitle}>Cash Payment Selected</Text>
        <Text style={styles.headerSubtitle}>
          Reserve now, pay at studio reception
        </Text>
      </View>

      <View style={styles.packageSummary}>
        <Text style={styles.packageName}>{packageName}</Text>
        <Text style={styles.packagePrice}>
          {currency === 'ils' ? '₪' : currency.toUpperCase()}{price.toFixed(2)}
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

      <View style={styles.confirmationNote}>
        <Text style={styles.confirmationText}>
          You'll receive a confirmation email with your reservation details and payment instructions.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
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
});

export default CashPaymentInstructions;