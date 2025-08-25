import { AxiosError } from 'axios';
import { Logger } from '../services/LoggingService';
import { errorRecoveryService } from '../services/ErrorRecoveryService';

export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication', 
  VALIDATION = 'validation',
  SERVER = 'server',
  CLIENT = 'client',
  BOOKING = 'booking',
  PAYMENT = 'payment',
  USER_INPUT = 'user_input',
  SYSTEM = 'system',
  UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface CategorizedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string;
  technicalMessage: string;
  recoverable: boolean;
  shouldReport: boolean;
  context: Record<string, any>;
  recoveryActions?: string[];
}

export class ErrorClassifier {
  private static networkErrorPatterns = [
    /network/i,
    /fetch/i,
    /timeout/i,
    /connection/i,
    /offline/i,
    /unreachable/i,
  ];

  private static authErrorPatterns = [
    /unauthorized/i,
    /authentication/i,
    /token/i,
    /login/i,
    /access.*denied/i,
  ];

  private static validationErrorPatterns = [
    /validation/i,
    /invalid.*input/i,
    /required.*field/i,
    /format.*error/i,
  ];

  private static serverErrorPatterns = [
    /internal.*server/i,
    /database.*error/i,
    /service.*unavailable/i,
  ];

  public static categorizeError(error: Error | AxiosError): CategorizedError {
    const errorMessage = error.message.toLowerCase();
    const isAxiosError = 'response' in error;

    // Network errors
    if (this.matchesPatterns(errorMessage, this.networkErrorPatterns) ||
        (isAxiosError && (error.code === 'NETWORK_ERROR' || error.code === 'ECONNABORTED'))) {
      return {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        userMessage: 'Connection problem. Please check your internet connection and try again.',
        technicalMessage: error.message,
        recoverable: true,
        shouldReport: false,
        context: { isAxiosError, code: isAxiosError ? error.code : undefined },
        recoveryActions: ['Check internet connection', 'Try again', 'Switch network'],
      };
    }

    // Authentication errors
    if (this.matchesPatterns(errorMessage, this.authErrorPatterns) ||
        (isAxiosError && error.response?.status === 401)) {
      return {
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        userMessage: 'Session expired. Please log in again.',
        technicalMessage: error.message,
        recoverable: true,
        shouldReport: false,
        context: { status: isAxiosError ? error.response?.status : undefined },
        recoveryActions: ['Log in again', 'Refresh session'],
      };
    }

    // Validation errors
    if (this.matchesPatterns(errorMessage, this.validationErrorPatterns) ||
        (isAxiosError && error.response?.status === 400)) {
      return {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        userMessage: 'Please check your input and try again.',
        technicalMessage: error.message,
        recoverable: true,
        shouldReport: false,
        context: { 
          status: isAxiosError ? error.response?.status : undefined,
          responseData: isAxiosError ? error.response?.data : undefined,
        },
        recoveryActions: ['Check input fields', 'Correct errors', 'Try again'],
      };
    }

    // Server errors
    if (this.matchesPatterns(errorMessage, this.serverErrorPatterns) ||
        (isAxiosError && error.response && error.response.status >= 500)) {
      return {
        category: ErrorCategory.SERVER,
        severity: ErrorSeverity.HIGH,
        userMessage: 'Server is temporarily unavailable. Please try again later.',
        technicalMessage: error.message,
        recoverable: true,
        shouldReport: true,
        context: { 
          status: isAxiosError ? error.response?.status : undefined,
          responseData: isAxiosError ? error.response?.data : undefined,
        },
        recoveryActions: ['Wait a moment', 'Try again', 'Contact support if it persists'],
      };
    }

    // Booking-specific errors
    if (errorMessage.includes('booking') || errorMessage.includes('class') || errorMessage.includes('schedule')) {
      return {
        category: ErrorCategory.BOOKING,
        severity: ErrorSeverity.MEDIUM,
        userMessage: 'There was a problem with your booking. Please try again.',
        technicalMessage: error.message,
        recoverable: true,
        shouldReport: true,
        context: { booking: true },
        recoveryActions: ['Refresh class schedule', 'Try booking again', 'Check class availability'],
      };
    }

    // Payment errors
    if (errorMessage.includes('payment') || errorMessage.includes('card') || errorMessage.includes('billing')) {
      return {
        category: ErrorCategory.PAYMENT,
        severity: ErrorSeverity.HIGH,
        userMessage: 'Payment processing error. Please check your payment details and try again.',
        technicalMessage: error.message,
        recoverable: true,
        shouldReport: true,
        context: { payment: true },
        recoveryActions: ['Check payment method', 'Verify card details', 'Try different payment method'],
      };
    }

    // Unknown errors
    return {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      userMessage: 'Something unexpected happened. Please try again.',
      technicalMessage: error.message,
      recoverable: true,
      shouldReport: true,
      context: { unknown: true, name: error.name },
      recoveryActions: ['Try again', 'Restart app if needed', 'Contact support'],
    };
  }

