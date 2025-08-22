// User-friendly error messages for business rule violations
export const ERROR_MESSAGES = {
  // Booking errors
  'Cannot book past or ongoing classes': 'This class has already started or is in the past. You can only book future classes.',
  'Weekly booking limit': 'You\'ve reached your weekly booking limit. Please try booking again next week.',
  'Package is expired or has no remaining credits': 'Your package has expired or you\'re out of credits. Please purchase a new package to continue booking.',
  'Unable to use credit from package': 'There was an issue with your package credits. Please contact support or try a different package.',
  
  // Auth errors
  'Email already registered': 'This email is already in use. Please try logging in instead or use a different email.',
  'Invalid or expired refresh token': 'Your session has expired. Please log in again.',
  'Invalid or expired reset token': 'This reset link has expired. Please request a new password reset.',
  'Inactive user': 'Your account has been deactivated. Please contact support for assistance.',
  
  // Payment errors
  'You already have an active reservation': 'You already have a pending purchase for this package. Please complete or cancel it before creating a new one.',
  'Reservation not found or already processed': 'This reservation has already been completed or was not found.',
  'Reservation has expired': 'Your purchase reservation has expired. Please start a new purchase.',
  
  // Booking cancellation errors
  'Booking cannot be cancelled within the cancellation window': 'This booking is too close to the class time to cancel. Please contact support if you need assistance.',
  'Booking not found': 'The booking you\'re trying to access was not found.',
  
  // Waitlist errors  
  'You are already on the waitlist for this class': 'You\'re already on the waitlist for this class. You\'ll be notified if a spot opens up.',
  
  // Generic fallbacks
  'Invalid verification token': 'The verification link is invalid or has expired. Please request a new one.',
  'No valid fields to update': 'No changes were provided to update.',
  'Invalid payload': 'The request data is invalid. Please try again.',
  'Invalid signature': 'Security verification failed. Please try again.',
} as const;

// Check if an error message should be treated as a friendly business rule message
export const isBusinessRuleError = (message: string): boolean => {
  return Object.keys(ERROR_MESSAGES).some(key => 
    message.toLowerCase().includes(key.toLowerCase()) ||
    message.toLowerCase().includes(key.toLowerCase().replace(/\s+/g, ''))
  );
};

// Get user-friendly message for an error
export const getFriendlyErrorMessage = (errorMessage: string): string => {
  // Direct match
  if (ERROR_MESSAGES[errorMessage as keyof typeof ERROR_MESSAGES]) {
    return ERROR_MESSAGES[errorMessage as keyof typeof ERROR_MESSAGES];
  }
  
  // Partial match for messages that contain dynamic content
  for (const [key, friendlyMessage] of Object.entries(ERROR_MESSAGES)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase()) ||
        errorMessage.toLowerCase().includes(key.toLowerCase().replace(/\s+/g, ''))) {
      return friendlyMessage;
    }
  }
  
  // Special cases with dynamic content
  if (errorMessage.includes('Weekly booking limit of')) {
    return ERROR_MESSAGES['Weekly booking limit'];
  }
  
  if (errorMessage.includes('Stripe error:')) {
    return 'There was an issue processing your payment. Please try again or contact support.';
  }
  
  // Default fallback
  return errorMessage;
};

// Get appropriate alert title for business rule errors
export const getErrorAlertTitle = (errorMessage: string): string => {
  if (isBusinessRuleError(errorMessage)) {
    return 'Unable to Complete Action';
  }
  return 'Error';
};

// Centralized error handler for API responses
export const handleApiError = (
  error: any, 
  fallbackMessage: string = 'An unexpected error occurred',
  onError?: (title: string, message: string) => void
): void => {
  let errorMessage = fallbackMessage;
  
  // Extract error message from different response formats
  if (error.response?.data?.detail) {
    errorMessage = error.response.data.detail;
  } else if (error.response?.data?.message) {
    errorMessage = error.response.data.message;
  } else if (error.message) {
    errorMessage = error.message;
  }
  
  const friendlyMessage = getFriendlyErrorMessage(errorMessage);
  const alertTitle = getErrorAlertTitle(errorMessage);
  
  if (onError) {
    onError(alertTitle, friendlyMessage);
  }
  
  console.error('API Error:', {
    originalError: errorMessage,
    friendlyMessage,
    alertTitle
  });
};

// Hook for consistent error handling in mutations
export const useApiErrorHandler = () => {
  const handleError = (
    error: any, 
    fallbackMessage: string = 'An unexpected error occurred'
  ): { title: string; message: string } => {
    let errorMessage = fallbackMessage;
    
    if (error.response?.data?.detail) {
      errorMessage = error.response.data.detail;
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    const friendlyMessage = getFriendlyErrorMessage(errorMessage);
    const alertTitle = getErrorAlertTitle(errorMessage);
    
    return { title: alertTitle, message: friendlyMessage };
  };
  
  return { handleError };
};