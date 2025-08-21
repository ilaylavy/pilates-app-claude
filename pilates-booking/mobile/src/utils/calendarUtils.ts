import * as Calendar from 'expo-calendar';
import { Alert, Platform } from 'react-native';
import { ClassInstance } from '../types';

export interface CalendarEvent {
  id?: string;
  title: string;
  startDate: Date;
  endDate: Date;
  notes?: string;
  location?: string;
  alarms?: Calendar.Alarm[];
}

export class CalendarManager {
  private static instance: CalendarManager;
  private defaultCalendar: Calendar.Calendar | null = null;

  static getInstance(): CalendarManager {
    if (!CalendarManager.instance) {
      CalendarManager.instance = new CalendarManager();
    }
    return CalendarManager.instance;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Calendar permission error:', error);
      return false;
    }
  }

  async getDefaultCalendar(): Promise<Calendar.Calendar | null> {
    if (this.defaultCalendar) {
      return this.defaultCalendar;
    }

    try {
      const calendars = await Calendar.getCalendarsAsync();
      
      // Try to find the primary calendar first
      let calendar = calendars.find(cal => cal.isPrimary);
      
      // If no primary calendar, find the first writable calendar
      if (!calendar) {
        calendar = calendars.find(cal => cal.allowsModifications);
      }
      
      // Fallback to first available calendar
      if (!calendar) {
        calendar = calendars[0];
      }

      this.defaultCalendar = calendar || null;
      return this.defaultCalendar;
    } catch (error) {
      console.error('Get calendar error:', error);
      return null;
    }
  }

  async addClassToCalendar(
    classInstance: ClassInstance,
    options: {
      reminderMinutes?: number;
      notes?: string;
      customTitle?: string;
    } = {}
  ): Promise<string | null> {
    try {
      // Check permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Calendar access is needed to add this class to your calendar. Please enable it in Settings.'
        );
        return null;
      }

      // Get calendar
      const calendar = await this.getDefaultCalendar();
      if (!calendar) {
        Alert.alert('Error', 'No calendar found on your device.');
        return null;
      }

      // Prepare event data
      const startDate = new Date(classInstance.start_datetime);
      const endDate = new Date(classInstance.end_datetime);
      
      const title = options.customTitle || `${classInstance.template.name} Class`;
      const location = 'Pilates Studio'; // You can make this configurable
      
      let notes = `Instructor: ${classInstance.instructor.first_name} ${classInstance.instructor.last_name}`;
      if (classInstance.template.description) {
        notes += `\n\n${classInstance.template.description}`;
      }
      if (classInstance.notes) {
        notes += `\n\nClass Notes: ${classInstance.notes}`;
      }
      if (options.notes) {
        notes += `\n\n${options.notes}`;
      }
      notes += '\n\nBooked through Pilates Studio App';

      // Set up reminders
      const alarms: Calendar.Alarm[] = [];
      if (options.reminderMinutes) {
        alarms.push({ relativeOffset: -options.reminderMinutes });
      } else {
        // Default reminders: 30 minutes before
        alarms.push({ relativeOffset: -30 });
      }

      // Create the event
      const eventId = await Calendar.createEventAsync(calendar.id, {
        title,
        startDate,
        endDate,
        notes,
        location,
        alarms,
        timeZone: Platform.OS === 'android' ? 'UTC' : undefined,
      });

      return eventId;
    } catch (error) {
      console.error('Add to calendar error:', error);
      Alert.alert('Error', 'Failed to add class to calendar.');
      return null;
    }
  }

  async updateCalendarEvent(
    eventId: string,
    classInstance: ClassInstance,
    options: {
      reminderMinutes?: number;
      notes?: string;
      customTitle?: string;
    } = {}
  ): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      // Prepare updated event data
      const startDate = new Date(classInstance.start_datetime);
      const endDate = new Date(classInstance.end_datetime);
      
      const title = options.customTitle || `${classInstance.template.name} Class`;
      const location = 'Pilates Studio';
      
      let notes = `Instructor: ${classInstance.instructor.first_name} ${classInstance.instructor.last_name}`;
      if (classInstance.template.description) {
        notes += `\n\n${classInstance.template.description}`;
      }
      if (classInstance.notes) {
        notes += `\n\nClass Notes: ${classInstance.notes}`;
      }
      if (options.notes) {
        notes += `\n\n${options.notes}`;
      }
      notes += '\n\nBooked through Pilates Studio App';

      // Update the event
      await Calendar.updateEventAsync(eventId, {
        title,
        startDate,
        endDate,
        notes,
        location,
      });

      return true;
    } catch (error) {
      console.error('Update calendar event error:', error);
      return false;
    }
  }

  async removeCalendarEvent(eventId: string): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      await Calendar.deleteEventAsync(eventId);
      return true;
    } catch (error) {
      console.error('Remove calendar event error:', error);
      return false;
    }
  }

  async getCalendarEvent(eventId: string): Promise<Calendar.Event | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      const event = await Calendar.getEventAsync(eventId);
      return event;
    } catch (error) {
      console.error('Get calendar event error:', error);
      return null;
    }
  }

  async showCalendarSettings(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        Alert.alert(
          'Calendar Settings',
          'To manage calendar access, go to Settings > Privacy & Security > Calendars.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Calendar.openEventInCalendar('') }
          ]
        );
      } else {
        Alert.alert(
          'Calendar Settings',
          'To manage calendar access, go to Settings > Apps > Pilates Studio > Permissions.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Show calendar settings error:', error);
    }
  }
}

