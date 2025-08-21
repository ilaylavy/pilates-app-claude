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
import DeviceInfo from 'react-native-device-info';

interface LogLevel {
  DEBUG: 'debug';
  INFO: 'info';
  WARN: 'warn';
  ERROR: 'error';
  CRITICAL: 'critical';
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: keyof LogLevel;
  message: string;
  context: LogContext;
  extra?: Record<string, any>;
  stackTrace?: string;
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
  
  // Configuration
  private readonly MAX_BUFFER_SIZE = 1000;
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds
  private readonly LOG_STORAGE_KEY = 'pilates_logs';
  private readonly EVENTS_STORAGE_KEY = 'pilates_events';
  
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeDeviceInfo();
    this.setupNetworkListener();
    this.loadStoredLogs();
    this.startPeriodicFlush();
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
        brand: DeviceInfo.getBrand(),
        model: DeviceInfo.getModel(),
        systemVersion: DeviceInfo.getSystemVersion(),
        appVersion: DeviceInfo.getVersion(),
        buildNumber: DeviceInfo.getBuildNumber(),
        bundleId: DeviceInfo.getBundleId(),
        deviceId: await DeviceInfo.getUniqueId(),
        isEmulator: await DeviceInfo.isEmulator(),
      };
    } catch (error) {
      console.error('Failed to initialize device info:', error);
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

  // Core logging methods
  public debug(message: string, extra?: Record<string, any>): void {
    this.log('DEBUG', message, extra);
  }

  public info(message: string, extra?: Record<string, any>): void {
    this.log('INFO', message, extra);
  }

  public warn(message: string, extra?: Record<string, any>): void {
    this.log('WARN', message, extra);
  }

  public error(message: string, error?: Error, extra?: Record<string, any>): void {
    const logExtra = {
      ...extra,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };

    this.log('ERROR', message, logExtra, error?.stack);
  }

  public critical(message: string, error?: Error, extra?: Record<string, any>): void {
    const logExtra = {
      ...extra,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };

    this.log('CRITICAL', message, logExtra, error?.stack);
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

  // Core logging implementation
  private log(level: keyof LogLevel, message: string, extra?: Record<string, any>, 
             stackTrace?: string): void {
    // Check if log level should be recorded
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.getLogContext(),
      extra,
      stackTrace,
    };

    this.logBuffer.push(logEntry);

    // Also console log in development
    if (__DEV__) {
      const consoleMethod = this.getConsoleMethod(level);
      consoleMethod(`[${level}] ${message}`, extra);
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

  private shouldLog(level: keyof LogLevel): boolean {
    const levels: Record<keyof LogLevel, number> = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      CRITICAL: 4,
    };

    return levels[level] >= levels[this.logLevel];
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
      console.error('Failed to flush logs:', error);
      // Keep logs in buffer for retry
    }
  }

  private async sendLogBatch(logs: LogEntry[]): Promise<void> {
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
  }

  private async sendEventBatch(events: EventData[]): Promise<void> {
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

  // Cleanup
  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
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

  // Unhandled promise rejection handler
  const promiseRejectionHandler = (event: any) => {
    logger.error('Unhandled promise rejection', event.reason);
    logger.trackError(event.reason, 'unhandled_promise_rejection');
  };

  // Add event listener for unhandled promise rejections
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', promiseRejectionHandler);
  }
};

// Export singleton instance
export const Logger = MobileLoggingService.getInstance();

// Export convenience functions
export const logDebug = (message: string, extra?: Record<string, any>) => Logger.debug(message, extra);
export const logInfo = (message: string, extra?: Record<string, any>) => Logger.info(message, extra);
export const logWarn = (message: string, extra?: Record<string, any>) => Logger.warn(message, extra);
export const logError = (message: string, error?: Error, extra?: Record<string, any>) => Logger.error(message, error, extra);
export const trackEvent = (eventType: string, properties?: Record<string, any>) => Logger.trackEvent(eventType, properties);
export const trackScreenView = (screenName: string, params?: Record<string, any>) => Logger.trackScreenView(screenName, params);
export const trackUserAction = (action: string, target: string, properties?: Record<string, any>) => Logger.trackUserAction(action, target, properties);

export default MobileLoggingService;