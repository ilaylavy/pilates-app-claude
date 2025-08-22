import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Vibration
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  CardField,
  useStripe,
  PaymentIntent,
  CardFieldInput
} from '@stripe/stripe-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { COLORS, SPACING } from '../utils/config';
import { paymentsApi } from '../api/payments';
import { getFriendlyErrorMessage, getErrorAlertTitle } from '../utils/errorMessages';
import { packagesApi } from '../api/packages';
import Button from '../components/common/Button';
import PaymentMethodSelector, { PaymentMethodType } from '../components/PaymentMethodSelector';
import CashPaymentInstructions from '../components/CashPaymentInstructions';

type RootStackParamList = {
  Payment: {
    packageId: number;
    packageName: string;
    price: number;
    currency: string;
  };
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
};

type PaymentScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Payment'>;
type PaymentScreenRouteProp = RouteProp<RootStackParamList, 'Payment'>;

interface Props {
  navigation: PaymentScreenNavigationProp;
  route: PaymentScreenRouteProp;
}

const PaymentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { packageId, packageName, price, currency } = route.params;
  const { confirmPayment, initPaymentSheet, presentPaymentSheet } = useStripe();
  const queryClient = useQueryClient();

  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details>();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('card');
  const [loading, setLoading] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('Preparing payment...');
  const [showCashInstructions, setShowCashInstructions] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Create payment intent mutation
  const createPaymentIntentMutation = useMutation({
    mutationFn: () => paymentsApi.createPaymentIntent(packageId, currency),
    onError: (error: any) => {
      console.error('Failed to create payment intent:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create payment';
      const friendlyMessage = getFriendlyErrorMessage(errorMessage);
      const alertTitle = getErrorAlertTitle(errorMessage);
      Alert.alert(alertTitle, friendlyMessage);
      setLoading(false);
    }
  });

  // Create cash reservation mutation
  const createCashReservationMutation = useMutation({
    mutationFn: () => paymentsApi.createCashReservation(packageId),
    onSuccess: (data) => {
      // Invalidate queries to refresh package data
      queryClient.invalidateQueries({ queryKey: ['user-packages'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      
      Vibration.vibrate(100);
      navigation.navigate('PurchaseConfirmation', {
        paymentMethod: 'cash',
        packageName,
        price,
        currency,
        reservationId: data.reservation_id,
      });
      setLoading(false);
    },
    onError: (error: any) => {
      console.error('Failed to create cash reservation:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to reserve package';
      const friendlyMessage = getFriendlyErrorMessage(errorMessage);
      const alertTitle = getErrorAlertTitle(errorMessage);
      Alert.alert(alertTitle, friendlyMessage);
      setLoading(false);
    }
  });

  // Confirm payment mutation  
  const confirmPaymentMutation = useMutation({
    mutationFn: (paymentIntentId: string) => paymentsApi.confirmPayment(paymentIntentId),
    onSuccess: (data) => {
      // Invalidate queries to refresh package data
      queryClient.invalidateQueries({ queryKey: ['user-packages'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      
      Vibration.vibrate([100, 100, 100]);
      navigation.navigate('PurchaseConfirmation', {
        paymentMethod: 'card',
        packageName,
        price,
        currency,
        paymentId: data.payment_id,
        credits: data.credits,
        expiryDate: data.expiry_date,
      });
      setLoading(false);
    },
    onError: (error: any) => {
      console.error('Failed to confirm payment:', error);
      Alert.alert(
        'Payment Confirmation Failed', 
        error.response?.data?.detail || 'Your card was charged but we couldn\'t confirm the purchase. Please contact support with your payment receipt.',
        [
          { text: 'Contact Support', onPress: () => {/* TODO: Add support contact */} },
          { text: 'OK', style: 'cancel' }
        ]
      );
      setLoading(false);
    }
  });

  const handleCardPayment = async () => {
    if (!cardDetails?.complete) {
      Alert.alert('Incomplete Card Details', 'Please enter complete card details including expiry date and CVV.');
      return;
    }

    setLoading(true);
    setProcessingStep('Creating payment...');

    try {
      // Create payment intent
      const paymentIntent = await createPaymentIntentMutation.mutateAsync();
      
      setProcessingStep('Processing card...');
      
      // Confirm payment with card details
      const { error, paymentIntent: confirmedPaymentIntent } = await confirmPayment(
        paymentIntent.client_secret,
        {
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: {
              name: 'Customer', // TODO: Add user name from profile
            },
          },
        }
      );

      if (error) {
        let errorMessage = 'Payment failed. Please try again.';
        
        const errorCode = error.code as string;
        switch (errorCode) {
          case 'card_declined':
            errorMessage = 'Your card was declined. Please try a different payment method.';
            break;
          case 'insufficient_funds':
            errorMessage = 'Insufficient funds. Please check your account balance.';
            break;
          case 'expired_card':
            errorMessage = 'Your card has expired. Please use a different card.';
            break;
          case 'incorrect_cvc':
            errorMessage = 'Incorrect security code. Please check your CVV.';
            break;
          case 'processing_error':
            errorMessage = 'Payment processing error. Please try again in a moment.';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }
        
        Alert.alert('Payment Failed', errorMessage);
        setLoading(false);
        return;
      }

      if (confirmedPaymentIntent?.status === 'Succeeded') {
        setProcessingStep('Confirming purchase...');
        // Confirm payment with backend
        await confirmPaymentMutation.mutateAsync(paymentIntent.payment_intent_id);
      } else {
        Alert.alert('Payment Incomplete', 'Payment requires additional authentication. Please contact support.');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'An unexpected error occurred';
      const friendlyMessage = getFriendlyErrorMessage(errorMessage);
      const alertTitle = getErrorAlertTitle(errorMessage);
      Alert.alert(alertTitle, friendlyMessage);
      setLoading(false);
    }
  };

  const handleCashPayment = async () => {
    if (showCashInstructions) {
      setLoading(true);
      setProcessingStep('Creating reservation...');
      await createCashReservationMutation.mutateAsync();
    } else {
      setShowCashInstructions(true);
    }
  };

  const handlePaymentMethodChange = (method: PaymentMethodType) => {
    setPaymentMethod(method);
    setShowCashInstructions(false);
    if (method === 'cash') {
      setShowInfoModal(true);
    }
  };


  const renderPaymentMethodSelection = () => (
    <PaymentMethodSelector
      selectedMethod={paymentMethod}
      onSelectMethod={handlePaymentMethodChange}
      showInfoModal={showInfoModal}
      onHideInfoModal={() => setShowInfoModal(false)}
    />
  );

  const renderCardInput = () => (
    <View style={styles.cardInputContainer}>
      <Text style={styles.sectionTitle}>Card Details</Text>
      <CardField
        postalCodeEnabled={false}
        placeholders={{
          number: '4242 4242 4242 4242',
        }}
        cardStyle={{
          backgroundColor: COLORS.white,
          textColor: COLORS.text,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: COLORS.border,
          fontSize: 16,
        }}
        style={styles.cardField}
        onCardChange={(details) => {
          setCardDetails(details);
        }}
      />
      
      <TouchableOpacity
        style={styles.saveCardContainer}
        onPress={() => setSaveCard(!saveCard)}
      >
        <View style={[
          styles.checkbox,
          saveCard && styles.checkboxChecked
        ]}>
          {saveCard && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.saveCardText}>Save card for future purchases</Text>
      </TouchableOpacity>
      
      {cardDetails?.brand && (
        <View style={styles.cardBrandContainer}>
          <Text style={styles.cardBrandText}>
            {getCardBrandIcon(cardDetails.brand)} {cardDetails.brand.toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );

  const getCardBrandIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa': return '💳';
      case 'mastercard': return '💳';
      case 'amex': return '💳';
      case 'discover': return '💳';
      default: return '💳';
    }
  };

  const renderCashInstructions = () => (
    <View style={styles.cashInstructionsContainer}>
      <CashPaymentInstructions
        packageName={packageName}
        price={price}
        currency={currency}
        reservationHours={48}
      />
    </View>
  );

  const renderPaymentButton = () => {
    if (paymentMethod === 'card') {
      return (
        <Button
          title={`Pay ${currency === 'ils' ? '₪' : currency.toUpperCase()}${price.toFixed(2)}`}
          onPress={handleCardPayment}
          disabled={loading || !cardDetails?.complete}
          loading={loading}
          style={styles.payButton}
        />
      );
    }

    if (paymentMethod === 'cash') {
      return (
        <Button
          title={showCashInstructions ? 'Confirm Reservation' : 'Continue with Cash Payment'}
          onPress={handleCashPayment}
          disabled={loading}
          loading={loading}
          style={[styles.payButton, styles.cashPayButton] as any}
        />
      );
    }

    return null;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Package Information */}
        <View style={styles.packageInfo}>
          <Text style={styles.packageName}>{packageName}</Text>
          <Text style={styles.packagePrice}>₪{price.toFixed(2)}</Text>
        </View>

        {/* Payment Method Selection */}
        {renderPaymentMethodSelection()}

        {/* Card Input (only show for card payments) */}
        {paymentMethod === 'card' && !showCashInstructions && renderCardInput()}

        {/* Cash Instructions (only show when cash is selected and user clicked continue) */}
        {paymentMethod === 'cash' && showCashInstructions && renderCashInstructions()}

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <Text style={styles.securityText}>
            🔒 Your payment information is encrypted and secure
          </Text>
        </View>
      </ScrollView>

      {/* Payment Button */}
      <View style={styles.paymentButtonContainer}>
        {renderPaymentButton()}
        
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>{processingStep}</Text>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
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
  packageInfo: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  packageName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  paymentMethodsContainer: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  paymentMethodButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  selectedPaymentMethod: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  paymentMethodText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  cardInputContainer: {
    marginBottom: SPACING.lg,
  },
  cardField: {
    width: '100%',
    height: 50,
    marginVertical: SPACING.sm,
  },
  saveCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  saveCardText: {
    fontSize: 14,
    color: COLORS.text,
  },
  cardBrandContainer: {
    alignItems: 'flex-end',
    marginTop: SPACING.xs,
  },
  cardBrandText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  cashInstructionsContainer: {
    flex: 1,
    marginBottom: SPACING.lg,
  },
  securityNotice: {
    backgroundColor: COLORS.success + '10',
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  securityText: {
    fontSize: 14,
    color: COLORS.success,
    textAlign: 'center',
  },
  paymentButtonContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  payButton: {
    height: 50,
    marginVertical: SPACING.sm,
  },
  cashPayButton: {
    backgroundColor: COLORS.secondary,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white + 'CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.sm,
    fontSize: 16,
    color: COLORS.text,
  },
});

export default PaymentScreen;