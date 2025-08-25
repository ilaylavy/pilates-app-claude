import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../utils/config';

export interface Announcement {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  created_at: string;
  expires_at?: string;
  is_dismissible: boolean;
}

interface AnnouncementBannerProps {
  announcements: Announcement[];
  onDismiss?: (announcementId: number) => void;
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ 
  announcements,
  onDismiss 
}) => {
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);

  const getTypeConfig = (type: Announcement['type']) => {
    switch (type) {
      case 'urgent':
        return {
          backgroundColor: COLORS.error + '15',
          borderColor: COLORS.error,
          iconColor: COLORS.error,
          icon: 'alert-circle' as const,
        };
      case 'warning':
        return {
          backgroundColor: COLORS.warning + '15',
          borderColor: COLORS.warning,
          iconColor: COLORS.warning,
          icon: 'warning' as const,
        };
      case 'success':
        return {
          backgroundColor: COLORS.success + '15',
          borderColor: COLORS.success,
          iconColor: COLORS.success,
          icon: 'checkmark-circle' as const,
        };
      default:
        return {
          backgroundColor: COLORS.primary + '15',
          borderColor: COLORS.primary,
          iconColor: COLORS.primary,
          icon: 'information-circle' as const,
        };
    }
  };

  const handleDismiss = (announcementId: number) => {
    setDismissedIds(prev => [...prev, announcementId]);
    onDismiss?.(announcementId);
  };

  const visibleAnnouncements = announcements.filter(
    announcement => !dismissedIds.includes(announcement.id)
  );

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {visibleAnnouncements.map((announcement) => {
        const config = getTypeConfig(announcement.type);
        
        return (
          <View
            key={announcement.id}
            style={[
              styles.announcementContainer,
              {
                backgroundColor: config.backgroundColor,
                borderLeftColor: config.borderColor,
              }
            ]}
          >
            <View style={styles.iconContainer}>
              <Ionicons 
                name={config.icon} 
                size={20} 
                color={config.iconColor} 
              />
            </View>
            
            <View style={styles.contentContainer}>
              <Text style={styles.title}>{announcement.title}</Text>
              <Text style={styles.message}>{announcement.message}</Text>
            </View>
            
            {announcement.is_dismissible && (
              <TouchableOpacity
                onPress={() => handleDismiss(announcement.id)}
                style={styles.dismissButton}
              >
                <Ionicons name="close" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
  },
  announcementContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    borderLeftWidth: 4,
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  message: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  dismissButton: {
    marginLeft: SPACING.sm,
    padding: SPACING.xs,
  },
});

export default AnnouncementBanner;