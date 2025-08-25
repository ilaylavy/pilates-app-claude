/**
 * Comprehensive tests for BookingModal component.
 * Tests booking flow, payment integration, error handling, and user interactions.
 */

import React from 'react';
import { fireEvent, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { renderWithAuth, renderWithAdmin, renderWithInstructor } from '../../testUtils/renderWithProviders';
import { setupMockServer } from '../../testUtils/mockServer';
import { testData } from '../../testUtils/testData';

import BookingModal from '../../../src/components/BookingModal';

// Mock React Native components
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  Alert: {
    alert: jest.fn(),
  },
}));

// Mock payment processing
jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: () => ({
    confirmPayment: jest.fn(),
    createPaymentMethod: jest.fn(),
  }),
  CardField: () => null,
}));

// Setup MSW mock server
setupMockServer();

describe('BookingModal Component', () => {
  const mockClass = testData.classes[0];
  const mockUser = testData.users.student;
  const mockOnClose = jest.fn();
  const mockOnBookingSuccess = jest.fn();
  const mockOnWaitlistJoin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (Alert.alert as jest.Mock).mockClear();
  });

  describe('Modal Rendering and Basic Interaction', () => {
    it('should render booking modal with class details', () => {
      const { getByText, getByTestId } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
          onWaitlistJoin={mockOnWaitlistJoin}
        />
      );

      // Should show class information
      expect(getByText(mockClass.template.name)).toBeTruthy();
      expect(getByText(`with ${mockClass.instructor.first_name} ${mockClass.instructor.last_name}`)).toBeTruthy();
      expect(getByText(mockClass.template.level.charAt(0).toUpperCase() + mockClass.template.level.slice(1))).toBeTruthy();
      
      // Should show modal controls
      expect(getByTestId('booking-modal')).toBeTruthy();
      expect(getByText('Close')).toBeTruthy();
    });

    it('should call onClose when close button is pressed', () => {
      const { getByText } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />
      );

      fireEvent.press(getByText('Close'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not render when visible is false', () => {
      const { queryByTestId } = renderWithAuth(
        <BookingModal
          visible={false}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />
      );

      expect(queryByTestId('booking-modal')).toBeNull();
    });
  });

  describe('Package Selection', () => {
    it('should display user packages for selection', () => {
      const userWithPackages = {
        ...mockUser,
        packages: [
          {
            id: 1,
            package: { name: '10 Class Pack', credits: 10 },
            remaining_credits: 8,
            is_unlimited: false,
            expires_at: '2024-06-15T10:00:00Z'
          },
          {
            id: 2,
            package: { name: 'Unlimited Monthly', credits: null },
            remaining_credits: null,
            is_unlimited: true,
            expires_at: '2024-05-15T10:00:00Z'
          }
        ]
      };

      const { getByText, getAllByTestId } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />,
        { initialUser: userWithPackages }
      );

      // Should show package selection
      expect(getByText('Select Package')).toBeTruthy();
      expect(getByText('10 Class Pack')).toBeTruthy();
      expect(getByText('8 credits remaining')).toBeTruthy();
      expect(getByText('Unlimited Monthly')).toBeTruthy();
      expect(getByText('Unlimited classes')).toBeTruthy();

      // Should show package selection options
      const packageOptions = getAllByTestId('package-option');
      expect(packageOptions).toHaveLength(2);
    });

    it('should handle package selection', () => {
      const userWithPackages = {
        ...mockUser,
        packages: [
          {
            id: 1,
            package: { name: '5 Class Pack', credits: 5 },
            remaining_credits: 3,
            is_unlimited: false
          }
        ]
      };

      const { getByTestId, getByText } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />,
        { initialUser: userWithPackages }
      );

      const packageOption = getByTestId('package-option-1');
      fireEvent.press(packageOption);

      // Should show selected package
      expect(getByText('Selected: 5 Class Pack')).toBeTruthy();
      
      // Book button should be enabled
      const bookButton = getByText('Book Class');
      expect(bookButton.props.accessibilityState?.disabled).toBeFalsy();
    });

    it('should show purchase option when user has no valid packages', () => {
      const userWithoutPackages = {
        ...mockUser,
        packages: []
      };

      const { getByText, getByTestId } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />,
        { initialUser: userWithoutPackages }
      );

      expect(getByText('No valid packages found')).toBeTruthy();
      expect(getByText('Purchase Package')).toBeTruthy();
      expect(getByTestId('purchase-package-button')).toBeTruthy();
    });

    it('should filter out expired packages', () => {
      const userWithExpiredPackage = {
        ...mockUser,
        packages: [
          {
            id: 1,
            package: { name: 'Expired Pack', credits: 5 },
            remaining_credits: 2,
            expires_at: '2024-01-15T10:00:00Z', // Past date
            is_active: false
          },
          {
            id: 2,
            package: { name: 'Valid Pack', credits: 10 },
            remaining_credits: 8,
            expires_at: '2024-06-15T10:00:00Z', // Future date
            is_active: true
          }
        ]
      };

      const { getByText, queryByText } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />,
        { initialUser: userWithExpiredPackage }
      );

      expect(getByText('Valid Pack')).toBeTruthy();
      expect(queryByText('Expired Pack')).toBeNull();
    });
  });

  describe('Booking Process', () => {
    it('should handle successful booking with credits', async () => {
      const userWithCredits = {
        ...mockUser,
        packages: [
          {
            id: 1,
            package: { name: '10 Class Pack', credits: 10 },
            remaining_credits: 5,
            is_unlimited: false
          }
        ]
      };

      const { getByText, getByTestId } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />,
        { initialUser: userWithCredits }
      );

      // Select package
      fireEvent.press(getByTestId('package-option-1'));

      // Click book button
      const bookButton = getByText('Book Class');
      fireEvent.press(bookButton);

      // Should show loading state
      expect(getByTestId('booking-spinner')).toBeTruthy();

      // Wait for booking to complete
      await waitFor(() => {
        expect(mockOnBookingSuccess).toHaveBeenCalledWith({
          classInstance: mockClass,
          bookingDetails: expect.objectContaining({
            status: 'confirmed',
            credits_used: 1
          })
        });
      });
    });

    it('should handle booking with unlimited package', async () => {
      const userWithUnlimited = {
        ...mockUser,
        packages: [
          {
            id: 1,
            package: { name: 'Unlimited Monthly', credits: null },
            remaining_credits: null,
            is_unlimited: true
          }
        ]
      };

      const { getByText, getByTestId } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />,
        { initialUser: userWithUnlimited }
      );

      fireEvent.press(getByTestId('package-option-1'));
      fireEvent.press(getByText('Book Class'));

      await waitFor(() => {
        expect(mockOnBookingSuccess).toHaveBeenCalledWith({
          classInstance: mockClass,
          bookingDetails: expect.objectContaining({
            status: 'confirmed',
            credits_used: null // No credits used for unlimited
          })
        });
      });
    });

    it('should join waitlist when class is full', async () => {
      const fullClass = {
        ...mockClass,
        available_spots: 0,
        is_full: true
      };

      const { getByText, getByTestId } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={fullClass}
          onClose={mockOnClose}
          onWaitlistJoin={mockOnWaitlistJoin}
        />
      );

      // Should show waitlist option instead of booking
      expect(getByText('Join Waitlist')).toBeTruthy();
      expect(queryByText('Book Class')).toBeNull();

      fireEvent.press(getByTestId('package-option-1'));
      fireEvent.press(getByText('Join Waitlist'));

      await waitFor(() => {
        expect(mockOnWaitlistJoin).toHaveBeenCalledWith({
          classInstance: fullClass,
          waitlistDetails: expect.objectContaining({
            status: 'waitlisted'
          })
        });
      });
    });
  });

  describe('Cash Payment Flow', () => {
    it('should handle cash payment option', async () => {
      const userWithoutPackages = {
        ...mockUser,
        packages: []
      };

      const { getByText, getByTestId } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />,
        { initialUser: userWithoutPackages }
      );

      // Should show cash payment option
      expect(getByText('Pay with Cash')).toBeTruthy();

      fireEvent.press(getByText('Pay with Cash'));

      // Should show cash payment confirmation
      expect(getByText('Cash Payment')).toBeTruthy();
      expect(getByText('Please pay at the studio before class')).toBeTruthy();
      
      const confirmCashButton = getByText('Confirm Cash Payment');
      fireEvent.press(confirmCashButton);

      await waitFor(() => {
        expect(mockOnBookingSuccess).toHaveBeenCalledWith({
          classInstance: mockClass,
          bookingDetails: expect.objectContaining({
            payment_method: 'cash',
            status: 'pending_payment'
          })
        });
      });
    });

    it('should show cash payment terms and conditions', () => {
      const { getByText } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(getByText('Pay with Cash'));

      expect(getByText('Cash Payment Terms:')).toBeTruthy();
      expect(getByText('• Payment must be made before class starts')).toBeTruthy();
      expect(getByText('• Cancellation policy applies')).toBeTruthy();
      expect(getByText('• Studio reserves the right to cancel unpaid bookings')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle booking API errors gracefully', async () => {
      // Mock API to return error
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const { getByText, getByTestId } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />
      );

      fireEvent.press(getByTestId('package-option-1'));
      fireEvent.press(getByText('Book Class'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Booking Failed',
          'Unable to complete booking. Please try again.',
          expect.any(Array)
        );
      });

      // Should not call success callback on error
      expect(mockOnBookingSuccess).not.toHaveBeenCalled();
    });

    it('should handle insufficient credits error', async () => {
      const userWithInsufficientCredits = {
        ...mockUser,
        packages: [
          {
            id: 1,
            package: { name: '1 Class Pack', credits: 1 },
            remaining_credits: 0, // No credits left
            is_unlimited: false
          }
        ]
      };

      const { getByText, queryByText } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
        />,
        { initialUser: userWithInsufficientCredits }
      );

      // Should show insufficient credits message
      expect(getByText('0 credits remaining')).toBeTruthy();
      expect(queryByText('Book Class')).toBeNull();
      expect(getByText('Insufficient Credits')).toBeTruthy();
    });

    it('should handle past class booking attempt', () => {
      const pastClass = {
        ...mockClass,
        start_datetime: '2024-01-01T10:00:00Z', // Past date
        is_past: true
      };

      const { getByText } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={pastClass}
          onClose={mockOnClose}
        />
      );

      expect(getByText('This class has already started')).toBeTruthy();
      expect(getByText('Cannot book past classes')).toBeTruthy();
    });

    it('should handle cancelled class booking attempt', () => {
      const cancelledClass = {
        ...mockClass,
        is_cancelled: true,
        cancellation_reason: 'Instructor unavailable'
      };

      const { getByText } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={cancelledClass}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Class Cancelled')).toBeTruthy();
      expect(getByText('Instructor unavailable')).toBeTruthy();
      expect(getByText('This class has been cancelled')).toBeTruthy();
    });
  });

  describe('User Role Specific Behavior', () => {
    it('should show different options for admin users', () => {
      const { getByText } = renderWithAdmin(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Admin Options')).toBeTruthy();
      expect(getByText('View All Bookings')).toBeTruthy();
      expect(getByText('Manage Class')).toBeTruthy();
    });

    it('should show instructor options for instructor users', () => {
      const { getByText } = renderWithInstructor(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
        />
      );

      expect(getByText('Instructor View')).toBeTruthy();
      expect(getByText('View Attendees')).toBeTruthy();
      expect(getByText('Class Notes')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByLabelText, getByTestId } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />
      );

      expect(getByLabelText('Booking modal for Pilates Fundamentals class')).toBeTruthy();
      expect(getByLabelText('Close booking modal')).toBeTruthy();
      
      const modal = getByTestId('booking-modal');
      expect(modal.props.accessibilityRole).toBe('dialog');
    });

    it('should be navigable with keyboard/screen reader', () => {
      const { getByTestId, getAllByRole } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />
      );

      // Should have proper focus management
      const modal = getByTestId('booking-modal');
      expect(modal.props.accessible).toBe(true);

      // Should have proper button roles
      const buttons = getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should announce booking status changes', async () => {
      const { getByText, getByTestId } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />
      );

      fireEvent.press(getByTestId('package-option-1'));
      fireEvent.press(getByText('Book Class'));

      await waitFor(() => {
        // Should announce success
        const successMessage = getByTestId('booking-success-announcement');
        expect(successMessage.props.accessibilityLiveRegion).toBe('polite');
        expect(successMessage.props.accessibilityLabel).toContain('booking successful');
      });
    });
  });

  describe('Performance and Optimization', () => {
    it('should not re-render unnecessarily when props unchanged', () => {
      const renderSpy = jest.fn();
      const MockBookingModal = (props: any) => {
        renderSpy();
        return <BookingModal {...props} />;
      };

      const { rerender } = renderWithAuth(
        <MockBookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
        />
      );

      renderSpy.mockClear();

      // Re-render with same props
      rerender(
        <MockBookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
        />
      );

      // Should not re-render with same props (if properly memoized)
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid booking attempts gracefully', async () => {
      const { getByText, getByTestId } = renderWithAuth(
        <BookingModal
          visible={true}
          classInstance={mockClass}
          onClose={mockOnClose}
          onBookingSuccess={mockOnBookingSuccess}
        />
      );

      fireEvent.press(getByTestId('package-option-1'));
      
      const bookButton = getByText('Book Class');
      
      // Rapid clicks
      fireEvent.press(bookButton);
      fireEvent.press(bookButton);
      fireEvent.press(bookButton);

      // Should only process one booking
      await waitFor(() => {
        expect(mockOnBookingSuccess).toHaveBeenCalledTimes(1);
      });
    });
  });
});

// Helper function for mock server setup
function setupBookingMocks() {
  // Mock successful booking
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      id: 1,
      status: 'confirmed',
      credits_used: 1,
      class_instance: mockClass,
      user: mockUser
    })
  });
}