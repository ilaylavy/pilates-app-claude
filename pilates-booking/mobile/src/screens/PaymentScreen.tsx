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
  Platform
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  CardField,
  useStripe,
  useApplePay,
  useGooglePay,
  ApplePayButton,
  GooglePayButton,
  PaymentIntent,
  CardFieldInput
} from '@stripe/stripe-react-native';
import { useMutation, useQuery } from '@tanstack/react-query';

import { COLORS, SPACING } from '../utils/config';
import { paymentsApi } from '../api/payments';
import { packagesApi } from '../api/packages';
import Button from '../components/common/Button';

type RootStackParamList = {
  Payment: {
    packageId: number;
    packageName: string;
    price: number;
    currency: string;
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
  const { presentApplePay, isApplePaySupported } = useApplePay();
  const { presentGooglePay, isGooglePaySupported } = useGooglePay();

  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details>();
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple_pay' | 'google_pay'>('card');
  const [loading, setLoading] = useState(false);

  // Check for Apple Pay and Google Pay support
  const { data: applePaySupported } = useQuery({
    queryKey: ['applePaySupport'],
    queryFn: () => isApplePaySupported(),
    enabled: Platform.OS === 'ios'
  });

  const { data: googlePaySupported } = useQuery({
    queryKey: ['googlePaySupport'], 
    queryFn: () => isGooglePaySupported(),
    enabled: Platform.OS === 'android'
  });

  // Create payment intent mutation
  const createPaymentIntentMutation = useMutation({
    mutationFn: () => paymentsApi.createPaymentIntent(packageId, currency),
    onError: (error: any) => {
      console.error('Failed to create payment intent:', error);
      Alert.alert('Error', 'Failed to create payment. Please try again.');
      setLoading(false);
    }
  });

  // Confirm payment mutation  
  const confirmPaymentMutation = useMutation({
    mutationFn: (paymentIntentId: string) => paymentsApi.confirmPayment(paymentIntentId),
    onSuccess: () => {
      Alert.alert(
        'Payment Successful!',
        `Your purchase of ${packageName} has been completed.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
      setLoading(false);
    },
    onError: (error: any) => {
      console.error('Failed to confirm payment:', error);
      Alert.alert('Error', 'Payment confirmation failed. Please contact support.');
      setLoading(false);
    }
  });

  const handleCardPayment = async () => {
    if (!cardDetails?.complete) {
      Alert.alert('Error', 'Please enter complete card details.');
      return;
    }

    setLoading(true);

    try {
      // Create payment intent
      const paymentIntent = await createPaymentIntentMutation.mutateAsync();
      
      // Confirm payment with card details
      const { error, paymentIntent: confirmedPaymentIntent } = await confirmPayment(
        paymentIntent.client_secret,
        {
          paymentMethodType: 'Card'
        }
      );

      if (error) {
        Alert.alert('Payment Failed', error.message);
        setLoading(false);
        return;
      }

      if (confirmedPaymentIntent?.status === 'Succeeded') {
        // Confirm payment with backend
        await confirmPaymentMutation.mutateAsync(paymentIntent.payment_intent_id);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Payment failed. Please try again.');
      setLoading(false);
    }
  };

  const handleApplePay = async () => {
    if (!applePaySupported) {
      Alert.alert('Error', 'Apple Pay is not supported on this device.');
      return;
    }

    setLoading(true);

    try {
      // Create payment intent
      const paymentIntent = await createPaymentIntentMutation.mutateAsync();

      // Present Apple Pay
      const { error } = await presentApplePay({
        cartItems: [
          {
            label: packageName,
            amount: price.toString(),
            paymentType: 'Immediate'
          }
        ],
        country: 'IL',
        currency: currency.toUpperCase(),
        requiredShippingAddressFields: [],
        requiredBillingContactFields: []
      });

      if (error) {
        Alert.alert('Apple Pay Error', error.message);
        setLoading(false);
        return;
      }

      // Confirm payment with backend
      await confirmPaymentMutation.mutateAsync(paymentIntent.payment_intent_id);
    } catch (error: any) {
      console.error('Apple Pay error:', error);
      Alert.alert('Error', 'Apple Pay failed. Please try again.');
      setLoading(false);
    }
  };

  const handleGooglePay = async () => {
    if (!googlePaySupported) {
      Alert.alert('Error', 'Google Pay is not supported on this device.');
      return;
    }

    setLoading(true);

    try {
      // Create payment intent
      const paymentIntent = await createPaymentIntentMutation.mutateAsync();

      // Present Google Pay
      const { error } = await presentGooglePay({
        clientSecret: paymentIntent.client_secret,
        forSetupIntent: false,
        currencyCode: currency.toUpperCase(),
        merchantName: 'Pilates Studio'
      });

      if (error) {
        Alert.alert('Google Pay Error', error.message);
        setLoading(false);
        return;
      }

      // Confirm payment with backend
      await confirmPaymentMutation.mutateAsync(paymentIntent.payment_intent_id);
    } catch (error: any) {
      console.error('Google Pay error:', error);
      Alert.alert('Error', 'Google Pay failed. Please try again.');
      setLoading(false);
    }
  };

  const renderPaymentMethods = () => (
    <View style={styles.paymentMethodsContainer}>
      <Text style={styles.sectionTitle}>Payment Method</Text>
      
      {/* Card Payment */}
      <TouchableOpacity
        style={[
          styles.paymentMethodButton,
          paymentMethod === 'card' && styles.selectedPaymentMethod
        ]}
        onPress={() => setPaymentMethod('card')}
      >
        <Text style={styles.paymentMethodText}>💳 Credit/Debit Card</Text>
      </TouchableOpacity>

      {/* Apple Pay */}
      {Platform.OS === 'ios' && applePaySupported && (
        <TouchableOpacity
          style={[
            styles.paymentMethodButton,
            paymentMethod === 'apple_pay' && styles.selectedPaymentMethod
          ]}
          onPress={() => setPaymentMethod('apple_pay')}
        >
          <Text style={styles.paymentMethodText}>🍎 Apple Pay</Text>
        </TouchableOpacity>
      )}

      {/* Google Pay */}
      {Platform.OS === 'android' && googlePaySupported && (
        <TouchableOpacity
          style={[
            styles.paymentMethodButton,
            paymentMethod === 'google_pay' && styles.selectedPaymentMethod
          ]}
          onPress={() => setPaymentMethod('google_pay')}
        >
          <Text style={styles.paymentMethodText}>🏦 Google Pay</Text>
        </TouchableOpacity>
      )}
    </View>
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
        }}
        style={styles.cardField}
        onCardChange={setCardDetails}
      />
    </View>
  );

  const renderPaymentButton = () => {
    if (paymentMethod === 'card') {
      return (
        <Button
          title={`Pay ₪${price.toFixed(2)}`}
          onPress={handleCardPayment}
          disabled={loading || !cardDetails?.complete}
          loading={loading}
          style={styles.payButton}
        />
      );
    }

    if (paymentMethod === 'apple_pay' && Platform.OS === 'ios') {
      return (
        <ApplePayButton
          onPress={handleApplePay}
          type="pay"
          buttonStyle="black"
          borderRadius={8}
          style={styles.payButton}
        />
      );
    }

    if (paymentMethod === 'google_pay' && Platform.OS === 'android') {
      return (
        <GooglePayButton
          onPress={handleGooglePay}
          type="pay"
          style={styles.payButton}
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

        {/* Payment Methods */}
        {renderPaymentMethods()}

        {/* Card Input (only show for card payments) */}
        {paymentMethod === 'card' && renderCardInput()}

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
            <Text style={styles.loadingText}>Processing payment...</Text>
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