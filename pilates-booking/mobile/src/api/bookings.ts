import { apiClient } from './client';
import { Booking, BookingRequest, WaitlistEntry } from '../types';

export interface BookingResult {
  success: boolean;
  booking?: Booking;
  message?: string;
}

export interface CancellationResult {
  success: boolean;
  message?: string;
}

export interface BookingStatus {
  can_book: boolean;
  reason?: string;
}

export interface WaitlistJoinResult {
  success: boolean;
  waitlist_entry?: WaitlistEntry;
  message?: string;
}

export interface WaitlistLeaveResult {
  success: boolean;
  message?: string;
}

export const bookingsApi = {
  createBooking: async (bookingData: BookingRequest): Promise<Booking> => {
    const response = await apiClient.post<Booking>('/bookings/create', bookingData);
    return response.data;
  },

  cancelBooking: async (bookingId: number, reason?: string): Promise<Booking> => {
    const response = await apiClient.delete<Booking>(`/bookings/${bookingId}/cancel`, {
      data: { reason },
    });
    return response.data;
  },

  getUserBookings: async (includePast = false): Promise<Booking[]> => {
    const response = await apiClient.get<Booking[]>(`/bookings?include_past=${includePast}`);
    return response.data;
  },

  getBookingStatus: async (classInstanceId: number): Promise<BookingStatus> => {
    const response = await apiClient.get<BookingStatus>(`/classes/${classInstanceId}/booking-status`);
    return response.data;
  },

  getUserWaitlistEntries: async (): Promise<WaitlistEntry[]> => {
    const response = await apiClient.get<WaitlistEntry[]>('/bookings/waitlist');
    return response.data;
  },

  bookClass: async (classInstanceId: number, userPackageId?: number): Promise<BookingResult> => {
    try {
      const booking = await bookingsApi.createBooking({
        class_instance_id: classInstanceId,
        user_package_id: userPackageId,
      });
      return { success: true, booking };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to book class',
      };
    }
  },

  joinWaitlist: async (classInstanceId: number): Promise<WaitlistJoinResult> => {
    try {
      const response = await apiClient.post<WaitlistEntry>(`/classes/${classInstanceId}/waitlist`);
      return { success: true, waitlist_entry: response.data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to join waitlist',
      };
    }
  },

  leaveWaitlist: async (classInstanceId: number): Promise<WaitlistLeaveResult> => {
    try {
      await apiClient.delete(`/classes/${classInstanceId}/waitlist`);
      return { success: true, message: 'Left waitlist successfully' };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || 'Failed to leave waitlist',
      };
    }
  },
};