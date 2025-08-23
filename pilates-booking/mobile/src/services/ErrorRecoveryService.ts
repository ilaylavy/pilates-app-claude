import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { Logger } from './LoggingService';
import { networkQueue } from './NetworkQueueService';
import { STORAGE_KEYS } from '../utils/config';

interface ErrorContext {
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  screenName?: string;
  userId?: string;
  timestamp: string;
  recoveryAttempts: number;
  lastRecoveryAttempt?: string;
}

interface RecoveryStrategy {
  id: string;
  name: string;
  description: string;
  canRecover: (context: ErrorContext) => boolean;
  recover: (context: ErrorContext) => Promise<RecoveryResult>;
  priority: number;
}

interface RecoveryResult {
  success: boolean;
  action: string;
  message: string;
  data?: any;
  shouldRetry?: boolean;
  retryDelay?: number;
}

interface FallbackData {
  [key: string]: any;
}

export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private errorContexts: Map<string, ErrorContext> = new Map();
  private fallbackDataProviders: Map<string, () => Promise<FallbackData>> = new Map();
  private maxRecoveryAttempts: number = 3;
  private recoveryTimeoutMs: number = 10000;

  private constructor() {
    this.initializeDefaultStrategies();
    this.loadPersistedContexts();
  }

  public static getInstance(): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService();
    }
    return ErrorRecoveryService.instance;
  }

  private initializeDefaultStrategies(): void {
    // Network error recovery
    this.registerStrategy({
      id: 'network_error_recovery',
      name: 'Network Error Recovery',
      description: 'Handles network-related errors with retries and offline fallbacks',
      priority: 1,
      canRecover: (context) => {
        return context.errorType.toLowerCase().includes('network') ||
               context.errorMessage.toLowerCase().includes('fetch') ||
               context.errorMessage.toLowerCase().includes('timeout');
      },
      recover: async (context) => {
        const netInfo = await NetInfo.fetch();
        
        if (!netInfo.isConnected) {
          Logger.info('Device is offline, queuing request for later');
          return {
            success: true,
            action: 'queued_for_offline',
            message: 'Request queued for when connection is restored',
          };
        }

        if (context.recoveryAttempts < 2) {
          const delay = Math.pow(2, context.recoveryAttempts) * 1000;
          Logger.info('Retrying network request', { delay, attempt: context.recoveryAttempts + 1 });
          return {
            success: true,
            action: 'retry_with_backoff',
            message: `Retrying in ${delay}ms`,
            shouldRetry: true,
            retryDelay: delay,
          };
        }

        return {
          success: false,
          action: 'max_retries_exceeded',
          message: 'Network request failed after maximum retry attempts',
        };
      },
    });

    // Authentication error recovery
    this.registerStrategy({
      id: 'auth_error_recovery',
      name: 'Authentication Error Recovery',
      description: 'Handles authentication failures with token refresh',
      priority: 1,
      canRecover: (context) => {
        return context.errorMessage.toLowerCase().includes('unauthorized') ||
               context.errorMessage.toLowerCase().includes('401') ||
               context.errorMessage.toLowerCase().includes('authentication');
      },
      recover: async (context) => {
        try {
          Logger.info('Attempting token refresh for auth error');
          
          const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
          if (!refreshToken) {
            return {
              success: false,
              action: 'redirect_to_login',
              message: 'No refresh token available, user must log in again',
            };
          }

          // The API client will handle the actual token refresh
          return {
            success: true,
            action: 'token_refresh_initiated',
            message: 'Token refresh in progress',
            shouldRetry: true,
            retryDelay: 1000,
          };
        } catch (error) {
          Logger.error('Token refresh failed during error recovery', error as Error);
          return {
            success: false,
            action: 'token_refresh_failed',
            message: 'Unable to refresh authentication token',
          };
        }
      },
    });

    // Data corruption recovery
    this.registerStrategy({
      id: 'data_corruption_recovery',
      name: 'Data Corruption Recovery',
      description: 'Handles corrupted local data by clearing and re-fetching',
      priority: 2,
      canRecover: (context) => {
        return context.errorMessage.toLowerCase().includes('json') ||
               context.errorMessage.toLowerCase().includes('parse') ||
               context.errorMessage.toLowerCase().includes('corrupt');
      },
      recover: async (context) => {
        try {
          Logger.warn('Attempting data corruption recovery', { context: context.screenName });
          
          // Clear potentially corrupted cached data
          const keysToCheck = ['user_data', 'bookings_cache', 'classes_cache', 'packages_cache'];
          
          for (const key of keysToCheck) {
            try {
              const data = await AsyncStorage.getItem(key);
              if (data) {
                JSON.parse(data); // Test if parseable
              }
            } catch {
              Logger.info(`Clearing corrupted data for key: ${key}`);
              await AsyncStorage.removeItem(key);
            }
          }

          return {
            success: true,
            action: 'corrupted_data_cleared',
            message: 'Corrupted data has been cleared and will be re-fetched',
            shouldRetry: true,
            retryDelay: 500,
          };
        } catch (error) {
          Logger.error('Failed to clear corrupted data', error as Error);
          return {
            success: false,
            action: 'data_recovery_failed',
            message: 'Unable to recover from data corruption',
          };
        }
      },
    });

    // Memory pressure recovery
    this.registerStrategy({
      id: 'memory_pressure_recovery',
      name: 'Memory Pressure Recovery',
      description: 'Handles out-of-memory errors by clearing caches',
      priority: 3,
      canRecover: (context) => {
        return context.errorMessage.toLowerCase().includes('memory') ||
               context.errorMessage.toLowerCase().includes('heap');
      },
      recover: async (context) => {
        try {
          Logger.warn('Attempting memory pressure recovery');
          
          // Clear image caches, async storage caches, etc.
          const cacheKeys = [
            'image_cache',
            'api_cache',
            'user_preferences_cache',
            'temporary_data',
          ];

          for (const key of cacheKeys) {
            await AsyncStorage.removeItem(key).catch(() => {});
          }

          // Clear network queue if it's too large
          const queueStatus = networkQueue.getQueueStatus();
          if (queueStatus.size > 50) {
            networkQueue.clearQueue();
            Logger.info('Cleared large network queue to free memory');
          }

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }

          return {
            success: true,
            action: 'memory_freed',
            message: 'Freed memory by clearing caches',
            shouldRetry: true,
            retryDelay: 1000,
          };
        } catch (error) {
          return {
            success: false,
            action: 'memory_recovery_failed',
            message: 'Unable to free sufficient memory',
          };
        }
      },
    });

    // Generic fallback recovery
    this.registerStrategy({
      id: 'generic_fallback_recovery',
      name: 'Generic Fallback Recovery',
      description: 'Provides fallback data when specific recovery fails',
      priority: 10, // Lowest priority - last resort
      canRecover: () => true, // Can attempt for any error
      recover: async (context) => {
        const fallbackProvider = this.fallbackDataProviders.get(context.screenName || 'default');
        
        if (fallbackProvider) {
          try {
            const fallbackData = await fallbackProvider();
            Logger.info('Using fallback data for recovery', { screenName: context.screenName });
            
            return {
              success: true,
              action: 'fallback_data_provided',
              message: 'Using cached or fallback data',
              data: fallbackData,
            };
          } catch (fallbackError) {
            Logger.error('Fallback data provider failed', fallbackError as Error);
          }
        }

        return {
          success: false,
          action: 'no_recovery_available',
          message: 'No recovery strategy available for this error',
        };
      },
    });
  }

  public registerStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.id, strategy);
    Logger.info('Registered error recovery strategy', { 
      id: strategy.id, 
      name: strategy.name,
      priority: strategy.priority,
    });
  }

  public registerFallbackDataProvider(
    screenName: string, 
    provider: () => Promise<FallbackData>
  ): void {
    this.fallbackDataProviders.set(screenName, provider);
    Logger.info('Registered fallback data provider', { screenName });
  }

  public async recoverFromError(
    error: Error,
    additionalContext?: Partial<ErrorContext>
  ): Promise<RecoveryResult> {
    const contextId = this.generateContextId(error);
    const existingContext = this.errorContexts.get(contextId);

    const context: ErrorContext = {
      errorType: error.name,
      errorMessage: error.message,
      stackTrace: error.stack,
      timestamp: new Date().toISOString(),
      recoveryAttempts: existingContext ? existingContext.recoveryAttempts + 1 : 0,
      lastRecoveryAttempt: existingContext?.lastRecoveryAttempt,
      ...additionalContext,
    };

    // Check if we've exceeded max recovery attempts
    if (context.recoveryAttempts >= this.maxRecoveryAttempts) {
      Logger.error('Max recovery attempts exceeded', { 
        contextId, 
        attempts: context.recoveryAttempts,
        error: error.message,
      });
      
      return {
        success: false,
        action: 'max_attempts_exceeded',
        message: `Recovery failed after ${this.maxRecoveryAttempts} attempts`,
      };
    }

    // Update context
    this.errorContexts.set(contextId, context);
    await this.persistContexts();

    Logger.info('Attempting error recovery', {
      contextId,
      errorType: context.errorType,
      attempt: context.recoveryAttempts + 1,
    });

    // Get applicable strategies sorted by priority
    const applicableStrategies = Array.from(this.recoveryStrategies.values())
      .filter(strategy => strategy.canRecover(context))
      .sort((a, b) => a.priority - b.priority);

    Logger.debug('Found applicable recovery strategies', {
      count: applicableStrategies.length,
      strategies: applicableStrategies.map(s => s.name),
    });

    // Try each strategy in priority order
    for (const strategy of applicableStrategies) {
      try {
        Logger.debug('Trying recovery strategy', { strategy: strategy.name });
        
        const result = await Promise.race([
          strategy.recover(context),
          new Promise<RecoveryResult>((_, reject) =>
            setTimeout(() => reject(new Error('Recovery timeout')), this.recoveryTimeoutMs)
          ),
        ]);

        Logger.info('Recovery strategy executed', {
          strategy: strategy.name,
          success: result.success,
          action: result.action,
        });

        if (result.success) {
          // Mark recovery attempt
          context.lastRecoveryAttempt = new Date().toISOString();
          this.errorContexts.set(contextId, context);
          
          Logger.trackEvent('error.recovery_success', {
            contextId,
            strategy: strategy.name,
            action: result.action,
            attempts: context.recoveryAttempts,
          });

          return result;
        }
      } catch (strategyError) {
        Logger.error('Recovery strategy failed', strategyError as Error, {
          strategy: strategy.name,
          contextId,
        });
      }
    }

    // All strategies failed
    Logger.error('All recovery strategies failed', {
      contextId,
      strategiesAttempted: applicableStrategies.length,
    });

    Logger.trackEvent('error.recovery_failed', {
      contextId,
      strategiesAttempted: applicableStrategies.length,
      attempts: context.recoveryAttempts,
    });

    return {
      success: false,
      action: 'all_strategies_failed',
      message: 'Unable to recover from this error',
    };
  }

  public async clearRecoveryContext(error: Error): Promise<void> {
    const contextId = this.generateContextId(error);
    this.errorContexts.delete(contextId);
    await this.persistContexts();
    
    Logger.debug('Cleared recovery context', { contextId });
  }

  public getRecoveryHistory(): ErrorContext[] {
    return Array.from(this.errorContexts.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public async submitErrorReport(
    error: Error,
    userDescription?: string,
    includeContext: boolean = true
  ): Promise<boolean> {
    try {
      const contextId = this.generateContextId(error);
      const context = this.errorContexts.get(contextId);
      
      const report = {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        userDescription,
        context: includeContext ? context : undefined,
        timestamp: new Date().toISOString(),
        deviceInfo: {
          platform: 'mobile',
          // Add more device info as needed
        },
      };

      // In a real app, this would send to an error reporting service
      Logger.info('Error report prepared for submission', {
        contextId,
        hasUserDescription: !!userDescription,
        includeContext,
      });

      Logger.trackEvent('error.report_submitted', {
        contextId,
        errorType: error.name,
        hasUserDescription: !!userDescription,
      });

      return true;
    } catch (reportError) {
      Logger.error('Failed to submit error report', reportError as Error);
      return false;
    }
  }

  private generateContextId(error: Error): string {
    return `${error.name}_${error.message.substring(0, 50)}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private async loadPersistedContexts(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('error_recovery_contexts');
      if (stored) {
        const contexts = JSON.parse(stored);
        for (const [key, value] of Object.entries(contexts)) {
          this.errorContexts.set(key, value as ErrorContext);
        }
        Logger.debug('Loaded persisted recovery contexts', { count: this.errorContexts.size });
      }
    } catch (error) {
      Logger.warn('Failed to load persisted recovery contexts', error as Record<string, any>);
    }
  }

  private async persistContexts(): Promise<void> {
    try {
      const contexts = Object.fromEntries(this.errorContexts);
      await AsyncStorage.setItem('error_recovery_contexts', JSON.stringify(contexts));
    } catch (error) {
      Logger.warn('Failed to persist recovery contexts', error as Record<string, any>);
    }
  }

  public destroy(): void {
    this.errorContexts.clear();
    this.recoveryStrategies.clear();
    this.fallbackDataProviders.clear();
    Logger.info('ErrorRecoveryService destroyed');
  }
}

export const errorRecoveryService = ErrorRecoveryService.getInstance();