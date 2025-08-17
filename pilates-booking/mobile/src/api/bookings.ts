import { apiClient } from './client';
import { Booking, BookingRequest } from '../types';

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
};