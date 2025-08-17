import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { StackNavigationProp } from '@react-navigation/stack';

import { useAuth } from '../../hooks/useAuth';
import { AuthStackParamList } from '../../navigation/Navigation';
import { COLORS, SPACING } from '../../utils/config';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { LoginRequest } from '../../types';

type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
}

interface FormData {
  email: string;
  password: string;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { login, isBiometricEnabled, authenticateWithBiometric } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      await login(data);
    } catch (error: any) {
      Alert.alert(
        'Login Failed',
        error?.response?.data?.detail || 'An error occurred during login'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const success = await authenticateWithBiometric();
      if (!success) {
        Alert.alert('Authentication Failed', 'Biometric authentication was not successful');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred during biometric authentication');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="email"
              rules={{
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email"
                  placeholder="Enter your email"
                  leftIcon="mail"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              rules={{
                required: 'Password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Password"
                  placeholder="Enter your password"
                  leftIcon="lock-closed"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  isPassword
                />
              )}
            />

            <Button
              title="Sign In"
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              style={styles.loginButton}
            />

            {isBiometricEnabled && (
              <Button
                title="Use Biometric"
                onPress={handleBiometricLogin}
                variant="outline"
                style={styles.biometricButton}
              />
            )}

            <Button
              title="Forgot Password?"
              onPress={() => navigation.navigate('ForgotPassword')}
              variant="outline"
              style={styles.forgotButton}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Button
              title="Sign Up"
              onPress={() => navigation.navigate('Register')}
              variant="outline"
              size="small"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  form: {
    marginBottom: SPACING.xl,
  },
  loginButton: {
    marginTop: SPACING.md,
  },
  biometricButton: {
    marginTop: SPACING.md,
  },
  forgotButton: {
    marginTop: SPACING.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginRight: SPACING.sm,
  },
});

export default LoginScreen;