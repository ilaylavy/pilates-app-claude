import { apiClient } from './client';

export interface Attendee {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  booking_date: string;
  is_you?: boolean;
}

export interface Friend {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  email: string;
  friendship_since: string;
}

export interface PublicProfile {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  member_since: string;
  is_friend: boolean;
  stats?: {
    total_bookings: number;
  };
}

export interface PrivacySettings {
  show_in_attendees: boolean;
  allow_profile_viewing: boolean;
  show_stats: boolean;
}

export const socialApi = {
  // Friend management
  sendFriendRequest: async (friendId: number): Promise<{ success: boolean; friendship_id?: number; error?: string }> => {
    const response = await apiClient.post('/api/v1/social/friend-request', { friend_id: friendId });
    return response.data;
  },

  acceptFriendRequest: async (userId: number): Promise<{ success: boolean; error?: string }> => {
    const response = await apiClient.post(`/api/v1/social/friend-request/${userId}/accept`);
    return response.data;
  },

  rejectFriendRequest: async (userId: number): Promise<{ success: boolean; error?: string }> => {
    const response = await apiClient.delete(`/api/v1/social/friend-request/${userId}`);
    return response.data;
  },

  blockUser: async (userId: number): Promise<{ success: boolean; error?: string }> => {
    const response = await apiClient.post(`/api/v1/social/block/${userId}`);
    return response.data;
  },

  getFriends: async (): Promise<Friend[]> => {
    const response = await apiClient.get<Friend[]>('/api/v1/social/friends');
    return response.data;
  },

  getFriendRequests: async (): Promise<{ received: Friend[]; sent: Friend[] }> => {
    const response = await apiClient.get('/api/v1/social/friend-requests');
    return response.data;
  },

  // Class attendees
  getClassAttendees: async (classId: number): Promise<Attendee[]> => {
    const response = await apiClient.get<Attendee[]>(`/api/v1/social/classes/${classId}/attendees`);
    return response.data;
  },

  getFriendsInClass: async (classId: number): Promise<Friend[]> => {
    const response = await apiClient.get<Friend[]>(`/api/v1/social/classes/${classId}/friends`);
    return response.data;
  },

  // Class invitations
  inviteToClass: async (recipientId: number, classId: number): Promise<{ success: boolean; invitation_id?: number; error?: string }> => {
    const response = await apiClient.post('/api/v1/social/invite-to-class', {
      recipient_id: recipientId,
      class_id: classId,
    });
    return response.data;
  },

  // Public profiles
  getPublicProfile: async (userId: number): Promise<PublicProfile> => {
    const response = await apiClient.get<PublicProfile>(`/api/v1/social/users/${userId}/public-profile`);
    return response.data;
  },

  // Mutual classes
  getMutualClasses: async (friendId: number, limit = 10): Promise<any[]> => {
    const response = await apiClient.get(`/api/v1/social/mutual-classes/${friendId}?limit=${limit}`);
    return response.data;
  },

  // Privacy settings
  updatePrivacySettings: async (settings: PrivacySettings): Promise<{ success: boolean; privacy_settings: PrivacySettings }> => {
    const response = await apiClient.put('/api/v1/social/privacy-settings', settings);
    return response.data;
  },
};