import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, BACKUP_API_URLS, STORAGE_KEYS } from '../utils/config';
import { Logger } from '../services/LoggingService';
import { networkQueue } from '../services/NetworkQueueService';
import NetInfo from '@react-native-community/netinfo';

interface RequestCache {
  [key: string]: {
    response: AxiosResponse;
    timestamp: number;
  };
}

interface RequestDeduplication {
  [key: string]: Promise<AxiosResponse>;
}

class ApiClient {
  private instance: AxiosInstance;
  private currentBaseURL: string = API_BASE_URL;
  private refreshPromise: Promise<string> | null = null;
  private isRefreshing: boolean = false;
  private failedQueue: {
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  }[] = [];
  private requestCache: RequestCache = {};
  private pendingRequests: RequestDeduplication = {};
  private isOnline: boolean = true;
  private retryConfig = {
    retries: 3,
    retryDelay: 1000,
    retryDelayMultiplier: 2,
    maxRetryDelay: 10000,
  };

  private buildUrl(url: string): string {
    return url.startsWith('/') ? url : `/${url}`;
  }

  constructor() {
    this.instance = axios.create({
      baseURL: this.currentBaseURL,
      timeout: 8000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
    this.setupNetworkMonitoring();
    this.testConnection();
    this.startCacheCleanup();
  }

  private setupNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected ?? false;
      // Only log significant network changes
      if (__DEV__) {
        console.log(`📡 Network: ${this.isOnline ? 'Online' : 'Offline'} (${state.type})`);
      }
    });
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      this.cleanupCache();
    }, 300000); // Clean cache every 5 minutes
  }

  private cleanupCache(): void {
    const now = Date.now();
    const cacheExpiryMs = 300000; // 5 minutes
    
    Object.keys(this.requestCache).forEach(key => {
      if (now - this.requestCache[key].timestamp > cacheExpiryMs) {
        delete this.requestCache[key];
      }
    });
  }

  private shouldRetryRequest(error: any, config: any): boolean {
    // Don't retry if already exceeded max retries
    const retryCount = config?._retryCount || 0;
    if (retryCount >= this.retryConfig.retries) {
      return false;
    }

    // Don't retry authentication errors or 4xx client errors (except 408, 429)
    const status = error.response?.status;
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      return false;
    }

    // Retry network errors, timeouts, and 5xx server errors
    const shouldRetry = 
      error.code === 'ECONNABORTED' || // Timeout
      error.code === 'ERR_NETWORK' || // Network error
      error.code === 'NETWORK_ERROR' ||
      !error.response || // No response received
      (status >= 500 && status < 600) || // Server error
      status === 408 || // Request timeout
      status === 429; // Too many requests

    return shouldRetry;
  }

  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.retryConfig.retryDelay;
    const multiplier = this.retryConfig.retryDelayMultiplier;
    const maxDelay = this.retryConfig.maxRetryDelay;
    
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(multiplier, retryCount - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second jitter
    const delay = Math.min(exponentialDelay + jitter, maxDelay);
    
    return delay;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async testConnection(): Promise<void> {
    try {
      const response = await axios.get(`${this.currentBaseURL}/health`, { timeout: 3000 });
      console.log(`✅ Connected to API at: ${this.currentBaseURL}`, response.data);
    } catch (error) {
      console.warn(`❌ Failed to connect to primary URL: ${this.currentBaseURL}`, (error as Error).message);
      await this.tryBackupUrls();
    }
  }

  private async tryBackupUrls(): Promise<void> {
    console.log('🔄 Trying backup URLs...');
    const originalBaseURL = this.currentBaseURL;
    
    for (const backupUrl of BACKUP_API_URLS) {
      try {
        const response = await axios.get(`${backupUrl}/health`, { timeout: 3000 });
        console.log(`✅ Found working backup URL: ${backupUrl}`, response.data);
        
        // If we're switching to a different URL, clear tokens as they may not be valid
        if (backupUrl !== originalBaseURL) {
          console.warn('⚠️ API URL changed - clearing tokens to prevent auth issues');
          await this.clearTokens();
        }
        
        this.currentBaseURL = backupUrl;
        this.instance.defaults.baseURL = backupUrl;
        return;
      } catch (error) {
        console.warn(`❌ Backup URL failed: ${backupUrl} - ${(error as Error).message}`);
      }
    }
    console.error('❌ No working API URLs found. Check your network connection and backend status.');
  }

  private generateRequestKey(config: AxiosRequestConfig): string {
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';
    const params = JSON.stringify(config.params || {});
    const data = config.data ? JSON.stringify(config.data) : '';
    return `${method}:${url}:${params}:${data}`;
  }

  private shouldCacheRequest(config: AxiosRequestConfig): boolean {
    const method = config.method?.toUpperCase();
    return method === 'GET' && !config.url?.includes('/auth/');
  }

  private shouldDeduplicateRequest(config: AxiosRequestConfig): boolean {
    const method = config.method?.toUpperCase();
    return ['GET', 'PUT', 'PATCH'].includes(method || 'GET');
  }

  private async shouldQueueOfflineRequest(config: AxiosRequestConfig): Promise<boolean> {
    if (this.isOnline) return false;
    
    const method = config.method?.toUpperCase();
    const isReadOperation = method === 'GET';
    const isAuthRequest = config.url?.includes('/auth/');
    
    return !isReadOperation && !isAuthRequest;
  }

  private setupInterceptors() {
    // Enhanced request interceptor
    this.instance.interceptors.request.use(
      async (config) => {
        const startTime = Date.now();
        const requestKey = this.generateRequestKey(config);
        (config as any).metadata = { startTime, requestKey };
        
        try {
          const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          Logger.warn('Failed to retrieve access token from secure store', error as Record<string, any>);
        }
        
        // Handle FormData uploads properly
        if (config.data instanceof FormData) {
          delete config.headers['Content-Type'];
        }
        
        // Request deduplication (no logging for performance)
        if (this.shouldDeduplicateRequest(config) && this.pendingRequests[requestKey]) {
          return this.pendingRequests[requestKey];
        }
        
        // Cache lookup for GET requests (no logging for performance)
        if (this.shouldCacheRequest(config)) {
          const cachedResponse = this.requestCache[requestKey];
          if (cachedResponse && (Date.now() - cachedResponse.timestamp) < 300000) { // 5 min cache
            return Promise.resolve(cachedResponse.response.config);
          }
        }
        
        // Queue offline requests
        if (await this.shouldQueueOfflineRequest(config)) {
          const queueId = await networkQueue.enqueue(
            config.url!,
            config.method!.toUpperCase() as any,
            config.data,
            {
              priority: config.url?.includes('/booking') ? 'high' : 'normal',
              headers: config.headers as Record<string, string>,
              maxRetries: 3,
            }
          );
          
          Logger.info('Request queued for offline processing', { queueId, requestKey });
          Logger.trackEvent('api.request_queued_offline', { queueId, requestKey });
          
          throw new Error('Request queued - device is offline');
        }
        
        // Only log important requests (errors will still be logged)
        if (__DEV__ && config.url?.includes('/auth/')) {
          console.log(`🔐 Auth request: ${config.method?.toUpperCase()} ${config.url}`);
        }
        
        return config;
      },
      (error) => {
        Logger.error('Request interceptor error', error, {
          errorType: 'request_interceptor_error'
        });
        return Promise.reject(error);
      }
    );

    // Enhanced response interceptor
    this.instance.interceptors.response.use(
      (response) => {
        const metadata = (response.config as any).metadata;
        const duration = metadata ? Date.now() - metadata.startTime : 0;
        const requestKey = metadata?.requestKey;
        
        // Clean up pending request tracking
        if (requestKey && this.pendingRequests[requestKey]) {
          delete this.pendingRequests[requestKey];
        }
        
        // Cache GET responses
        if (requestKey && this.shouldCacheRequest(response.config)) {
          this.requestCache[requestKey] = {
            response,
            timestamp: Date.now(),
          };
        }
        
        // Only log slow requests and auth responses
        if (duration > 5000) {
          console.warn(`⏱️ Slow request: ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`);
        }
        
        if (__DEV__ && response.config.url?.includes('/auth/')) {
          console.log(`✅ Auth response: ${response.status} ${response.config.url}`);
        }
        
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        const metadata = originalRequest?.metadata;
        const duration = metadata ? Date.now() - metadata.startTime : 0;
        const requestKey = metadata?.requestKey;
        
        // Clean up pending request tracking
        if (requestKey && this.pendingRequests[requestKey]) {
          delete this.pendingRequests[requestKey];
        }
        
        // Retry logic with exponential backoff
        const shouldRetry = this.shouldRetryRequest(error, originalRequest);
        if (shouldRetry) {
          const retryCount = (originalRequest._retryCount || 0) + 1;
          const delay = this.calculateRetryDelay(retryCount);
          
          console.log(`🔄 Retrying request ${retryCount}/${this.retryConfig.retries}: ${originalRequest?.url}`);
          
          // Set retry metadata
          originalRequest._retryCount = retryCount;
          originalRequest.metadata = {
            ...metadata,
            startTime: Date.now(),
          };
          
          // Wait for delay then retry
          await this.delay(delay);
          return this.instance.request(originalRequest);
        }
        
        // Comprehensive error logging
        const fullUrl = originalRequest?.url ? 
          new URL(originalRequest.url, this.currentBaseURL).toString() : 
          'unknown';
        const errorDetails = {
          method: originalRequest?.method?.toUpperCase(),
          url: originalRequest?.url,
          fullUrl,
          baseURL: this.currentBaseURL,
          status: error.response?.status,
          statusText: error.response?.statusText,
          code: error.code,
          message: error.message,
          duration,
          requestData: originalRequest?.data ? (typeof originalRequest.data === 'string' ? originalRequest.data : JSON.stringify(originalRequest.data).substring(0, 200)) : null,
          responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : null,
          errorType: 'api_request_error'
        };
        
        // Only log errors (not every successful request)
        if (error.response?.status >= 400) {
          console.error(`❌ API Error: ${errorDetails.method} ${originalRequest?.url} - ${errorDetails.status} ${errorDetails.message}`);
          if (errorDetails.responseData) {
            console.error('Response:', errorDetails.responseData);
          }
        } else if (error.code === 'ECONNABORTED') {
          console.warn(`⏱️ Timeout: ${originalRequest?.url}`);
        } else if (error.code === 'ERR_NETWORK' || !error.response) {
          console.warn(`🌐 Network error: ${originalRequest?.url} - ${error.message}`);
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          Logger.info('Attempting token refresh for 401 error', {
            url: originalRequest?.url,
            method: originalRequest?.method
          });

          // If we're already refreshing, queue this request
          if (this.isRefreshing) {
            return new Promise((resolve, reject) => {
              this.failedQueue.push({
                resolve: (token: string) => {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                  resolve(this.instance(originalRequest));
                },
                reject: (err: any) => {
                  reject(err);
                }
              });
            });
          }

          // Set refreshing flag and start refresh process
          this.isRefreshing = true;

          try {
            // Perform token refresh
            const accessToken = await this.performTokenRefresh();
            
            // Process queued requests with new token
            this.processQueue(accessToken, null);
            
            // Update current request and execute
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return this.instance(originalRequest);
            
          } catch (refreshError) {
            // Process queued requests with error
            this.processQueue(null, refreshError);
            
            // Refresh failed, redirect to login
            Logger.error('Token refresh failed', refreshError as Error, {
              url: originalRequest?.url,
              errorType: 'token_refresh_failed'
            });
            
            Logger.trackEvent('auth.token_refresh_failed', {
              error: (refreshError as Error).message,
              timestamp: new Date().toISOString()
            });
            
            // Clear tokens and force login
            await this.clearTokens();
            
            // Return 401 error to trigger app-wide logout
            return Promise.reject(new Error('Authentication failed - please log in again'));
          } finally {
            // Reset refreshing state
            this.isRefreshing = false;
            this.refreshPromise = null;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private processQueue(token: string | null, error: any) {
    /**
     * Process all queued requests after token refresh completes.
     * Either resolves with new token or rejects with error.
     */
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else if (token) {
        resolve(token);
      } else {
        reject(new Error('Token refresh succeeded but no token provided'));
      }
    });
    
    // Clear the queue
    this.failedQueue = [];
  }

  private async performTokenRefresh(): Promise<string> {
    const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      throw new Error('No refresh token found');
    }

    Logger.debug('Refresh token found, attempting refresh');
    
    try {
      // Use the current working base URL with shorter timeout for refresh
      const response = await axios.post(`${this.currentBaseURL}/api/v1/auth/refresh`, {
        refresh_token: refreshToken,
      }, { 
        timeout: 10000,  // 10 second timeout for refresh
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });

      if (response.status !== 200) {
        throw new Error(`Token refresh failed with status ${response.status}: ${response.data?.message || 'Unknown error'}`);
      }

      const { access_token, refresh_token: newRefreshToken } = response.data;
      
      if (!access_token || !newRefreshToken) {
        throw new Error('Invalid token refresh response: missing tokens');
      }
      
      // Atomically store both tokens
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, access_token),
        SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken)
      ]);

      // Log successful token refresh
      Logger.info('Token refresh successful');
      Logger.trackEvent('auth.token_refreshed', {
        timestamp: new Date().toISOString()
      });

      return access_token;
      
    } catch (error: any) {
      // Enhanced error handling for token refresh
      Logger.error('Token refresh failed', error, {
        errorCode: error.code,
        errorMessage: error.message,
        responseStatus: error.response?.status,
        responseData: error.response?.data
      });

      // Clear invalid tokens on certain errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        Logger.warn('Clearing tokens due to auth error during refresh');
        await this.clearTokens();
      }

      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  async clearTokens() {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA),
      ]);
      
      // Clear internal cache and pending requests
      this.requestCache = {};
      this.pendingRequests = {};
      this.isRefreshing = false;
      this.refreshPromise = null;
      this.failedQueue = [];
    } catch (error) {
      console.warn('Failed to clear tokens from secure store:', error);
    }
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.get(this.buildUrl(url), config);
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.post(this.buildUrl(url), data, config);
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.put(this.buildUrl(url), data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.patch(this.buildUrl(url), data, config);
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.instance.delete(this.buildUrl(url), config);
  }
}

export const apiClient = new ApiClient();