// Utility functions for common calendar operations
export const addClassToCalendar = async (
  classInstance: ClassInstance,
  options?: {
    reminderMinutes?: number;
    notes?: string;
    customTitle?: string;
  }
): Promise<string | null> => {
  const calendarManager = CalendarManager.getInstance();
  return await calendarManager.addClassToCalendar(classInstance, options);
};

export const removeClassFromCalendar = async (eventId: string): Promise<boolean> => {
  const calendarManager = CalendarManager.getInstance();
  return await calendarManager.removeCalendarEvent(eventId);
};

export const updateClassInCalendar = async (
  eventId: string,
  classInstance: ClassInstance,
  options?: {
    reminderMinutes?: number;
    notes?: string;
    customTitle?: string;
  }
): Promise<boolean> => {
  const calendarManager = CalendarManager.getInstance();
  return await calendarManager.updateCalendarEvent(eventId, classInstance, options);
};

// Calendar sync service for managing booking-calendar synchronization
export class CalendarSyncService {
  private static instance: CalendarSyncService;
  private syncEnabled = false;
  private eventMappings: Map<number, string> = new Map(); // bookingId -> eventId

  static getInstance(): CalendarSyncService {
    if (!CalendarSyncService.instance) {
      CalendarSyncService.instance = new CalendarSyncService();
    }
    return CalendarSyncService.instance;
  }

  setSyncEnabled(enabled: boolean): void {
    this.syncEnabled = enabled;
  }

  isSyncEnabled(): boolean {
    return this.syncEnabled;
  }

  async onBookingCreated(bookingId: number, classInstance: ClassInstance): Promise<void> {
    if (!this.syncEnabled) return;

    try {
      const eventId = await addClassToCalendar(classInstance, {
        notes: `Booking ID: ${bookingId}`,
      });

      if (eventId) {
        this.eventMappings.set(bookingId, eventId);
        // TODO: Store mapping in persistent storage (AsyncStorage, SQLite, etc.)
      }
    } catch (error) {
      console.error('Calendar sync on booking created error:', error);
    }
  }

  async onBookingCancelled(bookingId: number): Promise<void> {
    if (!this.syncEnabled) return;

    try {
      const eventId = this.eventMappings.get(bookingId);
      if (eventId) {
        await removeClassFromCalendar(eventId);
        this.eventMappings.delete(bookingId);
        // TODO: Remove mapping from persistent storage
      }
    } catch (error) {
      console.error('Calendar sync on booking cancelled error:', error);
    }
  }

  async onClassUpdated(bookingId: number, classInstance: ClassInstance): Promise<void> {
    if (!this.syncEnabled) return;

    try {
      const eventId = this.eventMappings.get(bookingId);
      if (eventId) {
        await updateClassInCalendar(eventId, classInstance, {
          notes: `Booking ID: ${bookingId} (Updated)`,
        });
      }
    } catch (error) {
      console.error('Calendar sync on class updated error:', error);
    }
  }
}