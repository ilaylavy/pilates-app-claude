import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Dimensions,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { COLORS, SPACING } from '../utils/config';
import Button from '../components/common/Button';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import AvatarUpload from '../components/AvatarUpload';
import { useUserRole } from '../hooks/useUserRole';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface UserStats {
  total_bookings: number;
  bookings_this_month: number;
  attendance_rate: number;
  member_since: string;
}

const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [showAvatarUpload, setShowAvatarUpload] = useState(false);

  const { data: userStats } = useQuery<UserStats>({
    queryKey: ['user-stats'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/users/me/stats');
      return response.data;
    },
  });

  const { data: upcomingClasses } = useQuery({
    queryKey: ['upcoming-classes'],
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/bookings/my-bookings?status=confirmed&upcoming=true&limit=3');
      return response.data;
    },
  });

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout }
      ]
    );
  };

  const handleAvatarPress = () => {
    setShowAvatarUpload(true);
  };

  const handleNavigation = (screen: string) => {
    navigation.navigate(screen as never);
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarContainer}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {getInitials(user?.first_name, user?.last_name)}
                </Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={16} color={COLORS.background} />
            </View>
          </TouchableOpacity>
          
          <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
          <Text style={styles.memberSince}>
            Member since {userStats ? formatDate(userStats.member_since) : ''}
          </Text>
          
          {/* Quick Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userStats?.bookings_this_month || 0}</Text>
              <Text style={styles.statLabel}>This Month</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userStats?.total_bookings || 0}</Text>
              <Text style={styles.statLabel}>Total Classes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userStats?.attendance_rate || 0}%</Text>
              <Text style={styles.statLabel}>Attendance</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.editButton} onPress={() => handleNavigation('EditProfile')}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
        
        {/* Action Buttons */}
        <View style={styles.actionGrid}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleNavigation('Packages')}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="card" size={24} color={COLORS.primary} />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>8</Text>
              </View>
            </View>
            <Text style={styles.actionText}>My Packages</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleNavigation('BookingHistory')}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="time" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.actionText}>Booking History</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => handleNavigation('Settings')}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="settings" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.actionText}>Settings</Text>
          </TouchableOpacity>
          
          {isAdmin && (
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => handleNavigation('AdminPackages')}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="briefcase" size={24} color={COLORS.accent} />
              </View>
              <Text style={[styles.actionText, { color: COLORS.accent }]}>Manage Packages</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Upcoming Classes */}
        {upcomingClasses && upcomingClasses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Classes</Text>
            {upcomingClasses.slice(0, 3).map((booking: any) => (
              <View key={booking.id} style={styles.classItem}>
                <View style={styles.classInfo}>
                  <Text style={styles.className}>
                    {booking?.class_instance?.class_template?.name || 'Class Name'}
                  </Text>
                  <Text style={styles.classDate}>
                    {booking?.class_instance?.start_time ? (
                      `${new Date(booking.class_instance.start_time).toLocaleDateString()} at ${new Date(booking.class_instance.start_time).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}`
                    ) : 'Date TBD'}
                  </Text>
                  <Text style={styles.classInstructor}>
                    with {booking?.class_instance?.instructor?.full_name || 'Instructor TBD'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              </View>
            ))}
          </View>
        )}
        
        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <Button
            title="Logout"
            onPress={handleLogout}
            variant="danger"
          />
        </View>
      </ScrollView>
      
      {showAvatarUpload && (
        <AvatarUpload
          visible={showAvatarUpload}
          onClose={() => setShowAvatarUpload(false)}
          onUpload={(avatarUrl: string) => {
            // Refresh user data and close modal
            queryClient.invalidateQueries({ queryKey: ['user'] });
            setShowAvatarUpload(false);
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.card,
    marginBottom: SPACING.md,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
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
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  memberSince: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  editButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 20,
  },
  editButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  actionButton: {
    width: (width - SPACING.lg * 3) / 2,
    aspectRatio: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionIconContainer: {
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  classItem: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  classDate: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  classInstructor: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  logoutContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
});

export default ProfileScreen;