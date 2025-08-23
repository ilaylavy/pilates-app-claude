/**
 * Mobile Logging Service for React Native
 * 
 * Provides comprehensive logging capabilities for the mobile app including:
 * - Structured logging with context
 * - Offline log buffering
 * - Batch log transmission
 * - Error tracking
 * - Performance monitoring
 * - User activity tracking
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

interface LogLevel {
  DEBUG: 'debug';
  INFO: 'info';
  WARN: 'warn';
  ERROR: 'error';
  CRITICAL: 'critical';
}

enum LogCategory {
  AUTH = 'AUTH',
  API = 'API',
  UI = 'UI',
  NAVIGATION = 'NAVIGATION',
  PAYMENT = 'PAYMENT',
  SOCIAL = 'SOCIAL',
  BOOKING = 'BOOKING',
  PERFORMANCE = 'PERFORMANCE',
  SECURITY = 'SECURITY',
  SYSTEM = 'SYSTEM',
  GENERAL = 'GENERAL',
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: keyof LogLevel;
  category: LogCategory;
  message: string;
  context: LogContext;
  extra?: Record<string, any>;
  stackTrace?: string;
  breadcrumbs?: string[];
  samplingRate?: number;
}

interface LogContext {
  userId?: string;
  sessionId: string;
  requestId?: string;
  screen?: string;
  component?: string;
  platform: string;
  appVersion: string;
  deviceInfo: DeviceInfo;
  networkInfo?: NetworkInfo;
}

interface DeviceInfo {
  brand: string;
  model: string;
  systemVersion: string;
  appVersion: string;
  buildNumber: string;
  bundleId: string;
  deviceId: string;
  isEmulator: boolean;
}

interface NetworkInfo {
  isConnected: boolean;
  type: string;
  isInternetReachable: boolean;
}

interface EventData {
  eventType: string;
  properties: Record<string, any>;
  timestamp: string;
  context: LogContext;
}

class MobileLoggingService {
  private static instance: MobileLoggingService;
  private logBuffer: LogEntry[] = [];
  private eventBuffer: EventData[] = [];
  private sessionId: string;
  private userId?: string;
  private currentScreen?: string;
  private deviceInfo?: DeviceInfo;
  private isOnline: boolean = true;
  private logLevel: keyof LogLevel = 'INFO';
  private breadcrumbs: string[] = [];
  
  // Configuration
  private readonly MAX_BUFFER_SIZE = 1000;
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds
  private readonly LOG_STORAGE_KEY = 'pilates_logs';
  private readonly EVENTS_STORAGE_KEY = 'pilates_events';
  private readonly LOG_RETENTION_DAYS = 7;
  private readonly MAX_BREADCRUMBS = 50;
  
  // Category-specific settings
  private categorySamplingRates: Map<LogCategory, number> = new Map([
    [LogCategory.PERFORMANCE, 0.1], // 10% sampling for performance logs
    [LogCategory.UI, 0.05], // 5% sampling for UI logs
    [LogCategory.API, 1.0], // 100% sampling for API logs
    [LogCategory.AUTH, 1.0], // 100% sampling for auth logs
    [LogCategory.PAYMENT, 1.0], // 100% sampling for payment logs
    [LogCategory.SECURITY, 1.0], // 100% sampling for security logs
    [LogCategory.GENERAL, 0.3], // 30% sampling for general logs
  ]);
  
  private categoryLogLevels: Map<LogCategory, keyof LogLevel> = new Map([
    [LogCategory.PERFORMANCE, 'DEBUG'],
    [LogCategory.UI, 'INFO'],
    [LogCategory.API, 'DEBUG'],
    [LogCategory.AUTH, 'INFO'],
    [LogCategory.PAYMENT, 'INFO'],
    [LogCategory.SECURITY, 'WARN'],
    [LogCategory.GENERAL, 'INFO'],
  ]);
  
  private flushTimer?: NodeJS.Timeout;
  private rotationTimer?: NodeJS.Timeout;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeDeviceInfo();
    this.setupNetworkListener();
    this.loadStoredLogs();
    this.startPeriodicFlush();
    this.startLogRotation();
  }

  public static getInstance(): MobileLoggingService {
    if (!MobileLoggingService.instance) {
      MobileLoggingService.instance = new MobileLoggingService();
    }
    return MobileLoggingService.instance;
  }

  // Initialization methods
  private async initializeDeviceInfo(): Promise<void> {
    try {
      this.deviceInfo = {
        brand: Device.brand || 'unknown',
        model: Device.modelName || 'unknown',
        systemVersion: Device.osVersion || 'unknown',
        appVersion: Application.nativeApplicationVersion || '1.0.0',
        buildNumber: Application.nativeBuildVersion || '1',
        bundleId: Application.applicationId || 'com.pilates.app',
        deviceId: await Application.getAndroidId() || 'unknown',
        isEmulator: !Device.isDevice,
      };
    } catch (error) {
      console.error('Failed to initialize device info:', error);
      // Fallback device info
      this.deviceInfo = {
        brand: 'unknown',
        model: 'unknown',
        systemVersion: 'unknown',
        appVersion: '1.0.0',
        buildNumber: '1',
        bundleId: 'com.pilates.app',
        deviceId: 'unknown',
        isEmulator: false,
      };
    }
  }

  private setupNetworkListener(): void {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      
      // Log network changes
      this.trackEvent('network.change', {
        isConnected: state.isConnected,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
      });

      // Try to flush logs when coming back online
      if (this.isOnline) {
        this.flushLogs();
      }
    });
  }

  private async loadStoredLogs(): Promise<void> {
    try {
      const [storedLogs, storedEvents] = await Promise.all([
        AsyncStorage.getItem(this.LOG_STORAGE_KEY),
        AsyncStorage.getItem(this.EVENTS_STORAGE_KEY),
      ]);

      if (storedLogs) {
        this.logBuffer = JSON.parse(storedLogs);
      }

      if (storedEvents) {
        this.eventBuffer = JSON.parse(storedEvents);
      }
    } catch (error) {
      console.error('Failed to load stored logs:', error);
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushLogs();
    }, this.FLUSH_INTERVAL);
  }

  private startLogRotation(): void {
    // Rotate logs daily at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    // Initial rotation check
    this.rotateOldLogs();

    // Set timer for midnight rotation
    setTimeout(() => {
      this.rotateOldLogs();
      this.rotationTimer = setInterval(() => {
        this.rotateOldLogs();
      }, 24 * 60 * 60 * 1000); // Daily rotation
    }, msUntilMidnight);
  }

  private async rotateOldLogs(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.LOG_RETENTION_DAYS);
      
      // Filter out old logs
      const filteredLogs = this.logBuffer.filter(
        log => new Date(log.timestamp) > cutoffDate
      );
      
      const removedCount = this.logBuffer.length - filteredLogs.length;
      this.logBuffer = filteredLogs;
      
      if (removedCount > 0) {
        console.log(`Rotated ${removedCount} old log entries`);
        await AsyncStorage.setItem(this.LOG_STORAGE_KEY, JSON.stringify(this.logBuffer));
      }

      // Also clean up old events
      const filteredEvents = this.eventBuffer.filter(
        event => new Date(event.timestamp) > cutoffDate
      );
      
      const removedEventCount = this.eventBuffer.length - filteredEvents.length;
      this.eventBuffer = filteredEvents;
      
      if (removedEventCount > 0) {
        await AsyncStorage.setItem(this.EVENTS_STORAGE_KEY, JSON.stringify(this.eventBuffer));
      }
    } catch (error) {
      console.error('Failed to rotate old logs:', error);
    }
  }

  // Configuration methods
  public setUserId(userId: string): void {
    this.userId = userId;
    this.info('User session started', { userId });
  }

  public clearUserId(): void {
    this.info('User session ended', { userId: this.userId });
    this.userId = undefined;
  }

  public setCurrentScreen(screenName: string): void {
    const previousScreen = this.currentScreen;
    this.currentScreen = screenName;
    
    this.trackEvent('screen.view', {
      screen: screenName,
      previousScreen,
    });
  }

  public setLogLevel(level: keyof LogLevel): void {
    this.logLevel = level;
  }

  // Enhanced logging methods with categories
  public debug(message: string, extra?: Record<string, any>, category: LogCategory = LogCategory.GENERAL): void {
    this.log('DEBUG', message, category, extra);
  }

  public info(message: string, extra?: Record<string, any>, category: LogCategory = LogCategory.GENERAL): void {
    this.log('INFO', message, category, extra);
  }

  public warn(message: string, extra?: Record<string, any>, category: LogCategory = LogCategory.GENERAL): void {
    this.log('WARN', message, category, extra);
  }

  public error(message: string, error?: Error, extra?: Record<string, any>, category: LogCategory = LogCategory.GENERAL): void {
    const logExtra = {
      ...extra,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };

    this.log('ERROR', message, category, logExtra, error?.stack);
  }

  public critical(message: string, error?: Error, extra?: Record<string, any>, category: LogCategory = LogCategory.GENERAL): void {
    const logExtra = {
      ...extra,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };

    this.log('CRITICAL', message, category, logExtra, error?.stack);
  }

  // Category-specific convenience methods
  public logAuth(level: keyof LogLevel, message: string, extra?: Record<string, any>): void {
    this.log(level, message, LogCategory.AUTH, extra);
  }

  public logAPI(level: keyof LogLevel, message: string, extra?: Record<string, any>): void {
    this.log(level, message, LogCategory.API, extra);
  }

  public logUI(level: keyof LogLevel, message: string, extra?: Record<string, any>): void {
    this.log(level, message, LogCategory.UI, extra);
  }

  public logNavigation(level: keyof LogLevel, message: string, extra?: Record<string, any>): void {
    this.log(level, message, LogCategory.NAVIGATION, extra);
  }

  public logPayment(level: keyof LogLevel, message: string, extra?: Record<string, any>): void {
    this.log(level, message, LogCategory.PAYMENT, extra);
  }

  public logBooking(level: keyof LogLevel, message: string, extra?: Record<string, any>): void {
    this.log(level, message, LogCategory.BOOKING, extra);
  }

  public logSecurity(level: keyof LogLevel, message: string, extra?: Record<string, any>): void {
    this.log(level, message, LogCategory.SECURITY, extra);
  }

  // Breadcrumb management
  public addBreadcrumb(message: string, category?: LogCategory): void {
    const breadcrumb = `${new Date().toISOString()} [${category || 'GENERAL'}] ${message}`;
    this.breadcrumbs.push(breadcrumb);
    
    // Keep only last N breadcrumbs
    if (this.breadcrumbs.length > this.MAX_BREADCRUMBS) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.MAX_BREADCRUMBS);
    }
  }

  public clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  // Event tracking methods
  public trackEvent(eventType: string, properties: Record<string, any> = {}): void {
    const event: EventData = {
      eventType,
      properties,
      timestamp: new Date().toISOString(),
      context: this.getLogContext(),
    };

    this.eventBuffer.push(event);
    this.saveToStorage();

    // Immediately flush critical events
    if (this.isCriticalEvent(eventType)) {
      this.flushLogs();
    }
  }

  // Specialized tracking methods
  public trackScreenView(screenName: string, params?: Record<string, any>): void {
    this.trackEvent('screen.view', {
      screen: screenName,
      params,
    });
  }

  public trackUserAction(action: string, target: string, properties?: Record<string, any>): void {
    this.trackEvent('user.action', {
      action,
      target,
      ...properties,
    });
  }

  public trackApiCall(endpoint: string, method: string, statusCode: number, 
                     responseTime: number, error?: string): void {
    this.trackEvent('api.call', {
      endpoint,
      method,
      statusCode,
      responseTime,
      error,
      success: statusCode >= 200 && statusCode < 300,
    });
  }

  public trackPerformance(metric: string, value: number, unit: string = 'ms'): void {
    this.trackEvent('performance.metric', {
      metric,
      value,
      unit,
    });
  }

  public trackError(error: Error, context?: string): void {
    this.trackEvent('error.occurred', {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      context,
    });

    this.error(`Error in ${context || 'unknown context'}`, error);
  }

  // Enhanced core logging implementation
  private log(level: keyof LogLevel, message: string, category: LogCategory, 
             extra?: Record<string, any>, stackTrace?: string): void {
    // Check if log level should be recorded
    if (!this.shouldLog(level, category)) {
      return;
    }

    // Apply category sampling
    const samplingRate = this.categorySamplingRates.get(category) || 1.0;
    if (Math.random() > samplingRate) {
      return; // Skip this log due to sampling
    }

    // Filter sensitive data
    const sanitizedExtra = this.sanitizeLogData(extra);
    const sanitizedMessage = this.sanitizeSensitiveData(message);

    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message: sanitizedMessage,
      context: this.getLogContext(),
      extra: sanitizedExtra,
      stackTrace,
      breadcrumbs: [...this.breadcrumbs], // Snapshot of current breadcrumbs
      samplingRate,
    };

    this.logBuffer.push(logEntry);

    // Also console log in development
    if (__DEV__) {
      const consoleMethod = this.getConsoleMethod(level);
      consoleMethod(`[${level}][${category}] ${sanitizedMessage}`, sanitizedExtra);
    }

    // Manage buffer size
    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer = this.logBuffer.slice(-this.MAX_BUFFER_SIZE);
    }

    this.saveToStorage();

    // Immediately flush errors and critical logs
    if (level === 'ERROR' || level === 'CRITICAL') {
      this.flushLogs();
    }
  }

  private sanitizeLogData(data?: Record<string, any>): Record<string, any> | undefined {
    if (!data) return data;
    
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'authorization',
      'credit_card', 'ssn', 'email', 'phone'
    ];
    
    const sanitized = { ...data };
    
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof key === 'string' && sensitiveFields.some(field => 
        key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeLogData(value as Record<string, any>);
      }
    }
    
    return sanitized;
  }

  private sanitizeSensitiveData(message: string): string {
    // Remove potential credit card numbers, emails, phones, etc.
    return message
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD-REDACTED]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL-REDACTED]')
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE-REDACTED]')
      .replace(/\b(?:token|key|secret)[\s=:]+[^\s]+/gi, '[TOKEN-REDACTED]');
  }

  private getLogContext(): LogContext {
    return {
      userId: this.userId,
      sessionId: this.sessionId,
      screen: this.currentScreen,
      platform: Platform.OS,
      appVersion: this.deviceInfo?.appVersion || 'unknown',
      deviceInfo: this.deviceInfo!,
      networkInfo: {
        isConnected: this.isOnline,
        type: 'unknown', // Would be populated by NetInfo
        isInternetReachable: this.isOnline,
      },
    };
  }

  private shouldLog(level: keyof LogLevel, category?: LogCategory): boolean {
    const levels: Record<keyof LogLevel, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      CRITICAL: 4,
    };

    // Check global log level
    const globalCheck = levels[level] >= levels[this.logLevel];
    
    // Check category-specific log level if available
    if (category) {
      const categoryLevel = this.categoryLogLevels.get(category);
      if (categoryLevel) {
        const categoryCheck = levels[level] >= levels[categoryLevel];
        return globalCheck && categoryCheck;
      }
    }

    return globalCheck;
  }

  private getConsoleMethod(level: keyof LogLevel): Function {
    switch (level) {
      case 'DEBUG':
        return console.debug;
      case 'INFO':
        return console.info;
      case 'WARN':
        return console.warn;
      case 'ERROR':
      case 'CRITICAL':
        return console.error;
      default:
        return console.log;
    }
  }

  private isCriticalEvent(eventType: string): boolean {
    const criticalEvents = [
      'error.occurred',
      'crash.detected',
      'security.violation',
      'payment.failed',
    ];
    return criticalEvents.includes(eventType);
  }

  // Storage and transmission
  private async saveToStorage(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(this.LOG_STORAGE_KEY, JSON.stringify(this.logBuffer)),
        AsyncStorage.setItem(this.EVENTS_STORAGE_KEY, JSON.stringify(this.eventBuffer)),
      ]);
    } catch (error) {
      console.error('Failed to save logs to storage:', error);
    }
  }

  public async flushLogs(): Promise<void> {
    if (!this.isOnline || (this.logBuffer.length === 0 && this.eventBuffer.length === 0)) {
      return;
    }

    try {
      // Send logs in batches
      const logBatches = this.chunkArray(this.logBuffer, this.BATCH_SIZE);
      const eventBatches = this.chunkArray(this.eventBuffer, this.BATCH_SIZE);

      for (const batch of logBatches) {
        await this.sendLogBatch(batch);
      }

      for (const batch of eventBatches) {
        await this.sendEventBatch(batch);
      }

      // Clear sent logs
      this.logBuffer = [];
      this.eventBuffer = [];
      await this.saveToStorage();

    } catch (error) {
      // Only log errors in development to avoid spam
      if (__DEV__) {
        console.debug('Failed to flush logs (development mode):', error);
      }
      // Keep logs in buffer for retry
    }
  }

  private async sendLogBatch(logs: LogEntry[]): Promise<void> {
    // Skip sending logs in development or if no proper backend URL is configured
    if (__DEV__) {
      console.log('Development mode: Skipping log transmission to backend');
      return;
    }

    try {
      const response = await fetch('/api/v1/logs/mobile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs,
          session_id: this.sessionId,
          device_info: this.deviceInfo,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send logs: ${response.status}`);
      }
    } catch (error) {
      // Silently fail in development to avoid network error spam
      if (__DEV__) {
        console.debug('Log transmission failed (development mode):', error);
      } else {
        throw error;
      }
    }
  }

  private async sendEventBatch(events: EventData[]): Promise<void> {
    // Skip sending events in development or if no proper backend URL is configured
    if (__DEV__) {
      console.log('Development mode: Skipping event transmission to backend');
      return;
    }

    try {
      const response = await fetch('/api/v1/events/mobile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events,
          session_id: this.sessionId,
          device_info: this.deviceInfo,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send events: ${response.status}`);
      }
    } catch (error) {
      // Silently fail in development to avoid network error spam
      if (__DEV__) {
        console.debug('Event transmission failed (development mode):', error);
      } else {
        throw error;
      }
    }
  }

  // Utility methods
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateLogId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Configuration methods for categories
  public setCategorySamplingRate(category: LogCategory, rate: number): void {
    this.categorySamplingRates.set(category, Math.max(0, Math.min(1, rate)));
  }

  public setCategoryLogLevel(category: LogCategory, level: keyof LogLevel): void {
    this.categoryLogLevels.set(category, level);
  }

  // Cleanup
  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
    }
    this.flushLogs();
  }
}

// Global error handler
export const setupGlobalErrorHandler = (): void => {
  const logger = MobileLoggingService.getInstance();

  // React Native global error handler
  const defaultHandler = ErrorUtils.getGlobalHandler();
  
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    logger.critical(
      `Global error${isFatal ? ' (fatal)' : ''}`,
      error,
      { isFatal }
    );

    logger.trackEvent('crash.detected', {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      isFatal,
    });

    // Call the default handler
    defaultHandler(error, isFatal);
  });

  // Unhandled promise rejection handler for React Native
  const promiseRejectionHandler = (event: any) => {
    logger.error('Unhandled promise rejection', event.reason);
    logger.trackError(event.reason, 'unhandled_promise_rejection');
  };

  // React Native doesn't have window.addEventListener, so we use a different approach
  // This is handled by the React Native global error handler above
  if (__DEV__) {
    console.log('Global error handlers setup completed');
  }
};

// Export singleton instance
export const Logger = MobileLoggingService.getInstance();
export { LogCategory };

// Export convenience functions
export const logDebug = (message: string, extra?: Record<string, any>) => Logger.debug(message, extra);
export const logInfo = (message: string, extra?: Record<string, any>) => Logger.info(message, extra);
export const logWarn = (message: string, extra?: Record<string, any>) => Logger.warn(message, extra);
export const logError = (message: string, error?: Error, extra?: Record<string, any>) => Logger.error(message, error, extra);
export const trackEvent = (eventType: string, properties?: Record<string, any>) => Logger.trackEvent(eventType, properties);
export const trackScreenView = (screenName: string, params?: Record<string, any>) => Logger.trackScreenView(screenName, params);
export const trackUserAction = (action: string, target: string, properties?: Record<string, any>) => Logger.trackUserAction(action, target, properties);

export default MobileLoggingService;