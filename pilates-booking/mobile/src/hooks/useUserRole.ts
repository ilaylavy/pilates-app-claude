import { useAuth } from './useAuth';
import { User } from '../types';

export type UserRole = 'student' | 'instructor' | 'admin';

interface UserRoleHook {
  user: User | null;
  role: UserRole | null;
  isAdmin: boolean;
  isInstructor: boolean;
  isStudent: boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  canAccess: (requiredRoles: UserRole[]) => boolean;
  isAuthenticated: boolean;
}

export const useUserRole = (): UserRoleHook => {
  const { user, isAuthenticated } = useAuth();

  const role = user?.role || null;
  const isAdmin = role === 'admin';
  const isInstructor = role === 'instructor';
  const isStudent = role === 'student';

  const hasRole = (requiredRole: UserRole): boolean => {
    return role === requiredRole;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return role !== null && roles.includes(role);
  };

  const canAccess = (requiredRoles: UserRole[]): boolean => {
    if (!isAuthenticated || !user) return false;
    return hasAnyRole(requiredRoles);
  };

  return {
    user,
    role,
    isAdmin,
    isInstructor,
    isStudent,
    hasRole,
    hasAnyRole,
    canAccess,
    isAuthenticated,
  };
};