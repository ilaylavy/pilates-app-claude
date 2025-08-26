import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING } from '../utils/config';
import { SUPPORTED_LOCALES, LocaleConfig } from '../i18n/config';
import { useLanguage } from '../contexts/LanguageContext';
import { useLogging } from '../hooks/useLogging';
import { StyleUtils } from '../utils/styleUtils';

interface LanguageSwitcherProps {
  style?: any;
  showLabel?: boolean;
  variant?: 'inline' | 'modal';
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  style,
  showLabel = true,
  variant = 'inline',
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const queryClient = useQueryClient();
  const { log, track } = useLogging('LanguageSwitcher');
  const { currentLanguage, currentLocale, changeLanguage, t } = useLanguage();

  const handleLanguageChange = async (localeCode: string) => {
    if (localeCode === currentLanguage) return;

    try {
      log.info('Language change initiated', { 
        from: currentLanguage, 
        to: localeCode 
      });
      
      track.userAction('language_change', 'settings', {
        from: currentLanguage,
        to: localeCode,
      });

      // Use the LanguageContext to change language - no popups, instant switching
      await changeLanguage(localeCode);
      
      // Invalidate all cached queries to refresh with new language
      queryClient.invalidateQueries();
      
      setModalVisible(false);

      log.info('Language changed successfully', { 
        newLanguage: localeCode,
        isRTL: SUPPORTED_LOCALES[localeCode].isRTL 
      });

    } catch (error) {
      log.error('Language change failed', error, { targetLanguage: localeCode });
      track.error(error, 'language_change');
    }
  };

  const renderLanguageItem = ({ item }: { item: LocaleConfig }) => (
    <Pressable
      style={[
        styles.languageItem,
        item.code === currentLanguage && styles.selectedLanguageItem,
      ]}
      onPress={() => handleLanguageChange(item.code)}
    >
      <View style={styles.languageInfo}>
        <Text style={styles.languageName}>{item.name}</Text>
        <Text style={styles.languageCode}>{item.code.toUpperCase()}</Text>
      </View>
      {item.code === currentLanguage && (
        <Ionicons name="checkmark" size={20} color={COLORS.primary} />
      )}
    </Pressable>
  );

  if (variant === 'modal') {
    return (
      <>
        <TouchableOpacity
          style={[styles.container, style]}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="language" size={20} color={COLORS.primary} />
          {showLabel && (
            <Text style={styles.label}>
              {currentLocale?.name || t('profile.language')}
            </Text>
          )}
          <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <Modal
          visible={modalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.language')}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={Object.values(SUPPORTED_LOCALES)}
              keyExtractor={(item) => item.code}
              renderItem={renderLanguageItem}
              style={styles.languageList}
            />
          </View>
        </Modal>
      </>
    );
  }

  // Inline variant
  return (
    <View style={[styles.inlineContainer, style]}>
      {Object.values(SUPPORTED_LOCALES).map((locale) => (
        <TouchableOpacity
          key={locale.code}
          style={[
            styles.languageButton,
            locale.code === currentLanguage && styles.selectedLanguageButton,
          ]}
          onPress={() => handleLanguageChange(locale.code)}
        >
          <Text
            style={[
              styles.languageButtonText,
              locale.code === currentLanguage && styles.selectedLanguageButtonText,
            ]}
          >
            {locale.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleUtils.flexDirection('row'),
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  label: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    ...StyleUtils.marginStart(SPACING.sm),
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    ...StyleUtils.flexDirection('row'),
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  languageList: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  languageItem: {
    ...StyleUtils.flexDirection('row'),
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '30',
  },
  selectedLanguageItem: {
    backgroundColor: COLORS.primary + '10',
    borderRadius: 12,
    borderBottomWidth: 0,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  languageCode: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  inlineContainer: {
    ...StyleUtils.flexDirection('row'),
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.xs,
  },
  languageButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedLanguageButton: {
    backgroundColor: COLORS.primary,
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  selectedLanguageButtonText: {
    color: COLORS.surface,
  },
});

export default LanguageSwitcher;