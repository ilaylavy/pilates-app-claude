import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Logger } from '../services/LoggingService';
import { ErrorFallback } from './ErrorFallback';

interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolate?: boolean;
  enableRecovery?: boolean;
  maxRetries?: number;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  name?: string;
}

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  retryCount: number;
  errorId: string;
  canRetry: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId?: NodeJS.Timeout;
  private readonly maxRetries: number;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
    };
    this.maxRetries = props.maxRetries || 3;
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = this.generateErrorId();
    
    this.setState({
      errorInfo,
      errorId,
    });

    Logger.critical('Error boundary caught error', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: this.props.name || 'Unknown',
      errorId,
      retryCount: this.state.retryCount,
      isolate: this.props.isolate,
      context: 'error_boundary'
    });

    Logger.trackEvent('error.boundary_triggered', {
      errorName: error.name,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack.split('\n').slice(0, 5).join('\n'),
      errorBoundary: this.props.name || 'Unknown',
      errorId,
      retryCount: this.state.retryCount,
      canRetry: this.canRetry(),
    });

    this.props.onError?.(error, errorInfo);

    if (this.props.isolate) {
      Logger.info('Error isolated to component boundary', {
        errorBoundary: this.props.name,
        errorId,
      });
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys = [], resetOnPropsChange = false } = this.props;
    
    if (this.state.hasError && (resetOnPropsChange || resetKeys.length > 0)) {
      const hasResetKeyChanged = resetKeys.some(
        (key, index) => prevProps.resetKeys?.[index] !== key
      );
      
      if (resetOnPropsChange || hasResetKeyChanged) {
        Logger.info('Error boundary auto-reset triggered', {
          resetOnPropsChange,
          hasResetKeyChanged,
          errorId: this.state.errorId,
        });
        this.resetError();
      }
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  canRetry(): boolean {
    return this.state.retryCount < this.maxRetries && this.props.enableRecovery !== false;
  }

  resetError = (): void => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    Logger.info('Error boundary reset', {
      errorId: this.state.errorId,
      retryCount: this.state.retryCount,
      errorBoundary: this.props.name,
    });

    Logger.trackEvent('error.boundary_reset', {
      errorId: this.state.errorId || 'unknown',
      retryCount: this.state.retryCount,
      errorBoundary: this.props.name || 'Unknown',
      userInitiated: true,
    });

    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: undefined,
      retryCount: 0,
    });
  };

  retryWithDelay = (delayMs: number = 1000): void => {
    if (!this.canRetry()) {
      Alert.alert(
        'Maximum Retries Exceeded',
        'Please restart the app or contact support if the problem persists.',
        [{ text: 'OK' }]
      );
      return;
    }

    Logger.info('Error boundary retry initiated', {
      errorId: this.state.errorId,
      retryCount: this.state.retryCount + 1,
      delayMs,
    });

    Logger.trackEvent('error.boundary_retry', {
      errorId: this.state.errorId || 'unknown',
      retryCount: this.state.retryCount + 1,
      delayMs,
      automatic: false,
    });

    this.retryTimeoutId = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        errorId: undefined,
        retryCount: prevState.retryCount + 1,
      }));
    }, delayMs);
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || ErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error!}
          resetError={this.resetError}
          retryCount={this.state.retryCount}
          errorId={this.state.errorId || 'unknown'}
          canRetry={this.canRetry()}
        />
      );
    }

    return this.props.children;
  }
}

interface ScreenErrorBoundaryProps {
  children: React.ReactNode;
  screenName: string;
}

export const ScreenErrorBoundary: React.FC<ScreenErrorBoundaryProps> = ({
  children,
  screenName,
}) => (
  <ErrorBoundary
    name={`Screen:${screenName}`}
    enableRecovery={true}
    maxRetries={2}
    isolate={false}
    onError={(error, errorInfo) => {
      Logger.error(`Screen error in ${screenName}`, error, {
        screenName,
        componentStack: errorInfo.componentStack,
        context: 'screen_error'
      });
    }}
  >
    {children}
  </ErrorBoundary>
);

interface ComponentErrorBoundaryProps {
  children: React.ReactNode;
  componentName: string;
  fallbackMessage?: string;
}

export const ComponentErrorBoundary: React.FC<ComponentErrorBoundaryProps> = ({
  children,
  componentName,
  fallbackMessage = 'This component encountered an error',
}) => (
  <ErrorBoundary
    name={`Component:${componentName}`}
    enableRecovery={true}
    maxRetries={1}
    isolate={true}
    fallback={({ error, resetError, canRetry }) => (
      <View style={styles.componentError}>
        <Ionicons name="warning-outline" size={24} color="#ff6b6b" />
        <Text style={styles.componentErrorText}>{fallbackMessage}</Text>
        {canRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={resetError}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    )}
  >
    {children}
  </ErrorBoundary>
);

const styles = StyleSheet.create({
  componentError: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    borderRadius: 8,
    borderColor: '#fed7d7',
    borderWidth: 1,
    margin: 8,
  },
  componentErrorText: {
    fontSize: 14,
    color: '#c53030',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#4299e1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});