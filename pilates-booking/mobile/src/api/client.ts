import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, BACKUP_API_URLS, STORAGE_KEYS } from '../utils/config';
import { Logger } from '../services/LoggingService';

class ApiClient {
  private instance: AxiosInstance;
  private currentBaseURL: string = API_BASE_URL;

  private buildUrl(url: string): string {
    return url.startsWith('/') ? url : `/${url}`;
  }

  constructor() {
    this.instance = axios.create({
      baseURL: this.currentBaseURL,
      timeout: 8000, // Faster timeout for quicker fallback to backup URLs
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
    this.testConnection();
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
    for (const backupUrl of BACKUP_API_URLS) {
      try {
        const response = await axios.get(`${backupUrl}/health`, { timeout: 3000 });
        console.log(`✅ Found working backup URL: ${backupUrl}`, response.data);
        this.currentBaseURL = backupUrl;
        this.instance.defaults.baseURL = backupUrl;
        return;
      } catch (error) {
        console.warn(`❌ Backup URL failed: ${backupUrl} - ${(error as Error).message}`);
      }
    }
    console.error('❌ No working API URLs found. Check your network connection and backend status.');
  }

  private setupInterceptors() {
    // Request interceptor to add auth token and logging
    this.instance.interceptors.request.use(
      async (config) => {
        const startTime = Date.now();
        (config as any).metadata = { startTime };
        
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
          delete config.headers['Content-Type']; // Let browser set it
        }
        
        // Comprehensive request logging
        const fullUrl = new URL(config.url ?? '', config.baseURL).toString();
        Logger.debug('API request started', {
          method: config.method?.toUpperCase(),
          url: fullUrl,
          baseURL: config.baseURL,
          timeout: config.timeout,
          hasAuth: !!config.headers.Authorization,
          contentType: config.headers['Content-Type'],
          requestSize: config.data ? JSON.stringify(config.data).length : 0
        });
        
        // Track API call initiation
        Logger.trackEvent('api.request_started', {
          method: config.method?.toUpperCase(),
          endpoint: config.url,
          baseURL: config.baseURL,
          timestamp: new Date().toISOString()
        });
        
        return config;
      },
      (error) => {
        Logger.error('Request interceptor error', error, {
          errorType: 'request_interceptor_error'
        });
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh and logging
    this.instance.interceptors.response.use(
      (response) => {
        const duration = (response.config as any).metadata ? Date.now() - (response.config as any).metadata.startTime : 0;
        
        // Log successful response
        Logger.debug('API request completed', {
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status,
          statusText: response.statusText,
          duration,
          responseSize: JSON.stringify(response.data).length
        });
        
        // Track successful API call
        Logger.trackApiCall(
          response.config.url || 'unknown',
          response.config.method?.toUpperCase() || 'GET',
          response.status,
          duration / 1000 // Convert to seconds
        );
        
        // Log slow requests
        if (duration > 3000) {
          Logger.warn('Slow API request detected', {
            method: response.config.method?.toUpperCase(),
            url: response.config.url,
            duration,
            status: response.status
          });
        }
        
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        const duration = originalRequest?.metadata ? Date.now() - originalRequest.metadata.startTime : 0;
        
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
        
        if (error.code === 'ECONNABORTED') {
          Logger.warn('API request timeout', errorDetails);
          Logger.trackEvent('api.timeout', {
            url: originalRequest?.url,
            duration,
            timeout: originalRequest?.timeout
          });
        } else if (error.code === 'ERR_NETWORK' || error.code === 'NETWORK_ERROR' || !error.response) {
          Logger.error('Network error', error, errorDetails);
          Logger.trackEvent('api.network_error', {
            url: originalRequest?.url,
            code: error.code,
            message: error.message
          });
        } else {
          Logger.error('API request failed', error, errorDetails);
          // Also console log for immediate debugging
          console.error('[ERROR] API request failed', {
            fullUrl,
            method: errorDetails.method,
            status: errorDetails.status,
            code: errorDetails.code,
            message: errorDetails.message,
            requestData: errorDetails.requestData,
            responseData: errorDetails.responseData
          });
        }
        
        // Track failed API call
        Logger.trackApiCall(
          originalRequest?.url || 'unknown',
          originalRequest?.method?.toUpperCase() || 'GET',
          error.response?.status || 0,
          duration / 1000,
          error.message
        );

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          Logger.info('Attempting token refresh for 401 error', {
            url: originalRequest?.url,
            method: originalRequest?.method
          });

          try {
            const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
            if (refreshToken) {
              Logger.debug('Refresh token found, attempting refresh');
              
              const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
                refresh_token: refreshToken,
              }, { timeout: 15000 }); // Shorter timeout for refresh

              const { access_token, refresh_token: newRefreshToken } = response.data;
              
              await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, access_token);
              await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);

              // Log successful token refresh
              Logger.info('Token refresh successful');
              Logger.trackEvent('auth.token_refreshed', {
                url: originalRequest?.url,
                timestamp: new Date().toISOString()
              });

              originalRequest.headers.Authorization = `Bearer ${access_token}`;
              return this.instance(originalRequest);
            } else {
              Logger.warn('No refresh token found for 401 error');
            }
          } catch (refreshError) {
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
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async clearTokens() {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA),
      ]);
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
