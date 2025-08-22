import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsApi, BookingResult, CancellationResult, BookingStatus, WaitlistJoinResult, WaitlistLeaveResult } from '../api/bookings';
import { Booking, WaitlistEntry } from '../types';

// Query keys
export const bookingKeys = {
  all: ['bookings'] as const,
  lists: () => [...bookingKeys.all, 'list'] as const,
  list: (filters: string) => [...bookingKeys.lists(), { filters }] as const,
  details: () => [...bookingKeys.all, 'detail'] as const,
  detail: (id: number) => [...bookingKeys.details(), id] as const,
  status: (classId: number) => [...bookingKeys.all, 'status', classId] as const,
  waitlist: () => [...bookingKeys.all, 'waitlist'] as const,
};

// Hooks for bookings
export const useUserBookings = (includePast: boolean = false) => {
  return useQuery({
    queryKey: bookingKeys.list(includePast ? 'with-past' : 'future-only'),
    queryFn: () => bookingsApi.getUserBookings(includePast),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
};

export const useBookingStatus = (classId: number | null) => {
  return useQuery({
    queryKey: classId ? bookingKeys.status(classId) : [],
    queryFn: () => classId ? bookingsApi.getBookingStatus(classId) : null,
    enabled: !!classId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every minute for real-time updates
  });
};

export const useUserWaitlistEntries = (includeInactive: boolean = false) => {
  return useQuery({
    queryKey: [...bookingKeys.waitlist(), includeInactive ? 'with-inactive' : 'active-only'],
    queryFn: () => bookingsApi.getUserWaitlistEntries(includeInactive),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
};

// Mutations for booking actions
export const useBookClass = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bookingsApi.bookClass,
    onMutate: async (classId: number) => {
      // ❌ REMOVED OPTIMISTIC UPDATES - They were causing false "booked" feedback
      // Users were seeing themselves as booked before API confirmation
      // Now we wait for actual API success before showing any changes
      
      // Cancel any outgoing refetches for booking status  
      await queryClient.cancelQueries({ queryKey: bookingKeys.status(classId) });

      // Snapshot the previous value for error rollback
      const previousStatus = queryClient.getQueryData<BookingStatus>(bookingKeys.status(classId));

      return { previousStatus, classId };
    },
    onError: (err, classId, context) => {
      // Revert optimistic update on error
      if (context?.previousStatus) {
        queryClient.setQueryData(bookingKeys.status(classId), context.previousStatus);
      }
    },
    onSuccess: (data: BookingResult, classId) => {
      if (data.success && data.booking) {
        // Update booking status with real data
        queryClient.setQueryData<BookingStatus>(bookingKeys.status(classId), {
          has_booking: data.booking.status === 'confirmed',
          booking: data.booking,
          on_waitlist: false,
        });

        // Invalidate and refetch related queries
        queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
        queryClient.invalidateQueries({ queryKey: ['packages', 'balance'] });
        queryClient.invalidateQueries({ queryKey: ['userPackages'] });
      }
    },
  });
};

export const useCancelBooking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: number; reason?: string }) =>
      bookingsApi.cancelBooking(bookingId, reason),
    onMutate: async ({ bookingId }: { bookingId: number }) => {
      // ❌ REMOVED OPTIMISTIC UPDATES for booking cancellation
      // Users were seeing bookings as cancelled before API confirmation
      // Now we wait for actual API success before showing cancellation
      
      await queryClient.cancelQueries({ queryKey: bookingKeys.lists() });

      // Just snapshot for potential error rollback
      const bookingsQuery = bookingKeys.list('future-only');
      const previousBookings = queryClient.getQueryData<Booking[]>(bookingsQuery);

      return { previousBookings, bookingId };
    },
    onError: (err, variables, context) => {
      // Revert optimistic update on error
      if (context?.previousBookings) {
        const bookingsQuery = bookingKeys.list('future-only');
        queryClient.setQueryData(bookingsQuery, context.previousBookings);
      }
    },
    onSuccess: (data: CancellationResult, variables) => {
      // Invalidate and refetch all related queries
      queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      queryClient.invalidateQueries({ queryKey: ['packages', 'balance'] });
      queryClient.invalidateQueries({ queryKey: ['userPackages'] });

      // Update booking status if we know the class ID
      if (data.booking?.class_instance_id) {
        queryClient.invalidateQueries({ 
          queryKey: bookingKeys.status(data.booking.class_instance_id) 
        });
      }
    },
  });
};

