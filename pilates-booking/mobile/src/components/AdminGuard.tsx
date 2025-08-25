import React, { ReactNode, FC } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUserRole, UserRole } from '../hooks/useUserRole';
import { COLORS, SPACING } from '../utils/config';

interface AdminGuardProps {
  children: ReactNode;
  requiredRoles: UserRole[];
  fallback?: ReactNode;
  showUnauthorized?: boolean;
}

export const AdminGuard: FC<AdminGuardProps> = ({
  children,
  requiredRoles,
  fallback,
  showUnauthorized = true,
}) => {
  const { canAccess, isAuthenticated } = useUserRole();

  if (!isAuthenticated) {
    return fallback || (showUnauthorized ? <UnauthorizedMessage message="Please log in to continue" /> : null);
  }

  if (!canAccess(requiredRoles)) {
    return fallback || (showUnauthorized ? <UnauthorizedMessage message="You don't have permission to access this feature" /> : null);
  }

  return <>{children}</>;
};

const UnauthorizedMessage: React.FC<{ message: string }> = ({ message }) => (
  <View style={styles.unauthorizedContainer}>
    <Text style={styles.unauthorizedText}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  unauthorizedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  unauthorizedText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});