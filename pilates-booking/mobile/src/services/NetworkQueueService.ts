import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Logger } from './LoggingService';

interface QueuedRequest {
  id: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  lastAttempt?: string;
  exponentialBackoff: boolean;
  conflictKey?: string;
}

interface QueuedRequestOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical';
  maxRetries?: number;
  exponentialBackoff?: boolean;
  conflictKey?: string;
  headers?: Record<string, string>;
}

interface NetworkQueueConfig {
  maxQueueSize: number;
  batchSize: number;
  retryIntervalMs: number;
  maxRetryDelayMs: number;
  persistQueue: boolean;
}

export class NetworkQueueService {
  private static instance: NetworkQueueService;
  private queue: QueuedRequest[] = [];
  private processing = false;
  private isOnline = true;
  private retryTimer?: NodeJS.Timeout;
  
  private readonly config: NetworkQueueConfig = {
    maxQueueSize: 100,
    batchSize: 5,
    retryIntervalMs: 5000,
    maxRetryDelayMs: 60000,
    persistQueue: true,
  };
  
  private readonly STORAGE_KEY = 'network_queue';
  private readonly CONFLICT_STORAGE_KEY = 'network_conflicts';

  private constructor() {
    this.initializeNetworkListener();
    this.loadPersistedQueue();
  }

  public static getInstance(): NetworkQueueService {
    if (!NetworkQueueService.instance) {
      NetworkQueueService.instance = new NetworkQueueService();
    }
    return NetworkQueueService.instance;
  }

