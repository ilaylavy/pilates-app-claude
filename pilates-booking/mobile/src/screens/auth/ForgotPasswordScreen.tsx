import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { StackNavigationProp } from '@react-navigation/stack';

import { AuthStackParamList } from '../../navigation/Navigation';
import { COLORS, SPACING } from '../../utils/config';
import { useTranslation } from '../../hooks/useTranslation';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

type ForgotPasswordScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

interface Props {
  navigation: ForgotPasswordScreenNavigationProp;
}

interface FormData {
  email: string;
}

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { t, rtlText } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      // TODO: Implement forgot password API call
      Alert.alert(
        t('auth.resetLinkSent'),
        t('auth.resetLinkSentMessage'),
        [{ text: t('common.ok'), onPress: () => navigation.navigate('Login') }]
      );
    } catch (error: any) {
      Alert.alert(
        t('common.error'),
        t('auth.resetLinkError')
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, rtlText('center')]}>{t('auth.forgotPassword')}</Text>
          <Text style={[styles.subtitle, rtlText('center')]}>
            {t('auth.forgotPasswordMessage')}
          </Text>
        </View>

        <View style={styles.form}>
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

          <Button
            title={t('auth.sendResetLink')}
            onPress={handleSubmit(onSubmit)}
            loading={isLoading}
            style={styles.submitButton}
          />

          <Button
            title={t('auth.backToSignIn')}
            onPress={() => navigation.navigate('Login')}
            variant="outline"
            style={styles.backButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
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
    marginBottom: SPACING.md,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    marginBottom: SPACING.xl,
  },
  submitButton: {
    marginTop: SPACING.md,
  },
  backButton: {
    marginTop: SPACING.md,
  },
});

export default ForgotPasswordScreen;