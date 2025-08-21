/**
 * useLogging Hook
 * 
 * React hook for integrating the logging service with React components.
 * Provides easy access to logging functionality and automatic lifecycle tracking.
 */

import { useEffect, useRef } from 'react';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { Logger, trackScreenView, trackUserAction } from '../services/LoggingService';
import { useAuth } from './useAuth';

interface UseLoggingOptions {
  trackScreenViews?: boolean;
  trackComponentMount?: boolean;
  logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
}

export const useLogging = (
  componentName: string,
  options: UseLoggingOptions = {}
) => {
  const {
    trackScreenViews = true,
    trackComponentMount = true,
    logLevel = 'INFO'
  } = options;

  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const mountTime = useRef<number>();

  // Set user context when user changes
  useEffect(() => {
    if (user?.id) {
      Logger.setUserId(user.id);
    } else {
      Logger.clearUserId();
    }
  }, [user?.id]);

  // Track screen views when focused (for screen components)
  useFocusEffect(
    React.useCallback(() => {
      if (trackScreenViews && route.name) {
        Logger.setCurrentScreen(route.name);
        trackScreenView(route.name, route.params);
      }
    }, [route.name, route.params, trackScreenViews])
  );

  // Track component lifecycle
  useEffect(() => {
    if (trackComponentMount) {
      mountTime.current = Date.now();
      Logger.debug(`Component mounted: ${componentName}`);
    }

    return () => {
      if (trackComponentMount && mountTime.current) {
        const duration = Date.now() - mountTime.current;
        Logger.debug(`Component unmounted: ${componentName}`, { duration });
      }
    };
  }, [componentName, trackComponentMount]);

  // Logging functions with component context
  const log = {
    debug: (message: string, extra?: Record<string, any>) => {
      Logger.debug(`[${componentName}] ${message}`, { component: componentName, ...extra });
    },

    info: (message: string, extra?: Record<string, any>) => {
      Logger.info(`[${componentName}] ${message}`, { component: componentName, ...extra });
    },

    warn: (message: string, extra?: Record<string, any>) => {
      Logger.warn(`[${componentName}] ${message}`, { component: componentName, ...extra });
    },

    error: (message: string, error?: Error, extra?: Record<string, any>) => {
      Logger.error(`[${componentName}] ${message}`, error, { component: componentName, ...extra });
    },

    critical: (message: string, error?: Error, extra?: Record<string, any>) => {
      Logger.critical(`[${componentName}] ${message}`, error, { component: componentName, ...extra });
    }
  };

  // Event tracking functions with component context
  const track = {
    event: (eventType: string, properties?: Record<string, any>) => {
      Logger.trackEvent(eventType, { component: componentName, ...properties });
    },

    userAction: (action: string, target: string, properties?: Record<string, any>) => {
      trackUserAction(action, target, { component: componentName, ...properties });
    },

    performance: (metric: string, value: number, unit: string = 'ms') => {
      Logger.trackPerformance(metric, value, unit);
    },

    error: (error: Error, context?: string) => {
      Logger.trackError(error, context || componentName);
    },

    buttonPress: (buttonName: string, properties?: Record<string, any>) => {
      trackUserAction('button_press', buttonName, { component: componentName, ...properties });
    },

    formSubmit: (formName: string, success: boolean, properties?: Record<string, any>) => {
      trackUserAction('form_submit', formName, { 
        component: componentName, 
        success, 
        ...properties 
      });
    },

    navigation: (targetScreen: string, method: string = 'navigate') => {
      trackUserAction('navigation', targetScreen, { 
        component: componentName, 
        method,
        fromScreen: route.name 
      });
    }
  };

  return { log, track, Logger };
};

// HOC for automatic logging integration
export const withLogging = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) => {
  const LoggingComponent = (props: P) => {
    const name = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Unknown';
    const { log, track } = useLogging(name);

    // Enhance props with logging functions
    const enhancedProps = {
      ...props,
      log,
      track
    } as P & { log: typeof log; track: typeof track };

    return <WrappedComponent {...enhancedProps} />;
  };

  LoggingComponent.displayName = `withLogging(${componentName || WrappedComponent.displayName || WrappedComponent.name})`;

  return LoggingComponent;
};

export default useLogging;