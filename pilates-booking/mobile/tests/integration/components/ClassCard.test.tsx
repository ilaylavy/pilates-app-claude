/**
 * Integration tests for ClassCard component.
 * Tests component rendering, interactions, and integration with providers.
 */

import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithAuth } from '../../testUtils/renderWithProviders';
import { setupMockServer, mockServerHandlers } from '../../testUtils/mockServer';
import { testData } from '../../testUtils/testData';

import ClassCard from '../../../src/components/ClassCard';

// Setup MSW mock server
setupMockServer();

describe('ClassCard Component', () => {
  const mockClass = testData.classes[0];
  const mockOnPress = jest.fn();
  const mockOnBook = jest.fn();
  const mockOnJoinWaitlist = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render class information correctly', () => {
      const { getByText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          onPress={mockOnPress}
        />
      );

      expect(getByText(mockClass.template.name)).toBeTruthy();
      expect(getByText(`with ${mockClass.instructor.first_name} ${mockClass.instructor.last_name}`)).toBeTruthy();
      expect(getByText(mockClass.template.level.charAt(0).toUpperCase() + mockClass.template.level.slice(1))).toBeTruthy();
    });

    it('should display class time and duration', () => {
      const { getByText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          onPress={mockOnPress}
        />
      );

      // Should show formatted time
      expect(getByText(/10:00 AM/)).toBeTruthy();
      expect(getByText(/60 min/)).toBeTruthy();
    });

    it('should show capacity information', () => {
      const { getByText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          availableSpots={5}
        />
      );

      expect(getByText('5 spots left')).toBeTruthy();
    });

    it('should show full status when no spots available', () => {
      const { getByText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          availableSpots={0}
        />
      );

      expect(getByText('Class Full')).toBeTruthy();
    });

    it('should render equipment needed', () => {
      const { getByText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          showDetails={true}
        />
      );

      expect(getByText(mockClass.template.equipment_needed!)).toBeTruthy();
    });
  });

  describe('Interaction', () => {
    it('should call onPress when card is tapped', () => {
      const { getByText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          onPress={mockOnPress}
        />
      );

      fireEvent.press(getByText(mockClass.template.name));
      expect(mockOnPress).toHaveBeenCalledWith(mockClass);
    });

    it('should show book button when available', () => {
      const { getByText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          availableSpots={5}
          onBook={mockOnBook}
          showBookButton={true}
        />
      );

      const bookButton = getByText('Book');
      expect(bookButton).toBeTruthy();
      
      fireEvent.press(bookButton);
      expect(mockOnBook).toHaveBeenCalledWith(mockClass);
    });

    it('should show join waitlist button when class is full', () => {
      const { getByText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          availableSpots={0}
          onJoinWaitlist={mockOnJoinWaitlist}
          showBookButton={true}
        />
      );

      const waitlistButton = getByText('Join Waitlist');
      expect(waitlistButton).toBeTruthy();
      
      fireEvent.press(waitlistButton);
      expect(mockOnJoinWaitlist).toHaveBeenCalledWith(mockClass);
    });

    it('should disable booking for past classes', () => {
      const pastClass = {
        ...mockClass,
        start_datetime: '2024-01-01T10:00:00Z', // Past date
      };

      const { queryByText } = renderWithAuth(
        <ClassCard 
          classInstance={pastClass}
          onBook={mockOnBook}
          showBookButton={true}
        />
      );

      expect(queryByText('Book')).toBeNull();
    });
  });

  describe('User States', () => {
    it('should show different UI for unauthenticated users', () => {
      const { getByText, queryByText } = renderWithoutAuth(
        <ClassCard 
          classInstance={mockClass}
          availableSpots={5}
          showBookButton={true}
        />
      );

      expect(getByText(mockClass.template.name)).toBeTruthy();
      expect(queryByText('Book')).toBeNull(); // Should not show book button
    });

    it('should handle admin user view', () => {
      const { getByText } = renderWithAdmin(
        <ClassCard 
          classInstance={mockClass}
          availableSpots={5}
          showBookButton={true}
          isAdminView={true}
        />
      );

      // Admin might see different options
      expect(getByText(mockClass.template.name)).toBeTruthy();
    });

    it('should handle instructor view', () => {
      const { getByText } = renderWithInstructor(
        <ClassCard 
          classInstance={mockClass}
          availableSpots={5}
          isInstructorView={true}
        />
      );

      expect(getByText(mockClass.template.name)).toBeTruthy();
    });
  });

  describe('Loading States', () => {
    it('should show loading state during booking', async () => {
      const { getByText, getByTestId } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          availableSpots={5}
          onBook={mockOnBook}
          showBookButton={true}
          isBooking={true}
        />
      );

      expect(getByTestId('booking-spinner')).toBeTruthy();
    });

    it('should handle booking success', async () => {
      const { getByText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          availableSpots={5}
          onBook={mockOnBook}
          showBookButton={true}
        />
      );

      const bookButton = getByText('Book');
      fireEvent.press(bookButton);

      await waitFor(() => {
        expect(mockOnBook).toHaveBeenCalled();
      });
    });

    it('should handle booking failure', async () => {
      // Simulate booking failure
      const failingOnBook = jest.fn().mockRejectedValue(new Error('Booking failed'));

      const { getByText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          availableSpots={5}
          onBook={failingOnBook}
          showBookButton={true}
        />
      );

      const bookButton = getByText('Book');
      fireEvent.press(bookButton);

      await waitFor(() => {
        expect(failingOnBook).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByLabelText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          onPress={mockOnPress}
        />
      );

      expect(getByLabelText(/Pilates Fundamentals class/)).toBeTruthy();
    });

    it('should be accessible via keyboard navigation', () => {
      const { getByText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          onPress={mockOnPress}
          onBook={mockOnBook}
          showBookButton={true}
        />
      );

      const card = getByText(mockClass.template.name);
      expect(card.props.accessible).toBe(true);
    });

    it('should have proper role and state descriptions', () => {
      const { getByText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          availableSpots={0}
          showBookButton={true}
        />
      );

      const fullBadge = getByText('Class Full');
      expect(fullBadge).toBeTruthy();
    });
  });

  describe('Visual States', () => {
    it('should show cancelled class style', () => {
      const cancelledClass = {
        ...mockClass,
        is_cancelled: true,
        cancellation_reason: 'Instructor unavailable',
      };

      const { getByText } = renderWithAuth(
        <ClassCard classInstance={cancelledClass} />
      );

      expect(getByText('Cancelled')).toBeTruthy();
      expect(getByText('Instructor unavailable')).toBeTruthy();
    });

    it('should highlight user\'s booked classes', () => {
      const { getByTestId } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          isUserBooked={true}
        />
      );

      expect(getByTestId('booked-indicator')).toBeTruthy();
    });

    it('should show waitlist status', () => {
      const { getByText } = renderWithAuth(
        <ClassCard 
          classInstance={mockClass}
          isUserWaitlisted={true}
        />
      );

      expect(getByText('On Waitlist')).toBeTruthy();
    });
  });

  describe('Data Formatting', () => {
    it('should format different time zones correctly', () => {
      const utcClass = {
        ...mockClass,
        start_datetime: '2024-02-15T15:30:00Z', // 3:30 PM UTC
      };

      const { getByText } = renderWithAuth(
        <ClassCard classInstance={utcClass} />
      );

      // Should display in local timezone
      expect(getByText(/3:30 PM|15:30/)).toBeTruthy();
    });

    it('should handle different date formats', () => {
      const tomorrowClass = {
        ...mockClass,
        start_datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      const { getByText } = renderWithAuth(
        <ClassCard classInstance={tomorrowClass} />
      );

      expect(getByText(/Tomorrow/)).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing instructor data gracefully', () => {
      const classWithoutInstructor = {
        ...mockClass,
        instructor: null,
      };

      const { getByText } = renderWithAuth(
        <ClassCard classInstance={classWithoutInstructor} />
      );

      expect(getByText(mockClass.template.name)).toBeTruthy();
      expect(getByText('TBA')).toBeTruthy(); // To Be Announced
    });

    it('should handle invalid dates gracefully', () => {
      const classWithInvalidDate = {
        ...mockClass,
        start_datetime: 'invalid-date',
      };

      const { getByText } = renderWithAuth(
        <ClassCard classInstance={classWithInvalidDate} />
      );

      expect(getByText(mockClass.template.name)).toBeTruthy();
    });

    it('should handle missing template data', () => {
      const classWithoutTemplate = {
        ...mockClass,
        template: null,
      };

      expect(() =>
        renderWithAuth(<ClassCard classInstance={classWithoutTemplate} />)
      ).not.toThrow();
    });
  });
});

// Mock renderWithoutAuth function
function renderWithoutAuth(component: React.ReactElement) {
  const { render } = require('../../testUtils/renderWithProviders');
  return render(component, { initialUser: null });
}

function renderWithAdmin(component: React.ReactElement) {
  const { renderWithAdmin } = require('../../testUtils/renderWithProviders');
  return renderWithAdmin(component);
}

function renderWithInstructor(component: React.ReactElement) {
  const { renderWithInstructor } = require('../../testUtils/renderWithProviders');
  return renderWithInstructor(component);
}