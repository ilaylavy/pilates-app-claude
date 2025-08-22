import React from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';

interface Attendee {
  id: number;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  is_you?: boolean;
  booking_date: string;
}

interface AttendeeAvatarsProps {
  attendees: Attendee[];
  maxVisible?: number;
  size?: number;
  onAttendeePress?: (attendee: Attendee) => void;
}

const getAvatarColor = (userId: number): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  return colors[userId % colors.length];
};

const AttendeeAvatar: React.FC<{
  attendee: Attendee;
  size: number;
  showBadge?: boolean;
  onPress?: () => void;
}> = ({ attendee, size, showBadge = false, onPress }) => {
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const renderAvatar = () => {
    if (attendee.avatar_url) {
      return (
        <Image
          source={{ uri: attendee.avatar_url }}
          style={[avatarStyle, styles.avatarImage]}
          contentFit="cover"
        />
      );
    } else {
      return (
        <View
          style={[
            avatarStyle,
            styles.avatarPlaceholder,
            { backgroundColor: getAvatarColor(attendee.id) }
          ]}
        >
          <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
            {attendee.first_name[0].toUpperCase()}
          </Text>
        </View>
      );
    }
  };

  return (
    <TouchableOpacity onPress={onPress} style={styles.avatarContainer}>
      {renderAvatar()}
      {showBadge && attendee.is_you && (
        <View style={styles.youBadge}>
          <Text style={styles.youBadgeText}>You</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const AttendeeListModal: React.FC<{
  visible: boolean;
  attendees: Attendee[];
  onClose: () => void;
  onAttendeePress?: (attendee: Attendee) => void;
}> = ({ visible, attendees, onClose, onAttendeePress }) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredAttendees = React.useMemo(() => {
    if (!searchQuery) return attendees;
    
    return attendees.filter(attendee =>
      `${attendee.first_name} ${attendee.last_name}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );
  }, [attendees, searchQuery]);

  const renderAttendeeItem = ({ item }: { item: Attendee }) => (
    <TouchableOpacity
      style={styles.attendeeItem}
      onPress={() => onAttendeePress?.(item)}
    >
      <AttendeeAvatar attendee={item} size={40} showBadge />
      <View style={styles.attendeeInfo}>
        <Text style={styles.attendeeName}>
          {item.first_name} {item.last_name}
          {item.is_you ? ' (You)' : ''}
        </Text>
        <Text style={styles.bookingDate}>
          Booked: {new Date(item.booking_date).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Class Attendees</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search attendees..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          data={filteredAttendees}
          renderItem={renderAttendeeItem}
          keyExtractor={(item) => item.id.toString()}
          style={styles.attendeesList}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
  );
};

const AttendeeAvatars: React.FC<AttendeeAvatarsProps> = ({
  attendees,
  maxVisible = 5,
  size = 32,
  onAttendeePress,
}) => {
  const [showModal, setShowModal] = React.useState(false);

  const visibleAttendees = attendees.slice(0, maxVisible);
  const remainingCount = Math.max(0, attendees.length - maxVisible);

  const handleAvatarPress = () => {
    setShowModal(true);
  };

  if (attendees.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No attendees yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.avatarsRow}
        onPress={handleAvatarPress}
        activeOpacity={0.7}
      >
        {visibleAttendees.map((attendee, index) => (
          <View
            key={attendee.id}
            style={[
              styles.avatarWrapper,
              { marginLeft: index > 0 ? -8 : 0 }
            ]}
          >
            <AttendeeAvatar
              attendee={attendee}
              size={size}
              showBadge={index === 0}
            />
          </View>
        ))}
        
        {remainingCount > 0 && (
          <View
            style={[
              styles.moreIndicator,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                marginLeft: -8
              }
            ]}
          >
            <Text style={[styles.moreText, { fontSize: size * 0.35 }]}>
              +{remainingCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <AttendeeListModal
        visible={showModal}
        attendees={attendees}
        onClose={() => setShowModal(false)}
        onAttendeePress={onAttendeePress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 8,
  },
  emptyText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarWrapper: {
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 20,
  },
  avatarImage: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  youBadge: {
    position: 'absolute',
    bottom: -5,
    left: -2,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  youBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  moreIndicator: {
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  moreText: {
    color: '#666',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  attendeesList: {
    flex: 1,
  },
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  attendeeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  attendeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  bookingDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});

export default AttendeeAvatars;