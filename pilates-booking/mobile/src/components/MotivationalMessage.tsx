import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';
import { useTranslation } from '../hooks/useTranslation';

interface MotivationalMessageProps {
  message?: string;
  type?: 'quote' | 'tip' | 'reminder';
}

const MotivationalMessage: React.FC<MotivationalMessageProps> = ({ 
  message,
  type = 'quote' 
}) => {
  const { t, rtlText, isRTL } = useTranslation();
  
  const defaultMessages = {
    quote: [
      t('motivational.quotes.stronger'),
      t('motivational.quotes.progress'),
      t('motivational.quotes.mind'),
      t('motivational.quotes.consistency'),
      t('motivational.quotes.strong')
    ],
    tip: [
      t('motivational.tips.arrive'),
      t('motivational.tips.breath'),
      t('motivational.tips.listen'),
      t('motivational.tips.hydrate'),
      t('motivational.tips.longterm')
    ],
    reminder: [
      t('motivational.reminders.bookEarly'),
      t('motivational.reminders.cancelPolicy'),
      t('motivational.reminders.goalCheck'),
      t('motivational.reminders.appreciate'),
      t('motivational.reminders.trackProgress')
    ]
  };

  const displayMessage = message || defaultMessages[type][
    Math.floor(Math.random() * defaultMessages[type].length)
  ];

  const getIcon = () => {
    switch (type) {
      case 'tip': return 'bulb';
      case 'reminder': return 'notifications';
      default: return 'star';
    }
  };

  return (
    <View style={[styles.container, isRTL && styles.containerRTL]}>
      <View style={styles.iconContainer}>
        <Ionicons name={getIcon()} size={16} color={COLORS.primary} />
      </View>
      <Text style={[styles.message, rtlText()]}>{displayMessage}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.primary + '10',
    padding: SPACING.md,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  containerRTL: {
    flexDirection: 'row-reverse',
    borderLeftWidth: 0,
    borderRightWidth: 3,
    borderRightColor: COLORS.primary,
  },
  iconContainer: {
    marginRight: SPACING.sm,
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

export default MotivationalMessage;