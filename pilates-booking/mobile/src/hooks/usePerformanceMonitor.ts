import { useEffect, useRef, useState, useCallback } from 'react';
import { InteractionManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../services/LoggingService';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface RenderTimeMetric {
  screenName: string;
  renderTime: number;
  componentCount: number;
  timestamp: string;
}

interface ApiPerformanceMetric {
  endpoint: string;
  method: string;
  responseTime: number;
  status: number;
  timestamp: string;
}

interface MemoryMetric {
  jsHeapSizeUsed: number;
  jsHeapSizeTotal: number;
  jsHeapSizeLimit: number;
  timestamp: string;
}

interface NetworkMetric {
  type: string;
  speed: number | null;
  isConnected: boolean;
  timestamp: string;
}

export interface PerformanceMonitorConfig {
  enableRenderTimeTracking: boolean;
  enableMemoryTracking: boolean;
  enableApiTracking: boolean;
  enableFrameRateTracking: boolean;
  enableNetworkTracking: boolean;
  sampleRate: number; // 0-1, percentage of events to capture
  maxMetricsStored: number;
  reportingInterval: number; // milliseconds
}

const DEFAULT_CONFIG: PerformanceMonitorConfig = {
  enableRenderTimeTracking: true,
  enableMemoryTracking: true,
  enableApiTracking: true,
  enableFrameRateTracking: true,
  enableNetworkTracking: true,
  sampleRate: 0.1, // 10% sampling rate
  maxMetricsStored: 1000,
  reportingInterval: 60000, // 1 minute
};

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private config: PerformanceMonitorConfig = DEFAULT_CONFIG;
  private metrics: PerformanceMetric[] = [];
  private frameTimestamps: number[] = [];
  private lastFrameTime: number = 0;
  private rafId?: number;
  private memoryCheckInterval?: NodeJS.Timeout;
  private reportingInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  private constructor() {
    this.loadConfig();
    this.startMonitoring();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private async loadConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('performance_monitor_config');
      if (stored) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (error) {
      Logger.warn('Failed to load performance monitor config', error as Record<string, any>);
    }
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  public updateConfig(newConfig: Partial<PerformanceMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    AsyncStorage.setItem('performance_monitor_config', JSON.stringify(this.config))
      .catch(error => Logger.warn('Failed to save performance config', error as Record<string, any>));
  }

  private addMetric(metric: PerformanceMetric): void {
    if (!this.shouldSample()) return;

    this.metrics.push(metric);
    
    // Limit stored metrics
    if (this.metrics.length > this.config.maxMetricsStored) {
      this.metrics = this.metrics.slice(-this.config.maxMetricsStored);
    }

    // Store metrics for dev tools
    AsyncStorage.setItem('performance_metrics', JSON.stringify(this.metrics))
      .catch(error => Logger.debug('Failed to store performance metrics', { error }));

    Logger.trackPerformance(metric.name, metric.value, metric.unit);
  }

  public trackRenderTime(screenName: string, startTime: number): void {
    if (!this.config.enableRenderTimeTracking) return;

    const renderTime = Date.now() - startTime;
    
    this.addMetric({
      name: 'screen_render_time',
      value: renderTime,
      unit: 'ms',
      timestamp: new Date().toISOString(),
      metadata: { screenName },
    });

    Logger.debug('Screen render time tracked', {
      screenName,
      renderTime,
      threshold: renderTime > 1000 ? 'slow' : 'normal',
    });

    if (renderTime > 1000) {
      Logger.warn('Slow screen render detected', {
        screenName,
        renderTime,
        context: 'performance_monitoring',
      });
    }
  }

  public trackApiCall(endpoint: string, method: string, responseTime: number, status: number): void {
    if (!this.config.enableApiTracking) return;

    this.addMetric({
      name: 'api_response_time',
      value: responseTime,
      unit: 'ms',
      timestamp: new Date().toISOString(),
      metadata: { endpoint, method, status },
    });

    if (responseTime > 3000) {
      Logger.warn('Slow API call detected', {
        endpoint,
        method,
        responseTime,
        status,
        context: 'performance_monitoring',
      });
    }
  }

  public trackMemoryUsage(): void {
    if (!this.config.enableMemoryTracking || !global.performance?.memory) return;

    const memory = global.performance.memory;
    
    this.addMetric({
      name: 'js_heap_used',
      value: memory.usedJSHeapSize || 0,
      unit: 'bytes',
      timestamp: new Date().toISOString(),
      metadata: {
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
      },
    });

    // Check for potential memory leaks
    const usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
    if (usagePercentage > 80) {
      Logger.warn('High memory usage detected', {
        usagePercentage: usagePercentage.toFixed(2),
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        context: 'performance_monitoring',
      });
    }
  }

  private trackFrameRate(): void {
    if (!this.config.enableFrameRateTracking) return;

    const now = Date.now();
    
    if (this.lastFrameTime > 0) {
      const frameDelta = now - this.lastFrameTime;
      this.frameTimestamps.push(frameDelta);
      
      // Keep only last 60 frames (1 second at 60fps)
      if (this.frameTimestamps.length > 60) {
        this.frameTimestamps = this.frameTimestamps.slice(-60);
      }
      
      // Calculate FPS every 30 frames
      if (this.frameTimestamps.length >= 30) {
        const avgFrameTime = this.frameTimestamps.reduce((a, b) => a + b, 0) / this.frameTimestamps.length;
        const fps = 1000 / avgFrameTime;
        
        this.addMetric({
          name: 'frame_rate',
          value: fps,
          unit: 'fps',
          timestamp: new Date().toISOString(),
          metadata: { frameCount: this.frameTimestamps.length },
        });

        if (fps < 30) {
          Logger.warn('Low frame rate detected', {
            fps: fps.toFixed(2),
            avgFrameTime: avgFrameTime.toFixed(2),
            context: 'performance_monitoring',
          });
        }
      }
    }
    
    this.lastFrameTime = now;
    this.rafId = requestAnimationFrame(() => this.trackFrameRate());
  }

  public trackImageLoadTime(imageUrl: string, loadTime: number): void {
    this.addMetric({
      name: 'image_load_time',
      value: loadTime,
      unit: 'ms',
      timestamp: new Date().toISOString(),
      metadata: { imageUrl },
    });

    if (loadTime > 2000) {
      Logger.warn('Slow image load detected', {
        imageUrl,
        loadTime,
        context: 'performance_monitoring',
      });
    }
  }

  public trackAnimationFrameRate(animationName: string): () => void {
    let frameCount = 0;
    let startTime = Date.now();
    let rafId: number;

    const trackFrame = () => {
      frameCount++;
      rafId = requestAnimationFrame(trackFrame);
    };

    rafId = requestAnimationFrame(trackFrame);

    // Return cleanup function
    return () => {
      cancelAnimationFrame(rafId);
      const duration = Date.now() - startTime;
      const fps = (frameCount / duration) * 1000;

      this.addMetric({
        name: 'animation_frame_rate',
        value: fps,
        unit: 'fps',
        timestamp: new Date().toISOString(),
        metadata: { animationName, duration, frameCount },
      });

      Logger.debug('Animation performance tracked', {
        animationName,
        fps: fps.toFixed(2),
        duration,
        frameCount,
      });
    };
  }

  public trackBundleLoadTime(bundleName: string, loadTime: number): void {
    this.addMetric({
      name: 'bundle_load_time',
      value: loadTime,
      unit: 'ms',
      timestamp: new Date().toISOString(),
      metadata: { bundleName },
    });

    Logger.info('Bundle load time tracked', {
      bundleName,
      loadTime,
      threshold: loadTime > 5000 ? 'slow' : 'normal',
    });
  }

  private startMonitoring(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Start frame rate tracking
    if (this.config.enableFrameRateTracking) {
      this.trackFrameRate();
    }

    // Start memory usage tracking
    if (this.config.enableMemoryTracking) {
      this.memoryCheckInterval = setInterval(() => {
        this.trackMemoryUsage();
      }, 10000); // Every 10 seconds
    }

    // Start periodic reporting
    this.reportingInterval = setInterval(() => {
      this.generatePerformanceReport();
    }, this.config.reportingInterval);

    Logger.info('Performance monitoring started', {
      config: this.config,
      context: 'performance_monitoring',
    });
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) return;
    this.isMonitoring = false;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }

    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
    }

    Logger.info('Performance monitoring stopped', {
      context: 'performance_monitoring',
    });
  }

  private generatePerformanceReport(): void {
    const recentMetrics = this.metrics.filter(
      metric => Date.now() - new Date(metric.timestamp).getTime() < this.config.reportingInterval
    );

    const report = {
      period: {
        start: new Date(Date.now() - this.config.reportingInterval).toISOString(),
        end: new Date().toISOString(),
      },
      metricCounts: recentMetrics.reduce((acc, metric) => {
        acc[metric.name] = (acc[metric.name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      averages: {} as Record<string, number>,
      warnings: recentMetrics.filter(metric => this.isSlowMetric(metric)).length,
    };

    // Calculate averages
    Object.keys(report.metricCounts).forEach(metricName => {
      const values = recentMetrics
        .filter(m => m.name === metricName)
        .map(m => m.value);
      
      if (values.length > 0) {
        report.averages[metricName] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    });

    Logger.trackEvent('performance.report_generated', {
      ...report,
      totalMetrics: recentMetrics.length,
    });
  }

  private isSlowMetric(metric: PerformanceMetric): boolean {
    const thresholds: Record<string, number> = {
      'screen_render_time': 1000,
      'api_response_time': 3000,
      'image_load_time': 2000,
      'frame_rate': 30, // Below 30 FPS is considered slow
      'bundle_load_time': 5000,
    };

    const threshold = thresholds[metric.name];
    if (!threshold) return false;

    return metric.name === 'frame_rate' ? metric.value < threshold : metric.value > threshold;
  }

  public getMetrics(metricName?: string): PerformanceMetric[] {
    return metricName 
      ? this.metrics.filter(m => m.name === metricName)
      : [...this.metrics];
  }

  public clearMetrics(): void {
    this.metrics = [];
    AsyncStorage.removeItem('performance_metrics')
      .catch(error => Logger.debug('Failed to clear performance metrics', { error }));
    
    Logger.info('Performance metrics cleared', {
      context: 'performance_monitoring',
    });
  }
}

export const usePerformanceMonitor = () => {
  const monitor = useRef(PerformanceMonitor.getInstance()).current;
  const [isEnabled, setIsEnabled] = useState(true);

  // Screen render time tracking
  const trackScreenRender = useCallback((screenName: string) => {
    const startTime = Date.now();
    
    // Return cleanup function to be called in useEffect cleanup
    return () => {
      if (isEnabled) {
        InteractionManager.runAfterInteractions(() => {
          monitor.trackRenderTime(screenName, startTime);
        });
      }
    };
  }, [monitor, isEnabled]);

  // Image load time tracking
  const trackImageLoad = useCallback((imageUrl: string) => {
    const startTime = Date.now();
    
    return () => {
      if (isEnabled) {
        const loadTime = Date.now() - startTime;
        monitor.trackImageLoadTime(imageUrl, loadTime);
      }
    };
  }, [monitor, isEnabled]);

  // Animation performance tracking
  const trackAnimation = useCallback((animationName: string) => {
    if (!isEnabled) return () => {};
    return monitor.trackAnimationFrameRate(animationName);
  }, [monitor, isEnabled]);

  // Bundle load time tracking
  const trackBundleLoad = useCallback((bundleName: string, loadTime: number) => {
    if (isEnabled) {
      monitor.trackBundleLoadTime(bundleName, loadTime);
    }
  }, [monitor, isEnabled]);

  // Configuration
  const updateConfig = useCallback((config: Partial<PerformanceMonitorConfig>) => {
    monitor.updateConfig(config);
  }, [monitor]);

  // Data access
  const getMetrics = useCallback((metricName?: string) => {
    return monitor.getMetrics(metricName);
  }, [monitor]);

  const clearMetrics = useCallback(() => {
    monitor.clearMetrics();
  }, [monitor]);

  // Control
  const startMonitoring = useCallback(() => {
    setIsEnabled(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    setIsEnabled(false);
    monitor.stopMonitoring();
  }, [monitor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (__DEV__) {
        // Only stop monitoring in development, keep running in production
        monitor.stopMonitoring();
      }
    };
  }, [monitor]);

  return {
    trackScreenRender,
    trackImageLoad,
    trackAnimation,
    trackBundleLoad,
    updateConfig,
    getMetrics,
    clearMetrics,
    startMonitoring,
    stopMonitoring,
    isEnabled,
  };
};

export default usePerformanceMonitor;