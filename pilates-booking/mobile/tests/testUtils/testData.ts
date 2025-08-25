/**
 * Mock test data for React Native tests.
 * Provides consistent, realistic data across all tests.
 */

import { 
  User, 
  UserRole, 
  ClassInstance, 
  Booking, 
  BookingStatus, 
  Package, 
  UserPackage,
  PackageStatus,
  DifficultyLevel 
} from '../../src/types';

// Mock users
export const mockUsers = {
  student: {
    id: 1,
    email: 'student@example.com',
    first_name: 'John',
    last_name: 'Doe',
    role: UserRole.STUDENT,
    is_active: true,
    is_verified: true,
    phone_number: '+1234567890',
    date_of_birth: '1990-05-15',
    emergency_contact_name: 'Jane Doe',
    emergency_contact_phone: '+1234567891',
    health_conditions: null,
    notes: 'Regular student, loves morning classes',
    bio: null,
    specialties: null,
    certifications: null,
    avatar_url: 'https://example.com/avatars/student.jpg',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T10:30:00Z',
  } as User,

  instructor: {
    id: 2,
    email: 'instructor@example.com',
    first_name: 'Sarah',
    last_name: 'Wilson',
    role: UserRole.INSTRUCTOR,
    is_active: true,
    is_verified: true,
    phone_number: '+1234567892',
    date_of_birth: '1985-08-22',
    emergency_contact_name: 'Mike Wilson',
    emergency_contact_phone: '+1234567893',
    health_conditions: null,
    notes: null,
    bio: 'Certified Pilates instructor with 10 years of experience. Specializes in rehabilitation and beginner-friendly classes.',
    specialties: 'Pilates, Rehabilitation, Beginner Classes',
    certifications: 'PMA-CPT, Physical Therapy Assistant',
    avatar_url: 'https://example.com/avatars/instructor.jpg',
    created_at: '2023-06-01T00:00:00Z',
    updated_at: '2024-01-10T14:20:00Z',
  } as User,

  admin: {
    id: 3,
    email: 'admin@example.com',
    first_name: 'Alex',
    last_name: 'Admin',
    role: UserRole.ADMIN,
    is_active: true,
    is_verified: true,
    phone_number: '+1234567894',
    date_of_birth: '1980-12-03',
    emergency_contact_name: 'Emergency Admin',
    emergency_contact_phone: '+1234567895',
    health_conditions: null,
    notes: 'Studio administrator',
    bio: null,
    specialties: null,
    certifications: null,
    avatar_url: null,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as User,
};

// Mock class instances
export const mockClasses: ClassInstance[] = [
  {
    id: 1,
    start_datetime: '2024-02-15T10:00:00Z',
    end_datetime: '2024-02-15T11:00:00Z',
    is_cancelled: false,
    cancellation_reason: null,
    template: {
      id: 1,
      name: 'Pilates Fundamentals',
      description: 'Perfect for beginners! Learn the basic principles of Pilates including breathing, alignment, and core engagement.',
      duration_minutes: 60,
      capacity: 12,
      level: DifficultyLevel.BEGINNER,
      equipment_needed: 'Mat, Blocks, Strap',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    instructor: mockUsers.instructor,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    start_datetime: '2024-02-15T18:00:00Z',
    end_datetime: '2024-02-15T19:00:00Z',
    is_cancelled: false,
    cancellation_reason: null,
    template: {
      id: 2,
      name: 'Advanced Flow',
      description: 'Challenge yourself with this dynamic and flowing Pilates class. Advanced movements and sequences.',
      duration_minutes: 60,
      capacity: 8,
      level: DifficultyLevel.ADVANCED,
      equipment_needed: 'Mat, Reformer',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    instructor: mockUsers.instructor,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    start_datetime: '2024-02-16T09:00:00Z',
    end_datetime: '2024-02-16T10:00:00Z',
    is_cancelled: false,
    cancellation_reason: null,
    template: {
      id: 3,
      name: 'Gentle Stretch',
      description: 'A relaxing class focused on flexibility and gentle movements. Perfect for recovery days.',
      duration_minutes: 60,
      capacity: 15,
      level: DifficultyLevel.BEGINNER,
      equipment_needed: 'Mat, Blocks, Bolster',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    instructor: mockUsers.instructor,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// Mock bookings
export const mockBookings: Booking[] = [
  {
    id: 1,
    user_id: 1,
    class_instance_id: 1,
    status: BookingStatus.CONFIRMED,
    booking_date: '2024-02-10T15:30:00Z',
    can_cancel: true,
    cancellation_reason: null,
    class_instance: mockClasses[0],
    user: mockUsers.student,
    created_at: '2024-02-10T15:30:00Z',
    updated_at: '2024-02-10T15:30:00Z',
  },
  {
    id: 2,
    user_id: 1,
    class_instance_id: 2,
    status: BookingStatus.WAITLISTED,
    booking_date: '2024-02-11T09:15:00Z',
    can_cancel: true,
    cancellation_reason: null,
    class_instance: mockClasses[1],
    user: mockUsers.student,
    created_at: '2024-02-11T09:15:00Z',
    updated_at: '2024-02-11T09:15:00Z',
  },
  {
    id: 3,
    user_id: 1,
    class_instance_id: 3,
    status: BookingStatus.CANCELLED,
    booking_date: '2024-02-08T12:00:00Z',
    can_cancel: false,
    cancellation_reason: 'Schedule conflict',
    class_instance: mockClasses[2],
    user: mockUsers.student,
    created_at: '2024-02-08T12:00:00Z',
    updated_at: '2024-02-12T10:00:00Z',
  },
];

// Mock packages
export const mockPackages: Package[] = [
  {
    id: 1,
    name: 'Single Class',
    description: 'Perfect for trying out a class or occasional visits.',
    credits: 1,
    price: 25.00,
    validity_days: 30,
    is_active: true,
    is_unlimited: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: '10-Class Package',
    description: 'Great value for regular students. Save $30 compared to single classes.',
    credits: 10,
    price: 220.00,
    validity_days: 90,
    is_active: true,
    is_unlimited: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 3,
    name: 'Unlimited Monthly',
    description: 'Unlimited classes for one month. Perfect for dedicated practitioners.',
    credits: 999,
    price: 150.00,
    validity_days: 30,
    is_active: true,
    is_unlimited: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

// Mock user packages
export const mockUserPackages: UserPackage[] = [
  {
    id: 1,
    user_id: 1,
    package_id: 2,
    status: PackageStatus.ACTIVE,
    purchase_date: '2024-02-01T00:00:00Z',
    expiry_date: '2024-05-01T00:00:00Z',
    credits_remaining: 7,
    credits_used: 3,
    user: mockUsers.student,
    package: mockPackages[1],
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-10T15:30:00Z',
  },
  {
    id: 2,
    user_id: 1,
    package_id: 1,
    status: PackageStatus.USED_UP,
    purchase_date: '2024-01-15T00:00:00Z',
    expiry_date: '2024-02-15T00:00:00Z',
    credits_remaining: 0,
    credits_used: 1,
    user: mockUsers.student,
    package: mockPackages[0],
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-20T10:00:00Z',
  },
];

// Mock attendees for classes
export const mockAttendees = [
  {
    id: 1,
    first_name: 'John',
    last_name: 'Doe',
    avatar_url: 'https://example.com/avatars/student.jpg',
    booking_date: '2024-02-10T15:30:00Z',
    is_you: true,
  },
  {
    id: 4,
    first_name: 'Emma',
    last_name: 'Smith',
    avatar_url: null,
    booking_date: '2024-02-10T16:00:00Z',
    is_you: false,
  },
  {
    id: 5,
    first_name: 'Mike',
    last_name: 'Johnson',
    avatar_url: 'https://example.com/avatars/mike.jpg',
    booking_date: '2024-02-10T16:30:00Z',
    is_you: false,
  },
];

// Mock form data
export const mockFormData = {
  validUser: {
    email: 'test@example.com',
    password: 'SecurePassword123!',
    first_name: 'Test',
    last_name: 'User',
    phone_number: '+1234567890',
  },
  invalidUser: {
    email: 'invalid-email',
    password: '123',
    first_name: '',
    last_name: '',
    phone_number: 'invalid-phone',
  },
  validLogin: {
    email: 'test@example.com',
    password: 'SecurePassword123!',
  },
  invalidLogin: {
    email: 'wrong@example.com',
    password: 'wrongpassword',
  },
};

// Mock API responses
export const mockApiResponses = {
  loginSuccess: {
    access_token: 'mock_access_token_12345',
    refresh_token: 'mock_refresh_token_67890',
    token_type: 'bearer',
    expires_in: 3600,
  },
  loginError: {
    detail: 'Incorrect email or password',
  },
  networkError: {
    message: 'Network request failed',
  },
  serverError: {
    detail: 'Internal server error',
  },
};

// Export all mock data
export const testData = {
  users: mockUsers,
  classes: mockClasses,
  bookings: mockBookings,
  packages: mockPackages,
  userPackages: mockUserPackages,
  attendees: mockAttendees,
  formData: mockFormData,
  apiResponses: mockApiResponses,
};