  private static matchesPatterns(text: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(text));
  }
}

export class ErrorHandler {
  public static async handleError(
    error: Error | AxiosError,
    context?: {
      screenName?: string;
      userId?: string;
      action?: string;
      additionalData?: Record<string, any>;
    }
  ): Promise<CategorizedError> {
    const categorized = ErrorClassifier.categorizeError(error);
    
    // Log the error with appropriate level
    const logLevel = this.getLogLevel(categorized.severity);
    const errorContext = {
      category: categorized.category,
      severity: categorized.severity,
      recoverable: categorized.recoverable,
      screenName: context?.screenName,
      userId: context?.userId,
      action: context?.action,
      ...categorized.context,
      ...context?.additionalData,
    };

    switch (logLevel) {
      case 'error':
        Logger.error(`${categorized.category} error occurred`, error, errorContext);
        break;
      case 'warn':
        Logger.warn(`${categorized.category} warning`, errorContext);
        break;
      default:
        Logger.info(`${categorized.category} issue`, errorContext);
    }

    // Track error event
    Logger.trackEvent('error.categorized', {
      category: categorized.category,
      severity: categorized.severity,
      recoverable: categorized.recoverable,
      shouldReport: categorized.shouldReport,
      screenName: context?.screenName,
      action: context?.action,
    });

    // Attempt automatic recovery for recoverable errors
    if (categorized.recoverable && categorized.severity !== ErrorSeverity.LOW) {
      try {
        const recoveryResult = await errorRecoveryService.recoverFromError(error, {
          screenName: context?.screenName,
          userId: context?.userId,
        });

        if (recoveryResult.success) {
          Logger.info('Error automatically recovered', {
            category: categorized.category,
            recoveryAction: recoveryResult.action,
          });

          Logger.trackEvent('error.auto_recovered', {
            category: categorized.category,
            recoveryAction: recoveryResult.action,
          });
        }
      } catch (recoveryError) {
        Logger.error('Automatic error recovery failed', recoveryError as Error);
      }
    }

    return categorized;
  }

  private static getLogLevel(severity: ErrorSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      default:
        return 'info';
    }
  }

  public static getErrorMessage(categorized: CategorizedError): string {
    return categorized.userMessage;
  }

  public static getRecoveryActions(categorized: CategorizedError): string[] {
    return categorized.recoveryActions || [];
  }

  public static shouldShowErrorToUser(categorized: CategorizedError): boolean {
    return categorized.severity !== ErrorSeverity.LOW || categorized.category === ErrorCategory.VALIDATION;
  }
}

