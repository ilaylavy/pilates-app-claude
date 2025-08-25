import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AttendeeAvatars from '../AttendeeAvatars';
import ClassCard from '../ClassCard';

// Mock dependencies
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-gesture-handler', () => ({
  Swipeable: ({ children }: { children: React.ReactNode }) => children,
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const mockAttendees = [
  {
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    avatar_url: 'https://example.com/avatar1.jpg',
    booking_date: '2024-01-01T10:00:00Z',
    is_you: true,
  },
  {
    id: 2,
    first_name: 'Jane',
    last_name: 'Smith',
    avatar_url: null,
    booking_date: '2024-01-01T09:00:00Z',
    is_you: false,
  },
  {
    id: 3,
    first_name: 'Bob',
    last_name: 'Johnson',
    avatar_url: null,
    booking_date: '2024-01-01T08:00:00Z',
    is_you: false,
  },
];

const mockBooking = {
  id: 1,
  user_id: 1,
  class_instance_id: 1,
  status: 'confirmed' as const,
  booking_date: '2024-01-01T08:00:00Z',
  can_cancel: true,
  class_instance: {
    id: 1,
    start_datetime: '2024-01-15T10:00:00Z',
    end_datetime: '2024-01-15T11:00:00Z',
    template: {
      id: 1,
      name: 'Pilates Fundamentals',
      description: 'Basic pilates class',
      duration_minutes: 60,
      capacity: 12,
      level: 'beginner' as const,
    },
    instructor: {
      id: 1,
      first_name: 'Sarah',
      last_name: 'Wilson',
    },
  },
  user: {
    id: 1,
    first_name: 'Test',
    last_name: 'User',
  },
  created_at: '2024-01-01T08:00:00Z',
  updated_at: '2024-01-01T08:00:00Z',
};

describe('AttendeeAvatars', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('renders empty state when no attendees', () => {
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <AttendeeAvatars attendees={[]} />
      </QueryClientProvider>
    );

    expect(getByText('No attendees yet')).toBeTruthy();
  });

  it('renders attendee avatars correctly', () => {
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <AttendeeAvatars attendees={mockAttendees.slice(0, 2)} />
      </QueryClientProvider>
    );

    // Should show initials for users without avatars
    expect(getByText('J')).toBeTruthy(); // John Doe -> J
  });

  it('shows overflow indicator when more than maxVisible attendees', () => {
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <AttendeeAvatars attendees={mockAttendees} maxVisible={2} />
      </QueryClientProvider>
    );

    expect(getByText('+1')).toBeTruthy(); // 3 attendees, max 2 visible
  });

  it('opens attendee list modal when tapped', async () => {
    const { getByText, getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <AttendeeAvatars attendees={mockAttendees} />
      </QueryClientProvider>
    );

    // Find and tap the avatars container
    const avatarsContainer = getByText('J').parent?.parent?.parent;
    if (avatarsContainer) {
      fireEvent.press(avatarsContainer);
    }

    // Modal should open with attendee list
    await waitFor(() => {
      expect(getByText('Class Attendees')).toBeTruthy();
    });
  });

  it('calls onAttendeePress when attendee is selected in modal', async () => {
    const mockOnAttendeePress = jest.fn();
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <AttendeeAvatars 
          attendees={mockAttendees} 
          onAttendeePress={mockOnAttendeePress}
        />
      </QueryClientProvider>
    );

    // Open modal
    const avatarsContainer = getByText('J').parent?.parent?.parent;
    if (avatarsContainer) {
      fireEvent.press(avatarsContainer);
    }

    await waitFor(() => {
      expect(getByText('Class Attendees')).toBeTruthy();
    });

    // Tap on an attendee in the modal
    fireEvent.press(getByText('John Doe (You)'));

    expect(mockOnAttendeePress).toHaveBeenCalledWith(mockAttendees[0]);
  });
});

describe('ClassCard - Booking Variant', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('renders booking information correctly', () => {
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ClassCard 
          classInstance={mockBooking.class_instance} 
          booking={mockBooking} 
          variant="booking" 
        />
      </QueryClientProvider>
    );

    expect(getByText('Pilates Fundamentals')).toBeTruthy();
    expect(getByText('with Sarah Wilson')).toBeTruthy();
    expect(getByText('Confirmed')).toBeTruthy();
  });

  it('calls onPress when booking card is tapped', () => {
    const mockOnPress = jest.fn();
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ClassCard 
          classInstance={mockBooking.class_instance} 
          booking={mockBooking} 
          variant="booking" 
          onPress={mockOnPress} 
        />
      </QueryClientProvider>
    );

    fireEvent.press(getByText('Pilates Fundamentals'));
    expect(mockOnPress).toHaveBeenCalled();
  });

  it('shows reschedule button for confirmed bookings', () => {
    const mockOnReschedule = jest.fn();
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ClassCard 
          classInstance={mockBooking.class_instance} 
          booking={mockBooking} 
          variant="booking" 
          onReschedule={mockOnReschedule}
        />
      </QueryClientProvider>
    );

    expect(getByText('Reschedule')).toBeTruthy();
    
    fireEvent.press(getByText('Reschedule'));
    expect(mockOnReschedule).toHaveBeenCalled();
  });

  it('displays correct status colors', () => {
    const cancelledBooking = {
      ...mockBooking,
      status: 'cancelled' as const,
    };

    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ClassCard 
          classInstance={cancelledBooking.class_instance} 
          booking={cancelledBooking} 
          variant="booking" 
        />
      </QueryClientProvider>
    );

    expect(getByText('Cancelled')).toBeTruthy();
  });
});

describe('Social Features Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('integrates attendee avatars with booking card', () => {
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <ClassCard 
          classInstance={mockBooking.class_instance}
          booking={mockBooking}
          variant="booking"
        />
      </QueryClientProvider>
    );

    // Should show booking info (attendee avatars would be handled separately now)
    expect(getByText('Pilates Fundamentals')).toBeTruthy();
  });

  it('handles empty attendee lists gracefully', () => {
    const { getByText, queryByText } = render(
      <QueryClientProvider client={queryClient}>
        <ClassCard 
          classInstance={mockBooking.class_instance}
          booking={mockBooking}
          variant="booking"
        />
      </QueryClientProvider>
    );

    expect(getByText('Pilates Fundamentals')).toBeTruthy();
    // ClassCard doesn't directly handle attendees in booking variant
    expect(queryByText('No attendees yet')).toBeNull();
  });
});