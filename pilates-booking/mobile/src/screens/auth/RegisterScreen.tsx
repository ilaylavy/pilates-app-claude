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
import { useTranslation } from '../../hooks/useTranslation';
import { StyleUtils } from '../../utils/styleUtils';
import { AuthStackParamList } from '../../navigation/Navigation';
import { COLORS, SPACING } from '../../utils/config';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { RegisterRequest } from '../../types';

type RegisterScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
}

interface FormData {
  email: string;
  password: string;
  confirmPassword: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { t, rtlText, rtlRow } = useTranslation();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>();

  const password = watch('password');

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const { confirmPassword, ...registerData } = data;
      await register(registerData);
      
      Alert.alert(
        t('auth.registrationSuccessful'),
        t('auth.registrationSuccessMessage'),
        [{ text: t('common.ok'), onPress: () => navigation.navigate('Login') }]
      );
    } catch (error: any) {
      Alert.alert(
        t('auth.registrationFailed'),
        error?.response?.data?.detail || t('auth.registrationError')
      );
    } finally {
      setIsLoading(false);
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
            <Text style={[styles.title, rtlText('center')]}>{t('auth.createAccount')}</Text>
            <Text style={[styles.subtitle, rtlText('center')]}>{t('auth.joinCommunity')}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.nameRow}>
              <Controller
                control={control}
                name="first_name"
                rules={{ required: t('auth.firstNameRequired') }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('auth.firstName')}
                    placeholder={t('auth.firstNamePlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.first_name?.message}
                    style={styles.nameInput}
                  />
                )}
              />

              <Controller
                control={control}
                name="last_name"
                rules={{ required: t('auth.lastNameRequired') }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={t('auth.lastName')}
                    placeholder={t('auth.lastNamePlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.last_name?.message}
                    style={styles.nameInput}
                  />
                )}
              />
            </View>

            <Controller
              control={control}
              name="email"
              rules={{
                required: t('auth.emailRequired'),
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: t('auth.invalidEmailAddress'),
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.email')}
                  placeholder={t('auth.emailPlaceholder')}
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
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.phoneOptional')}
                  placeholder={t('auth.phonePlaceholder')}
                  leftIcon="call"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="phone-pad"
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              rules={{
                required: t('auth.passwordRequired'),
                minLength: {
                  value: 8,
                  message: t('auth.passwordMinLength'),
                },
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: t('auth.passwordComplexity'),
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.password')}
                  placeholder={t('auth.passwordPlaceholder')}
                  leftIcon="lock-closed"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  isPassword
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              rules={{
                required: t('auth.confirmPasswordRequired'),
                validate: (value) =>
                  value === password || t('auth.passwordsDoNotMatch'),
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.confirmPassword')}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  leftIcon="lock-closed"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.confirmPassword?.message}
                  isPassword
                />
              )}
            />

            <Button
              title={t('auth.createAccount')}
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              style={styles.registerButton}
            />
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, rtlText()]}>{t('auth.alreadyHaveAccount')} </Text>
            <Button
              title={t('auth.signIn')}
              onPress={() => navigation.navigate('Login')}
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
    marginBottom: SPACING.xl,
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
  nameRow: {
    ...StyleUtils.flexDirection('row'),
    justifyContent: 'space-between',
  },
  nameInput: {
    flex: 0.48,
  },
  registerButton: {
    marginTop: SPACING.md,
  },
  footer: {
    ...StyleUtils.flexDirection('row'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    ...StyleUtils.marginEnd(SPACING.sm),
  },
});

export default RegisterScreen;