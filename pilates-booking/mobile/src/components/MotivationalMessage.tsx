import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';

interface MotivationalMessageProps {
  message?: string;
  type?: 'quote' | 'tip' | 'reminder';
}

const MotivationalMessage: React.FC<MotivationalMessageProps> = ({ 
  message,
  type = 'quote' 
}) => {
  const defaultMessages = {
    quote: [
      "Every workout is a step towards a stronger you! 💪",
      "Progress, not perfection. Keep showing up! ✨",
      "Your body can do it. It's your mind you need to convince! 🧠",
      "Consistency is the key to transformation! 🔑",
      "Strong is the new beautiful! 🌟"
    ],
    tip: [
      "💡 Tip: Arrive 5 minutes early to center yourself",
      "💡 Tip: Focus on your breath during challenging poses",
      "💡 Tip: Listen to your body and modify as needed",
      "💡 Tip: Stay hydrated before and after class",
      "💡 Tip: Consistency beats intensity for long-term results"
    ],
    reminder: [
      "📅 Remember: Book early to secure your favorite time slots",
      "⏰ Reminder: Cancel 2+ hours in advance to avoid fees",
      "🎯 Goal check: How are you progressing this month?",
      "🧘‍♀️ Take a moment to appreciate your commitment",
      "📈 Track your progress - small wins add up!"
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
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={getIcon()} size={16} color={COLORS.primary} />
      </View>
      <Text style={styles.message}>{displayMessage}</Text>
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