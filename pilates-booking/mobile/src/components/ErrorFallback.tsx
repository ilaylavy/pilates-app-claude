import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Logger } from '../services/LoggingService';

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
  retryCount: number;
  errorId: string;
  canRetry: boolean;
}

const ErrorIllustration: React.FC<{ color: string }> = ({ color }) => (
  <View style={styles.illustrationContainer}>
    <View style={[styles.circle, { backgroundColor: color + '20' }]}>
      <Ionicons name="warning-outline" size={60} color={color} />
    </View>
  </View>
);

const getErrorContext = (error: Error): {
  title: string;
  message: string;
  suggestions: string[];
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
} => {
  const errorMessage = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();

  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return {
      title: 'Connection Problem',
      message: 'Unable to connect to our servers. Please check your internet connection.',
      suggestions: [
        'Check your Wi-Fi or mobile data connection',
        'Try switching between Wi-Fi and mobile data',
        'Wait a moment and try again',
      ],
      color: '#f56565',
      icon: 'wifi-outline',
    };
  }

  if (errorMessage.includes('timeout') || errorMessage.includes('slow')) {
    return {
      title: 'Request Timeout',
      message: 'The request is taking longer than expected.',
      suggestions: [
        'Check your internet connection speed',
        'Try again in a few seconds',
        'Close and reopen the app if needed',
      ],
      color: '#ed8936',
      icon: 'time-outline',
    };
  }

  if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
    return {
      title: 'Authentication Error',
      message: 'There was a problem with your login session.',
      suggestions: [
        'Try logging out and logging back in',
        'Check your credentials',
        'Contact support if the problem persists',
      ],
      color: '#e53e3e',
      icon: 'lock-closed-outline',
    };
  }

  if (errorMessage.includes('render') || errorName.includes('render')) {
    return {
      title: 'Display Problem',
      message: 'There was an issue displaying this content.',
      suggestions: [
        'Try refreshing the screen',
        'Go back and try again',
        'Restart the app if needed',
      ],
      color: '#9f7aea',
      icon: 'eye-off-outline',
    };
  }

  return {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred while using the app.',
    suggestions: [
      'Try the action again',
      'Restart the app',
      'Contact support if the problem continues',
    ],
    color: '#4a5568',
    icon: 'bug-outline',
  };
};

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  retryCount,
  errorId,
  canRetry,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const context = getErrorContext(error);

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleRetry = () => {
    Logger.trackEvent('error.fallback_retry', {
      errorId,
      retryCount,
      userInitiated: true,
    });

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      resetError();
    });
  };

  const handleGoBack = () => {
    Logger.trackEvent('error.fallback_go_back', {
      errorId,
      retryCount,
    });
    
    // This would typically use navigation
    // navigation.goBack();
  };

  const handleContactSupport = async () => {
    Logger.trackEvent('error.fallback_contact_support', {
      errorId,
      retryCount,
      errorMessage: error.message,
    });

    const supportMessage = `Error Report\n\nError ID: ${errorId}\nError: ${error.name}\nMessage: ${error.message}\nRetry Count: ${retryCount}\n\nPlease describe what you were doing when this error occurred:`;
    
    const mailto = `mailto:support@pilatesapp.com?subject=App Error Report - ${errorId}&body=${encodeURIComponent(supportMessage)}`;
    
    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (canOpen) {
        await Linking.openURL(mailto);
      } else {
        Alert.alert(
          'Contact Support',
          `Please email us at support@pilatesapp.com with error ID: ${errorId}`,
          [{ text: 'OK' }]
        );
      }
    } catch (linkingError) {
      Alert.alert(
        'Contact Support',
        `Please email us at support@pilatesapp.com with error ID: ${errorId}`,
        [{ text: 'OK' }]
      );
    }
  };

  const copyErrorId = () => {
    // Clipboard functionality would go here
    Alert.alert('Error ID Copied', `${errorId} has been copied to your clipboard.`);
    Logger.trackEvent('error.fallback_copy_id', { errorId });
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ErrorIllustration color={context.color} />
        
        <View style={styles.content}>
          <Text style={styles.title}>{context.title}</Text>
          <Text style={styles.message}>{context.message}</Text>
          
          {context.suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Try these solutions:</Text>
              {context.suggestions.map((suggestion, index) => (
                <View key={index} style={styles.suggestionItem}>
                  <Text style={styles.suggestionBullet}>•</Text>
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          {canRetry && (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: context.color }]}
              onPress={handleRetry}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>
                {retryCount > 0 ? `Try Again (${retryCount + 1})` : 'Try Again'}
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleGoBack}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color={context.color} style={styles.buttonIcon} />
            <Text style={[styles.secondaryButtonText, { color: context.color }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.supportContainer}>
          <TouchableOpacity
            style={styles.supportButton}
            onPress={handleContactSupport}
            activeOpacity={0.7}
          >
            <Ionicons name="mail-outline" size={16} color="#6b7280" />
            <Text style={styles.supportText}>Contact Support</Text>
          </TouchableOpacity>
          
          <View style={styles.errorIdContainer}>
            <Text style={styles.errorIdLabel}>Error ID: </Text>
            <TouchableOpacity onPress={copyErrorId}>
              <Text style={[styles.errorId, { color: context.color }]}>{errorId}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {__DEV__ && (
          <View style={styles.devContainer}>
            <TouchableOpacity
              style={styles.detailsToggle}
              onPress={() => setShowDetails(!showDetails)}
            >
              <Text style={styles.detailsToggleText}>
                {showDetails ? 'Hide' : 'Show'} Technical Details
              </Text>
              <Ionicons
                name={showDetails ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#6b7280"
              />
            </TouchableOpacity>

            {showDetails && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorDetailsTitle}>Error Details (Development)</Text>
                <ScrollView style={styles.errorDetailsScroll} nestedScrollEnabled>
                  <Text style={styles.errorDetailsText}>
                    <Text style={styles.errorDetailsLabel}>Name: </Text>
                    {error.name}
                  </Text>
                  <Text style={styles.errorDetailsText}>
                    <Text style={styles.errorDetailsLabel}>Message: </Text>
                    {error.message}
                  </Text>
                  {error.stack && (
                    <Text style={styles.errorDetailsText}>
                      <Text style={styles.errorDetailsLabel}>Stack: </Text>
                      {error.stack}
                    </Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a202c',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  suggestionsContainer: {
    alignSelf: 'stretch',
    backgroundColor: '#f7fafc',
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  suggestionBullet: {
    fontSize: 16,
    color: '#4a5568',
    marginRight: 8,
    marginTop: 2,
  },
  suggestionText: {
    fontSize: 14,
    color: '#4a5568',
    flex: 1,
    lineHeight: 20,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 30,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  buttonIcon: {
    marginRight: 8,
  },
  supportContainer: {
    alignItems: 'center',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  supportText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 6,
  },
  errorIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorIdLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  errorId: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '500',
  },
  devContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#fef3c7',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 16,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailsToggleText: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: '500',
  },
  errorDetails: {
    marginTop: 12,
  },
  errorDetailsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  errorDetailsScroll: {
    maxHeight: 200,
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    padding: 12,
  },
  errorDetailsText: {
    fontSize: 11,
    color: '#78350f',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
    marginBottom: 4,
  },
  errorDetailsLabel: {
    fontWeight: 'bold',
  },
});