// Specific error handlers for common scenarios
export class BookingErrorHandler {
  public static async handleBookingError(error: Error, bookingContext: {
    classId?: number;
    userId?: number;
    packageId?: number;
  }): Promise<string> {
    const categorized = await ErrorHandler.handleError(error, {
      screenName: 'booking',
      action: 'create_booking',
      additionalData: bookingContext,
    });

    // Custom booking error messages
    if (error.message.includes('class is full')) {
      return 'This class is fully booked. You can join the waitlist or choose another time.';
    }

    if (error.message.includes('insufficient credits')) {
      return 'You don\'t have enough credits for this booking. Please purchase a package first.';
    }

    if (error.message.includes('booking window')) {
      return 'The booking window for this class has ended. Please choose another class.';
    }

    if (error.message.includes('already booked')) {
      return 'You are already booked for this class.';
    }

    return categorized.userMessage;
  }
}

export class PaymentErrorHandler {
  public static async handlePaymentError(error: Error, paymentContext: {
    amount?: number;
    paymentMethodId?: string;
    packageId?: number;
  }): Promise<string> {
    const categorized = await ErrorHandler.handleError(error, {
      screenName: 'payment',
      action: 'process_payment',
      additionalData: paymentContext,
    });

    // Custom payment error messages
    if (error.message.includes('card_declined')) {
      return 'Your card was declined. Please check your card details or try a different payment method.';
    }

    if (error.message.includes('insufficient_funds')) {
      return 'Insufficient funds. Please check your account balance or use a different card.';
    }

    if (error.message.includes('expired_card')) {
      return 'Your card has expired. Please update your payment method.';
    }

    if (error.message.includes('invalid_cvc')) {
      return 'Invalid security code. Please check the CVC on your card.';
    }

    if (error.message.includes('processing_error')) {
      return 'Payment processing error. Please try again or contact your bank.';
    }

    return categorized.userMessage;
  }
}

export class AuthErrorHandler {
  public static async handleAuthError(error: Error, authContext: {
    action: 'login' | 'register' | 'refresh' | 'logout';
    email?: string;
  }): Promise<string> {
    const categorized = await ErrorHandler.handleError(error, {
      screenName: 'auth',
      action: authContext.action,
      additionalData: { email: authContext.email },
    });

    // Custom auth error messages
    if (error.message.includes('invalid_credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }

    if (error.message.includes('user_not_found')) {
      return 'No account found with this email address.';
    }

    if (error.message.includes('email_already_exists')) {
      return 'An account with this email address already exists.';
    }

    if (error.message.includes('weak_password')) {
      return 'Password is too weak. Please choose a stronger password.';
    }

    if (error.message.includes('too_many_requests')) {
      return 'Too many login attempts. Please wait a moment before trying again.';
    }

    if (error.message.includes('email_not_verified')) {
      return 'Please verify your email address before logging in.';
    }

    return categorized.userMessage;
  }
}

// Helper functions for common error scenarios
export const handleApiError = async (
  error: Error | AxiosError,
  context?: { screenName?: string; action?: string }
): Promise<string> => {
  const categorized = await ErrorHandler.handleError(error, context);
  return ErrorHandler.getErrorMessage(categorized);
};

export const handleFormValidationError = (
  error: Error,
  fieldName?: string
): string => {
  const errorMessage = error.message.toLowerCase();
  
  if (errorMessage.includes('required')) {
    return `${fieldName || 'This field'} is required`;
  }
  
  if (errorMessage.includes('email')) {
    return 'Please enter a valid email address';
  }
  
  if (errorMessage.includes('password')) {
    return 'Password must be at least 8 characters long';
  }
  
  if (errorMessage.includes('phone')) {
    return 'Please enter a valid phone number';
  }
  
  return 'Please check your input and try again';
};

export const shouldRetryError = (error: Error | AxiosError): boolean => {
  const categorized = ErrorClassifier.categorizeError(error);
  return categorized.recoverable && 
         categorized.category !== ErrorCategory.VALIDATION &&
         categorized.category !== ErrorCategory.USER_INPUT;
};

export const getRetryDelay = (attempt: number): number => {
  return Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
};

export default ErrorHandler;