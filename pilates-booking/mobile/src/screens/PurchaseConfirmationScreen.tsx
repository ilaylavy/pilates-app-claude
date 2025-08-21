import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { COLORS, SPACING } from '../utils/config';
import Button from '../components/common/Button';
import { PaymentMethodType } from '../components/PaymentMethodSelector';

type RootStackParamList = {
  PurchaseConfirmation: {
    paymentMethod: PaymentMethodType;
    packageName: string;
    price: number;
    currency: string;
    paymentId?: number;
    reservationId?: string;
    credits?: number;
    expiryDate?: string;
  };
  BookClass: undefined;
  Profile: undefined;
  Packages: undefined;
};

type PurchaseConfirmationScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'PurchaseConfirmation'
>;
type PurchaseConfirmationScreenRouteProp = RouteProp<
  RootStackParamList,
  'PurchaseConfirmation'
>;

interface Props {
  navigation: PurchaseConfirmationScreenNavigationProp;
  route: PurchaseConfirmationScreenRouteProp;
}

const PurchaseConfirmationScreen: React.FC<Props> = ({ navigation, route }) => {
  const {
    paymentMethod,
    packageName,
    price,
    currency,
    paymentId,
    reservationId,
    credits,
    expiryDate,
  } = route.params;

  const isCardPayment = paymentMethod === 'card';
  const isCashReservation = paymentMethod === 'cash';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getReceiptNumber = () => {
    if (isCardPayment && paymentId) {
      return `PAY-${paymentId}`;
    }
    if (isCashReservation && reservationId) {
      return `RES-${reservationId}`;
    }
    return 'N/A';
  };

  const handleShare = async () => {
    try {
      const message = isCardPayment
        ? `I just purchased ${packageName} at the Pilates Studio! 💪\n\nPackage: ${packageName}\nCredits: ${credits}\nAmount: ${currency === 'ils' ? '₪' : currency.toUpperCase()}${price.toFixed(2)}\n\nReady to get stronger! 🧘‍♀️`
        : `I reserved ${packageName} at the Pilates Studio! 💪\n\nPackage: ${packageName}\nReservation: ${getReceiptNumber()}\n\nCan't wait to start my Pilates journey! 🧘‍♀️`;

      await Share.share({
        message,
        title: 'Pilates Package Purchase',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const renderSuccessIcon = () => (
    <View style={styles.iconContainer}>
      <Text style={styles.successIcon}>
        {isCardPayment ? '✅' : '🎫'}
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      {renderSuccessIcon()}
      <Text style={styles.title}>
        {isCardPayment ? 'Payment Successful!' : 'Package Reserved!'}
      </Text>
      <Text style={styles.subtitle}>
        {isCardPayment
          ? 'Your purchase has been completed successfully'
          : 'Your package has been reserved successfully'}
      </Text>
    </View>
  );

  const renderPackageDetails = () => (
    <View style={styles.detailsContainer}>
      <Text style={styles.detailsTitle}>Package Details</Text>
      
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Package:</Text>
        <Text style={styles.detailValue}>{packageName}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Amount:</Text>
        <Text style={styles.detailValue}>
          {currency === 'ils' ? '₪' : currency.toUpperCase()}{price.toFixed(2)}
        </Text>
      </View>

      {credits && (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Credits:</Text>
          <Text style={[styles.detailValue, styles.creditsValue]}>
            {credits} {credits === 1 ? 'credit' : 'credits'}
            {isCashReservation && (
              <Text style={styles.reservedText}> (reserved)</Text>
            )}
          </Text>
        </View>
      )}

      {expiryDate && (
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Expires:</Text>
          <Text style={styles.detailValue}>{formatDate(expiryDate)}</Text>
        </View>
      )}

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Payment Method:</Text>
        <Text style={styles.detailValue}>
          {isCardPayment ? '💳 Card Payment' : '💵 Cash (at studio)'}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>
          {isCardPayment ? 'Receipt #:' : 'Reservation #:'}
        </Text>
        <Text style={styles.detailValue}>{getReceiptNumber()}</Text>
      </View>
    </View>
  );

  const renderCashInstructions = () => {
    if (!isCashReservation) return null;

    return (
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>Next Steps:</Text>
        
        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>1</Text>
          <Text style={styles.instructionText}>
            Visit our studio reception within 48 hours
          </Text>
        </View>

        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>2</Text>
          <Text style={styles.instructionText}>
            Pay {currency === 'ils' ? '₪' : currency.toUpperCase()}{price.toFixed(2)} in cash and show this confirmation
          </Text>
        </View>

        <View style={styles.instructionItem}>
          <Text style={styles.instructionNumber}>3</Text>
          <Text style={styles.instructionText}>
            Your credits will be activated immediately after payment
          </Text>
        </View>

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ Reservation expires in 48 hours if payment is not made
          </Text>
        </View>
      </View>
    );
  };

  const renderActions = () => (
    <View style={styles.actionsContainer}>
      <Button
        title="Book Your First Class"
        onPress={() => navigation.navigate('BookClass')}
        style={[styles.actionButton, styles.primaryButton]}
        disabled={isCashReservation}
      />

      <Button
        title="View My Packages"
        onPress={() => navigation.navigate('Profile')}
        style={[styles.actionButton, styles.secondaryButton]}
        variant="outline"
      />

      <TouchableOpacity
        style={styles.shareButton}
        onPress={handleShare}
      >
        <Text style={styles.shareButtonText}>📤 Share</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmailConfirmation = () => (
    <View style={styles.emailContainer}>
      <Text style={styles.emailIcon}>📧</Text>
      <Text style={styles.emailText}>
        A confirmation email has been sent with your {isCardPayment ? 'receipt' : 'reservation details'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderHeader()}
        {renderPackageDetails()}
        {renderCashInstructions()}
        {renderEmailConfirmation()}
      </ScrollView>

      {renderActions()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
    padding: SPACING.md,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  successIcon: {
    fontSize: 64,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  detailsContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '30',
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: SPACING.md,
  },
  creditsValue: {
    color: COLORS.primary,
  },
  reservedText: {
    color: COLORS.warning,
    fontStyle: 'italic',
  },
  instructionsContainer: {
    backgroundColor: COLORS.warning + '10',
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: SPACING.sm,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  warningBox: {
    backgroundColor: COLORS.warning + '20',
    borderRadius: 8,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.warning,
    textAlign: 'center',
    fontWeight: '500',
  },
  emailContainer: {
    backgroundColor: COLORS.success + '10',
    borderRadius: 8,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emailIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  emailText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.success,
    lineHeight: 18,
  },
  actionsContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    marginBottom: SPACING.sm,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    borderColor: COLORS.primary,
  },
  shareButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
  },
  shareButtonText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
  },
});

export default PurchaseConfirmationScreen;