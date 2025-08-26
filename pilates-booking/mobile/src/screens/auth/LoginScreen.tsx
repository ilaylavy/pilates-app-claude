import React, { useState, useEffect } from 'react';
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
import { useTranslation } from '../../hooks/useTranslation';
import { StyleUtils } from '../../utils/styleUtils';
import { AuthStackParamList } from '../../navigation/Navigation';
import { COLORS, SPACING } from '../../utils/config';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { LoginRequest } from '../../types';
import { useLogging } from '../../hooks/useLogging';

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
  const { log, track } = useLogging('LoginScreen');
  const { t, rtlText, rtlRow } = useTranslation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();

  useEffect(() => {
    log.info('LoginScreen mounted');
    track.event('screen.login_viewed', {
      biometricEnabled: isBiometricEnabled,
      timestamp: new Date().toISOString()
    });
  }, []);

  const onSubmit = async (data: FormData) => {
    const startTime = Date.now();
    setIsLoading(true);
    
    try {
      log.info('Login attempt started', { email: data.email });
      track.userAction('form_submit', 'login_form', { 
        email: data.email,
        method: 'credentials'
      });
      
      await login(data);
      
      const duration = Date.now() - startTime;
      log.info('Login successful', { 
        email: data.email, 
        duration 
      });
      
      track.event('auth.login_success', {
        email: data.email,
        method: 'credentials',
        duration,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error?.response?.data?.detail || 'An error occurred during login';
      
      log.error('Login failed', error, { 
        email: data.email, 
        duration,
        errorMessage 
      });
      
      track.event('auth.login_failed', {
        email: data.email,
        method: 'credentials',
        duration,
        error: errorMessage,
        statusCode: error?.response?.status,
        timestamp: new Date().toISOString()
      });
      
      Alert.alert(t('alerts.loginFailed'), errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    const startTime = Date.now();
    
    try {
      log.info('Biometric login attempt started');
      track.userAction('button_press', 'biometric_login');
      
      const success = await authenticateWithBiometric();
      const duration = Date.now() - startTime;
      
      if (!success) {
        log.warning('Biometric authentication failed', { duration });
        track.event('auth.biometric_failed', {
          duration,
          reason: 'authentication_failed',
          timestamp: new Date().toISOString()
        });
        
        Alert.alert(t('alerts.authenticationFailed'), t('alerts.biometricFailed'));
      } else {
        log.info('Biometric authentication successful', { duration });
        track.event('auth.biometric_success', {
          duration,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      log.error('Biometric authentication error', error, { duration });
      track.error(error, 'biometric_authentication');
      
      Alert.alert(t('common.error'), t('alerts.biometricError'));
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
            <Text style={[styles.title, rtlText('center')]}>{t('screens.login.welcomeBack')}</Text>
            <Text style={[styles.subtitle, rtlText('center')]}>{t('screens.login.subtitle')}</Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="email"
              rules={{
                required: t('validation.emailRequired'),
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: t('validation.emailInvalid'),
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.email')}
                  placeholder={t('forms.placeholders.enterEmail')}
                  leftIcon="mail"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  textAlign={rtlText().textAlign}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              rules={{
                required: t('validation.passwordRequired'),
                minLength: {
                  value: 8,
                  message: t('validation.passwordMinLength'),
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.password')}
                  placeholder={t('forms.placeholders.enterPassword')}
                  leftIcon="lock-closed"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  isPassword
                  textAlign={rtlText().textAlign}
                />
              )}
            />

            <Button
              title={t('buttons.signIn')}
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              style={styles.loginButton}
            />

            {isBiometricEnabled && (
              <Button
                title={t('buttons.useBiometric')}
                onPress={handleBiometricLogin}
                variant="outline"
                style={styles.biometricButton}
              />
            )}

            <Button
              title={t('buttons.forgotPassword')}
              onPress={() => navigation.navigate('ForgotPassword')}
              variant="outline"
              style={styles.forgotButton}
            />
          </View>

          <View style={[styles.footer, rtlRow()]}>
            <Text style={[styles.footerText, rtlText()]}>{t('auth.dontHaveAccount')} </Text>
            <Button
              title={t('buttons.signUp')}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    ...StyleUtils.marginEnd(SPACING.sm),
  },
});

export default LoginScreen;