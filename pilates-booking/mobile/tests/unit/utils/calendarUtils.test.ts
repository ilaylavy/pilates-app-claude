/**
 * Unit tests for calendar utility functions.
 * Tests date formatting, manipulation, and calendar-specific logic.
 */

import {
  formatDate,
  formatTime,
  formatDateTime,
  addDays,
  subtractDays,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
  getWeekStart,
  getWeekEnd,
  getMonthStart,
  getMonthEnd,
  getDaysBetween,
  isWithinCancellationWindow,
  getRelativeTimeString,
  parseISOString,
  toISOString,
} from '../../../src/utils/calendarUtils';

describe('Calendar Utils', () => {
  // Fixed date for consistent testing
  const testDate = new Date('2024-02-15T10:30:00Z');
  const testDateString = '2024-02-15T10:30:00Z';

  beforeAll(() => {
    // Mock current time for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(testDate);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('Date Formatting', () => {
    it('should format date in default format', () => {
      expect(formatDate(testDate)).toBe('Feb 15, 2024');
    });

    it('should format date with custom format', () => {
      expect(formatDate(testDate, 'MM/dd/yyyy')).toBe('02/15/2024');
      expect(formatDate(testDate, 'yyyy-MM-dd')).toBe('2024-02-15');
      expect(formatDate(testDate, 'EEEE, MMMM d, yyyy')).toBe('Thursday, February 15, 2024');
    });

    it('should format time in default format', () => {
      expect(formatTime(testDate)).toBe('10:30 AM');
    });

    it('should format time in 24-hour format', () => {
      expect(formatTime(testDate, true)).toBe('10:30');
    });

    it('should format datetime', () => {
      expect(formatDateTime(testDate)).toBe('Feb 15, 2024 at 10:30 AM');
    });

    it('should handle different timezones', () => {
      const utcDate = new Date('2024-02-15T15:30:00Z');
      const formatted = formatDateTime(utcDate);
      expect(formatted).toBeDefined();
      expect(formatted).toContain('2024');
    });

    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid');
      expect(formatDate(invalidDate)).toBe('Invalid Date');
    });
  });

  describe('Date Manipulation', () => {
    it('should add days correctly', () => {
      const result = addDays(testDate, 5);
      expect(result.getDate()).toBe(20); // 15 + 5
      expect(result.getMonth()).toBe(1); // February (0-indexed)
    });

    it('should subtract days correctly', () => {
      const result = subtractDays(testDate, 5);
      expect(result.getDate()).toBe(10); // 15 - 5
      expect(result.getMonth()).toBe(1); // February (0-indexed)
    });

    it('should handle month boundaries when adding days', () => {
      const endOfMonth = new Date('2024-01-31T10:00:00Z');
      const result = addDays(endOfMonth, 1);
      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(1); // February
    });

    it('should handle month boundaries when subtracting days', () => {
      const startOfMonth = new Date('2024-02-01T10:00:00Z');
      const result = subtractDays(startOfMonth, 1);
      expect(result.getDate()).toBe(31);
      expect(result.getMonth()).toBe(0); // January
    });
  });

  describe('Date Comparison', () => {
    it('should correctly identify same day', () => {
      const sameDay = new Date('2024-02-15T15:45:00Z');
      const differentDay = new Date('2024-02-16T10:30:00Z');
      
      expect(isSameDay(testDate, sameDay)).toBe(true);
      expect(isSameDay(testDate, differentDay)).toBe(false);
    });

    it('should correctly identify today', () => {
      const today = new Date();
      const yesterday = subtractDays(today, 1);
      
      expect(isToday(today)).toBe(true);
      expect(isToday(yesterday)).toBe(false);
    });

    it('should correctly identify tomorrow', () => {
      const today = new Date();
      const tomorrow = addDays(today, 1);
      const dayAfter = addDays(today, 2);
      
      expect(isTomorrow(tomorrow)).toBe(true);
      expect(isTomorrow(dayAfter)).toBe(false);
      expect(isTomorrow(today)).toBe(false);
    });

    it('should correctly identify yesterday', () => {
      const today = new Date();
      const yesterday = subtractDays(today, 1);
      const dayBefore = subtractDays(today, 2);
      
      expect(isYesterday(yesterday)).toBe(true);
      expect(isYesterday(dayBefore)).toBe(false);
      expect(isYesterday(today)).toBe(false);
    });
  });

  describe('Week and Month Boundaries', () => {
    it('should get week start correctly', () => {
      // Feb 15, 2024 is a Thursday
      const weekStart = getWeekStart(testDate);
      expect(weekStart.getDay()).toBe(0); // Sunday
      expect(weekStart.getDate()).toBe(11); // Feb 11, 2024
    });

    it('should get week end correctly', () => {
      const weekEnd = getWeekEnd(testDate);
      expect(weekEnd.getDay()).toBe(6); // Saturday
      expect(weekEnd.getDate()).toBe(17); // Feb 17, 2024
    });

    it('should get month start correctly', () => {
      const monthStart = getMonthStart(testDate);
      expect(monthStart.getDate()).toBe(1);
      expect(monthStart.getMonth()).toBe(1); // February
      expect(monthStart.getFullYear()).toBe(2024);
    });

    it('should get month end correctly', () => {
      const monthEnd = getMonthEnd(testDate);
      expect(monthEnd.getDate()).toBe(29); // 2024 is a leap year
      expect(monthEnd.getMonth()).toBe(1); // February
      expect(monthEnd.getFullYear()).toBe(2024);
    });
  });

  describe('Date Range Calculations', () => {
    it('should calculate days between dates', () => {
      const startDate = new Date('2024-02-10T00:00:00Z');
      const endDate = new Date('2024-02-15T00:00:00Z');
      
      expect(getDaysBetween(startDate, endDate)).toBe(5);
      expect(getDaysBetween(endDate, startDate)).toBe(-5);
      expect(getDaysBetween(startDate, startDate)).toBe(0);
    });

    it('should handle different times on same day', () => {
      const morning = new Date('2024-02-15T08:00:00Z');
      const evening = new Date('2024-02-15T20:00:00Z');
      
      expect(getDaysBetween(morning, evening)).toBe(0);
    });
  });

  describe('Cancellation Window', () => {
    it('should check if within cancellation window', () => {
      const now = new Date();
      const futureClass = addDays(now, 2); // 2 days from now
      const nearFutureClass = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
      
      // With 24-hour cancellation window
      expect(isWithinCancellationWindow(futureClass, 24)).toBe(false);
      expect(isWithinCancellationWindow(nearFutureClass, 24)).toBe(true);
    });

    it('should handle past dates', () => {
      const now = new Date();
      const pastClass = subtractDays(now, 1);
      
      expect(isWithinCancellationWindow(pastClass, 24)).toBe(true);
    });

    it('should handle different cancellation windows', () => {
      const now = new Date();
      const classIn6Hours = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      
      expect(isWithinCancellationWindow(classIn6Hours, 12)).toBe(true);
      expect(isWithinCancellationWindow(classIn6Hours, 2)).toBe(false);
    });
  });

  describe('Relative Time Strings', () => {
    it('should generate relative time strings', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const threeDaysAgo = subtractDays(now, 3);
      
      expect(getRelativeTimeString(fiveMinutesAgo)).toBe('5 minutes ago');
      expect(getRelativeTimeString(twoHoursAgo)).toBe('2 hours ago');
      expect(getRelativeTimeString(threeDaysAgo)).toBe('3 days ago');
    });

    it('should handle future times', () => {
      const now = new Date();
      const inFiveMinutes = new Date(now.getTime() + 5 * 60 * 1000);
      const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const inThreeDays = addDays(now, 3);
      
      expect(getRelativeTimeString(inFiveMinutes)).toBe('in 5 minutes');
      expect(getRelativeTimeString(inTwoHours)).toBe('in 2 hours');
      expect(getRelativeTimeString(inThreeDays)).toBe('in 3 days');
    });

    it('should handle special cases', () => {
      const now = new Date();
      const justNow = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
      
      expect(getRelativeTimeString(justNow)).toBe('just now');
    });
  });

  describe('ISO String Parsing', () => {
    it('should parse ISO strings correctly', () => {
      const result = parseISOString(testDateString);
      expect(result).toEqual(testDate);
    });

    it('should handle invalid ISO strings', () => {
      expect(() => parseISOString('invalid-date')).toThrow();
    });

    it('should convert to ISO string correctly', () => {
      const result = toISOString(testDate);
      expect(result).toBe(testDateString);
    });

    it('should handle timezone conversions', () => {
      const localDate = new Date('2024-02-15T10:30:00'); // No Z suffix
      const isoString = toISOString(localDate);
      expect(isoString).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle leap year correctly', () => {
      const leapYearDate = new Date('2024-02-29T10:00:00Z');
      const monthEnd = getMonthEnd(leapYearDate);
      expect(monthEnd.getDate()).toBe(29);
      
      const nonLeapYearDate = new Date('2023-02-28T10:00:00Z');
      const nonLeapMonthEnd = getMonthEnd(nonLeapYearDate);
      expect(nonLeapMonthEnd.getDate()).toBe(28);
    });

    it('should handle daylight saving time transitions', () => {
      // Test DST transition dates (these will vary by timezone)
      const beforeDST = new Date('2024-03-09T10:00:00Z');
      const afterDST = new Date('2024-03-11T10:00:00Z');
      
      const daysBetween = getDaysBetween(beforeDST, afterDST);
      expect(daysBetween).toBe(2);
    });

    it('should handle year boundaries', () => {
      const newYearsEve = new Date('2023-12-31T23:59:59Z');
      const newYearsDay = new Date('2024-01-01T00:00:00Z');
      
      expect(isSameDay(newYearsEve, newYearsDay)).toBe(false);
      expect(getDaysBetween(newYearsEve, newYearsDay)).toBe(1);
    });

    it('should handle very old and very new dates', () => {
      const veryOldDate = new Date('1900-01-01T00:00:00Z');
      const veryNewDate = new Date('2100-12-31T23:59:59Z');
      
      expect(formatDate(veryOldDate)).toContain('1900');
      expect(formatDate(veryNewDate)).toContain('2100');
    });
  });
});