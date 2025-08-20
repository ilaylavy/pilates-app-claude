import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, BACKUP_API_URLS, STORAGE_KEYS } from '../utils/config';

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
      console.warn(`❌ Failed to connect to primary URL: ${this.currentBaseURL}`, error.message);
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
        console.warn(`❌ Backup URL failed: ${backupUrl} - ${error.message}`);
      }
    }
    console.error('❌ No working API URLs found. Check your network connection and backend status.');
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.instance.interceptors.request.use(
      async (config) => {
        try {
          const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.warn('Failed to retrieve access token from secure store:', error);
        }
        
        // Handle FormData uploads properly
        if (config.data instanceof FormData) {
          delete config.headers['Content-Type']; // Let browser set it
        }
        
        // Debug logging
        const fullUrl = new URL(config.url ?? '', config.baseURL).toString();
        console.log(`API Request: ${config.method?.toUpperCase()} ${fullUrl}`);
        
        return config;
      },
      (error) => {
        console.warn('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    this.instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Enhanced error logging for debugging
        if (error.code === 'ECONNABORTED') {
          console.warn('API Request timeout:', error.config?.url);
        } else if (error.code === 'ERR_NETWORK' || error.code === 'NETWORK_ERROR' || !error.response) {
          console.warn('Network error:', {
            url: error.config?.url,
            baseURL: this.currentBaseURL,
            code: error.code,
            message: error.message
          });
          
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
            if (refreshToken) {
              const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
                refresh_token: refreshToken,
              }, { timeout: 15000 }); // Shorter timeout for refresh

              const { access_token, refresh_token: newRefreshToken } = response.data;
              
              await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, access_token);
              await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);

              originalRequest.headers.Authorization = `Bearer ${access_token}`;
              return this.instance(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            await this.clearTokens();
            console.warn('Token refresh failed:', refreshError);
            return Promise.reject(refreshError);
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