export const useJoinWaitlist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bookingsApi.joinWaitlist,
    onMutate: async (classId: number) => {
      // ❌ REMOVED OPTIMISTIC UPDATES for waitlist joining  
      // Users were seeing themselves on waitlist before API confirmation
      
      await queryClient.cancelQueries({ queryKey: bookingKeys.status(classId) });

      // Snapshot the previous value for error rollback
      const previousStatus = queryClient.getQueryData<BookingStatus>(bookingKeys.status(classId));

      return { previousStatus, classId };
    },
    onError: (err, classId, context) => {
      // Revert optimistic update on error
      if (context?.previousStatus) {
        queryClient.setQueryData(bookingKeys.status(classId), context.previousStatus);
      }
    },
    onSuccess: (data: WaitlistJoinResult, classId) => {
      // Update booking status with real data
      queryClient.setQueryData<BookingStatus>(bookingKeys.status(classId), (old) => ({
        ...old,
        has_booking: false,
        on_waitlist: true,
        waitlist_entry: data.waitlist_entry,
        waitlist_position: data.position,
      } as BookingStatus));

      // Invalidate waitlist queries
      queryClient.invalidateQueries({ queryKey: bookingKeys.waitlist() });
    },
  });
};

export const useLeaveWaitlist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bookingsApi.leaveWaitlist,
    onMutate: async (classId: number) => {
      // ❌ REMOVED OPTIMISTIC UPDATES for waitlist leaving
      // Users were seeing themselves removed from waitlist before API confirmation
      
      await queryClient.cancelQueries({ queryKey: bookingKeys.status(classId) });

      // Snapshot the previous value for error rollback
      const previousStatus = queryClient.getQueryData<BookingStatus>(bookingKeys.status(classId));

      return { previousStatus, classId };
    },
    onError: (err, classId, context) => {
      // Revert optimistic update on error
      if (context?.previousStatus) {
        queryClient.setQueryData(bookingKeys.status(classId), context.previousStatus);
      }
    },
    onSuccess: (data: WaitlistLeaveResult, classId) => {
      // Confirm the optimistic update was correct
      queryClient.setQueryData<BookingStatus>(bookingKeys.status(classId), (old) => ({
        ...old,
        has_booking: false,
        on_waitlist: false,
        waitlist_entry: undefined,
        waitlist_position: undefined,
      } as BookingStatus));

      // Invalidate waitlist queries
      queryClient.invalidateQueries({ queryKey: bookingKeys.waitlist() });
    },
  });
};

// Combined hook for booking actions
export const useBookingActions = (classId: number) => {
  const bookClass = useBookClass();
  const cancelBooking = useCancelBooking();
  const joinWaitlist = useJoinWaitlist();
  const leaveWaitlist = useLeaveWaitlist();

  return {
    bookClass: () => bookClass.mutate(classId),
    joinWaitlist: () => joinWaitlist.mutate(classId),
    leaveWaitlist: () => leaveWaitlist.mutate(classId),
    cancelBooking: (bookingId: number, reason?: string) => 
      cancelBooking.mutate({ bookingId, reason }),
    
    // Loading states
    isBooking: bookClass.isPending,
    isCancelling: cancelBooking.isPending,
    isJoiningWaitlist: joinWaitlist.isPending,
    isLeavingWaitlist: leaveWaitlist.isPending,
    
    // Any action in progress
    isLoading: bookClass.isPending || cancelBooking.isPending || 
               joinWaitlist.isPending || leaveWaitlist.isPending,
               
    // Error states
    bookingError: bookClass.error,
    cancellationError: cancelBooking.error,
    waitlistError: joinWaitlist.error || leaveWaitlist.error,
  };
};

// Helper function to invalidate all booking-related queries
export const useInvalidateBookings = () => {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: bookingKeys.all }),
    invalidateBookings: () => queryClient.invalidateQueries({ queryKey: bookingKeys.lists() }),
    invalidateWaitlist: () => queryClient.invalidateQueries({ queryKey: bookingKeys.waitlist() }),
    invalidateStatus: (classId: number) => 
      queryClient.invalidateQueries({ queryKey: bookingKeys.status(classId) }),
  };
};