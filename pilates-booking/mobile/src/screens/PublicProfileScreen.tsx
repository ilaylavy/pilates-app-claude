import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import type { RouteProp } from '@react-navigation/native';

import { COLORS, SPACING } from '../utils/config';
import { socialApi, PublicProfile } from '../api/social';
import AttendeeAvatars from '../components/AttendeeAvatars';

interface RouteParams {
  userId: number;
}

type PublicProfileScreenRouteProp = RouteProp<{ params: RouteParams }, 'params'>;

const PublicProfileScreen: React.FC = () => {
  const route = useRoute<PublicProfileScreenRouteProp>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { userId } = route.params;

  // Fetch public profile
  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['public-profile', userId],
    queryFn: () => socialApi.getPublicProfile(userId),
  });

  // Fetch mutual classes if friends
  const {
    data: mutualClasses = [],
  } = useQuery({
    queryKey: ['mutual-classes', userId],
    queryFn: () => socialApi.getMutualClasses(userId),
    enabled: !!profile?.is_friend,
  });

  // Send friend request mutation
  const sendFriendRequestMutation = useMutation({
    mutationFn: () => socialApi.sendFriendRequest(userId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['public-profile', userId] });
        queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
        Alert.alert('Success', 'Friend request sent!');
      } else {
        Alert.alert('Error', result.error || 'Failed to send friend request');
      }
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to send friend request');
    },
  });

  const handleSendFriendRequest = () => {
    Alert.alert(
      'Send Friend Request',
      `Send a friend request to ${profile?.first_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: () => sendFriendRequestMutation.mutate() },
      ]
    );
  };

  const formatMemberSince = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const renderMutualClass = ({ item }: { item: any }) => (
    <View style={styles.mutualClassItem}>
      <View style={styles.mutualClassInfo}>
        <Text style={styles.mutualClassName}>{item.name}</Text>
        <Text style={styles.mutualClassDate}>
          {new Date(item.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
        <Text style={styles.mutualClassInstructor}>
          with {item.instructor_name}
        </Text>
      </View>
      <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerActions} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerActions} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="person-circle-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.errorText}>Profile not available</Text>
          <Text style={styles.errorSubtext}>
            This user's profile is private or doesn't exist
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerActions}>
          {!profile.is_friend && (
            <TouchableOpacity
              style={styles.headerAction}
              onPress={handleSendFriendRequest}
              disabled={sendFriendRequestMutation.isPending}
            >
              <Ionicons name="person-add" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {profile.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {profile.first_name[0]}{profile.last_name[0]}
                </Text>
              </View>
            )}
          </View>
          
          <Text style={styles.profileName}>
            {profile.first_name} {profile.last_name}
          </Text>
          
          {profile.is_friend && (
            <View style={styles.friendBadge}>
              <Ionicons name="people" size={16} color={COLORS.white} />
              <Text style={styles.friendBadgeText}>Friend</Text>
            </View>
          )}

          <Text style={styles.memberSince}>
            Member since {formatMemberSince(profile.member_since)}
          </Text>
        </View>

        {/* Stats Section */}
        {profile.stats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stats</Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{profile.stats.total_bookings}</Text>
                <Text style={styles.statLabel}>Total Classes</Text>
              </View>
              {/* Add more stats as needed */}
            </View>
          </View>
        )}

        {/* Mutual Classes */}
        {profile.is_friend && mutualClasses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Classes Attended Together</Text>
            <FlatList
              data={mutualClasses}
              renderItem={renderMutualClass}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {!profile.is_friend ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={handleSendFriendRequest}
              disabled={sendFriendRequestMutation.isPending}
            >
              <Ionicons name="person-add" size={20} color={COLORS.white} />
              <Text style={styles.primaryButtonText}>
                {sendFriendRequestMutation.isPending ? 'Sending...' : 'Add Friend'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={() => {
                // TODO: Navigate to message screen
                Alert.alert('Message', 'Messaging feature coming soon!');
              }}
            >
              <Ionicons name="chatbubble" size={20} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>Message</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <Ionicons name="shield-checkmark" size={16} color={COLORS.textSecondary} />
          <Text style={styles.privacyText}>
            Only public information is shown. Some details may be hidden based on privacy settings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  headerAction: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  profileHeader: {
    backgroundColor: COLORS.white,
    padding: SPACING.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  avatarContainer: {
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  },
  friendBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  memberSince: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  section: {
    backgroundColor: COLORS.white,
    marginTop: SPACING.sm,
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  mutualClassItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  mutualClassInfo: {
    flex: 1,
  },
  mutualClassName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  mutualClassDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  mutualClassInstructor: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  actionsContainer: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
    gap: SPACING.sm,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

export default PublicProfileScreen;