  private initializeNetworkListener(): void {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      Logger.info('Network state changed', {
        isConnected: this.isOnline,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
        wasOnline,
      });

      if (!wasOnline && this.isOnline) {
        Logger.info('Network restored, processing queued requests');
        this.processQueue();
      } else if (wasOnline && !this.isOnline) {
        Logger.warn('Network lost, requests will be queued');
        this.stopProcessing();
      }
    });
  }

  private async loadPersistedQueue(): Promise<void> {
    if (!this.config.persistQueue) return;

    try {
      const queueData = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (queueData) {
        this.queue = JSON.parse(queueData);
        Logger.info('Loaded persisted queue', { queueSize: this.queue.length });
      }
    } catch (error) {
      Logger.error('Failed to load persisted queue', error as Error);
    }
  }

  private async persistQueue(): Promise<void> {
    if (!this.config.persistQueue) return;

    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      Logger.error('Failed to persist queue', error as Error);
    }
  }

  public async enqueue(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: any,
    options: QueuedRequestOptions = {}
  ): Promise<string> {
    const requestId = this.generateRequestId();
    const now = new Date().toISOString();
    
    const request: QueuedRequest = {
      id: requestId,
      url,
      method,
      headers: options.headers,
      body,
      priority: options.priority || 'normal',
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      createdAt: now,
      exponentialBackoff: options.exponentialBackoff ?? true,
      conflictKey: options.conflictKey,
    };

    // Handle conflict resolution
    if (request.conflictKey) {
      this.resolveConflict(request);
    }

    // Check queue size limit
    if (this.queue.length >= this.config.maxQueueSize) {
      this.removeOldestLowPriorityRequests();
    }

    // Insert based on priority
    this.insertByPriority(request);
    await this.persistQueue();

    Logger.info('Request queued', {
      requestId,
      url,
      method,
      priority: request.priority,
      queueSize: this.queue.length,
      isOnline: this.isOnline,
    });

    Logger.trackEvent('network.request_queued', {
      requestId,
      url: this.sanitizeUrl(url),
      method,
      priority: request.priority,
      queueSize: this.queue.length,
      isOnline: this.isOnline,
    });

    // Process immediately if online
    if (this.isOnline) {
      this.processQueue();
    }

    return requestId;
  }

  private resolveConflict(newRequest: QueuedRequest): void {
    if (!newRequest.conflictKey) return;

    const existingIndex = this.queue.findIndex(
      req => req.conflictKey === newRequest.conflictKey
    );

    if (existingIndex !== -1) {
      const existingRequest = this.queue[existingIndex];
      Logger.info('Resolving request conflict', {
        conflictKey: newRequest.conflictKey,
        existingId: existingRequest.id,
        newId: newRequest.id,
      });

      // Remove the existing request
      this.queue.splice(existingIndex, 1);
      
      Logger.trackEvent('network.conflict_resolved', {
        conflictKey: newRequest.conflictKey,
        replacedRequestId: existingRequest.id,
        newRequestId: newRequest.id,
      });
    }
  }

  private removeOldestLowPriorityRequests(): void {
    const lowPriorityRequests = this.queue.filter(req => req.priority === 'low');
    if (lowPriorityRequests.length > 0) {
      const oldestLowPriority = lowPriorityRequests.reduce((oldest, current) =>
        new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest
      );
      
      this.queue = this.queue.filter(req => req.id !== oldestLowPriority.id);
      
      Logger.warn('Removed oldest low priority request due to queue limit', {
        removedRequestId: oldestLowPriority.id,
        queueSize: this.queue.length,
      });
    } else {
      // Remove oldest request regardless of priority
      this.queue.shift();
      Logger.warn('Removed oldest request due to queue limit', {
        queueSize: this.queue.length,
      });
    }
  }

  private insertByPriority(request: QueuedRequest): void {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const requestPriority = priorityOrder[request.priority];
    
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      const queuePriority = priorityOrder[this.queue[i].priority];
      if (requestPriority < queuePriority) {
        insertIndex = i;
        break;
      }
    }
    
    this.queue.splice(insertIndex, 0, request);
  }

  public async processQueue(): Promise<void> {
    if (this.processing || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    Logger.info('Starting queue processing', { queueSize: this.queue.length });

    try {
      const batch = this.queue.splice(0, this.config.batchSize);
      const results = await Promise.allSettled(
        batch.map(request => this.executeRequest(request))
      );

      const failed: QueuedRequest[] = [];
      
      results.forEach((result, index) => {
        const request = batch[index];
        
        if (result.status === 'rejected') {
          if (request.retryCount < request.maxRetries) {
            request.retryCount++;
            request.lastAttempt = new Date().toISOString();
            failed.push(request);
          } else {
            Logger.error('Request permanently failed after max retries', result.reason, {
              requestId: request.id,
              url: request.url,
              retryCount: request.retryCount,
            });
            
            Logger.trackEvent('network.request_permanently_failed', {
              requestId: request.id,
              url: this.sanitizeUrl(request.url),
              method: request.method,
              retryCount: request.retryCount,
              maxRetries: request.maxRetries,
            });
          }
        } else {
          Logger.info('Request executed successfully', {
            requestId: request.id,
            url: request.url,
          });
          
          Logger.trackEvent('network.request_executed', {
            requestId: request.id,
            url: this.sanitizeUrl(request.url),
            method: request.method,
            retryCount: request.retryCount,
          });
        }
      });

      // Re-queue failed requests with exponential backoff
      if (failed.length > 0) {
        for (const request of failed) {
          const delay = this.calculateBackoffDelay(request);
          setTimeout(() => {
            this.insertByPriority(request);
          }, delay);
        }
      }

      await this.persistQueue();
      
      // Continue processing if there are more items
      if (this.queue.length > 0 && this.isOnline) {
        setTimeout(() => this.processQueue(), 100);
      }
      
    } catch (error) {
      Logger.error('Queue processing error', error as Error);
    } finally {
      this.processing = false;
    }
  }

  private async executeRequest(request: QueuedRequest): Promise<Response> {
    const { url, method, headers, body } = request;
    
    Logger.debug('Executing queued request', {
      requestId: request.id,
      url,
      method,
      retryCount: request.retryCount,
    });

    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body && method !== 'GET') {
      requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, requestOptions);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response;
  }

  private calculateBackoffDelay(request: QueuedRequest): number {
    if (!request.exponentialBackoff) {
      return this.config.retryIntervalMs;
    }

    const baseDelay = this.config.retryIntervalMs;
    const exponentialDelay = baseDelay * Math.pow(2, request.retryCount - 1);
    const jitter = Math.random() * 1000; // Add jitter to prevent thundering herd
    
    return Math.min(exponentialDelay + jitter, this.config.maxRetryDelayMs);
  }

  private stopProcessing(): void {
    this.processing = false;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  public getQueueStatus(): {
    size: number;
    processing: boolean;
    isOnline: boolean;
    requests: Array<{
      id: string;
      url: string;
      method: string;
      priority: string;
      retryCount: number;
      createdAt: string;
    }>;
  } {
    return {
      size: this.queue.length,
      processing: this.processing,
      isOnline: this.isOnline,
      requests: this.queue.map(req => ({
        id: req.id,
        url: this.sanitizeUrl(req.url),
        method: req.method,
        priority: req.priority,
        retryCount: req.retryCount,
        createdAt: req.createdAt,
      })),
    };
  }

  public async clearQueue(): Promise<void> {
    this.queue = [];
    await this.persistQueue();
    
    Logger.info('Queue cleared manually');
    Logger.trackEvent('network.queue_cleared', {
      manual: true,
      timestamp: new Date().toISOString(),
    });
  }

  public removeRequest(requestId: string): boolean {
    const index = this.queue.findIndex(req => req.id === requestId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.persistQueue();
      
      Logger.info('Request removed from queue', { requestId });
      Logger.trackEvent('network.request_removed', { requestId });
      return true;
    }
    return false;
  }

  public updateConfig(config: Partial<NetworkQueueConfig>): void {
    Object.assign(this.config, config);
    Logger.info('Network queue config updated', { config: this.config });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeUrl(url: string): string {
    // Remove sensitive data from URLs for logging
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.forEach((value, key) => {
        if (key.toLowerCase().includes('token') || 
            key.toLowerCase().includes('key') || 
            key.toLowerCase().includes('secret')) {
          urlObj.searchParams.set(key, '[REDACTED]');
        }
      });
      return urlObj.toString();
    } catch {
      return url.replace(/([?&])(token|key|secret)=[^&]*/gi, '$1$2=[REDACTED]');
    }
  }

  public destroy(): void {
    this.stopProcessing();
    this.clearQueue();
    Logger.info('NetworkQueueService destroyed');
  }
}

export const networkQueue = NetworkQueueService.getInstance();