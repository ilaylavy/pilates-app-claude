export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: 'student' | 'instructor' | 'admin';
  is_active: boolean;
  is_verified: boolean;
  avatar_url?: string;
  preferences?: UserPreferences;
  privacy_settings?: PrivacySettings;
  created_at: string;
  updated_at: string;
}

export interface ClassTemplate {
  id: number;
  name: string;
  description?: string;
  duration_minutes: number;
  capacity: number;
  level: 'beginner' | 'intermediate' | 'advanced' | 'all_levels';
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  start_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Instructor {
  id: number;
  first_name: string;
  last_name: string;
}

export interface ClassInstance {
  id: number;
  template_id: number;
  instructor_id: number;
  start_datetime: string;
  end_datetime: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  actual_capacity?: number;
  notes?: string;
  template: ClassTemplate;
  instructor: Instructor;
  available_spots: number;
  is_full: boolean;
  waitlist_count: number;
  participant_count: number;
  created_at: string;
  updated_at: string;
}

export interface Package {
  id: number;
  name: string;
  description?: string;
  credits: number;
  price: number;
  validity_days: number;
  is_active: boolean;
  is_unlimited: boolean;
  order_index: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPackage {
  id: number;
  user_id: number;
  package_id: number;
  package: Package;
  credits_remaining: number;
  purchase_date: string;
  expiry_date: string;
  is_active: boolean;
  is_expired: boolean;
  is_valid: boolean;
  days_until_expiry: number;
  status: 'active' | 'reserved' | 'expired' | 'cancelled';
  reservation_expires_at?: string;
  // Payment approval fields
  payment_status?: 'pending_approval' | 'approved' | 'rejected';
  payment_method?: 'CREDIT_CARD' | 'CASH' | 'BANK_TRANSFER' | 'PAYPAL' | 'STRIPE';
  approved_by?: number;
  approved_at?: string;
  rejection_reason?: string;
  payment_reference?: string;
  admin_notes?: string;
  is_pending_approval?: boolean;
  is_approved?: boolean;
  is_rejected?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: number;
  user_id: number;
  class_instance_id: number;
  user_package_id?: number;
  status: 'confirmed' | 'cancelled' | 'no_show' | 'completed';
  booking_date: string;
  cancellation_date?: string;
  cancellation_reason?: string;
  notes?: string;
  user: User;
  class_instance: ClassInstance;
  can_cancel: boolean;
  is_new_booking?: boolean;
  created_at: string;
  updated_at: string;
}

export interface WaitlistEntry {
  id: number;
  user_id: number;
  class_instance_id: number;
  position: number;
  joined_at: string;
  user: User;
  class_instance: ClassInstance;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: 'student' | 'instructor' | 'admin';
}

export interface BookingRequest {
  class_instance_id: number;
  user_package_id?: number;
}

export interface ApiError {
  detail: string;
}

// Admin-specific types
export interface UserListItem {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'student' | 'instructor' | 'admin';
  is_active: boolean;
  is_verified: boolean;
  avatar_url?: string;
  created_at: string;
  total_bookings: number;
  active_packages: number;
}

export interface DashboardAnalytics {
  total_users: number;
  new_users_last_30_days: number;
  total_bookings: number;
  total_revenue: number;
  monthly_revenue: number;
  popular_packages: Array<{
    name: string;
    count: number;
  }>;
}

export interface RevenueReport {
  total_revenue: number;
  period: {
    start_date: string;
    end_date: string;
  };
  revenue_by_package: Array<{
    package: string;
    revenue: number;
    sales_count: number;
  }>;
  revenue_by_date: Array<{
    date: string;
    revenue: number;
  }>;
}

export interface AttendanceReport {
  period: {
    start_date: string;
    end_date: string;
  };
  popular_times: Array<{
    time: string;
    bookings: number;
  }>;
  bookings_by_date: Array<{
    date: string;
    bookings: number;
  }>;
}

// New profile-related types
export interface UserPreferences {
  email_notifications: boolean;
  sms_notifications: boolean;
  booking_reminders: boolean;
  class_updates: boolean;
  marketing_emails: boolean;
}

export interface PrivacySettings {
  show_in_attendees: boolean;
  allow_profile_viewing: boolean;
  show_stats: boolean;
}

export interface UserStats {
  total_bookings: number;
  bookings_this_month: number;
  attendance_rate: number;
  member_since: string;
}

export interface BookingHistory {
  id: number;
  class_name: string;
  date: string;
  instructor: string;
  status: string;
  created_at: string;
}

// Payment-related types
export interface PaymentIntent {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  created: number;
}

export interface PaymentHistoryItem {
  id: number;
  user_id: number;
  package_id?: number;
  user_package_id?: number;
  amount: number;
  currency: string;
  payment_type: 'package_purchase' | 'single_class' | 'late_cancellation_fee' | 'no_show_fee' | 'refund';
  payment_method: 'stripe' | 'credit_card' | 'cash' | 'bank_transfer' | 'paypal';
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  external_transaction_id?: string;
  external_payment_id?: string;
  payment_date?: string;
  refund_date?: string;
  refund_amount?: number;
  extra_data?: string;
  is_successful: boolean;
  is_refundable: boolean;
  created_at: string;
  updated_at: string;
  description?: string;
}

export interface PaymentHistory {
  payments: PaymentHistoryItem[];
  total_count: number;
  page: number;
  per_page: number;
}

export interface Subscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  client_secret?: string;
}

export interface Invoice {
  id: string;
  number?: string;
  amount_paid: number;
  currency: string;
  status: string;
  created: number;
  invoice_pdf?: string;
  hosted_invoice_url?: string;
}

// Payment Approval Types
export type PaymentMethodType = 'CREDIT_CARD' | 'CASH' | 'BANK_TRANSFER' | 'PAYPAL' | 'STRIPE';
export type PaymentStatusType = 'pending_approval' | 'approved' | 'rejected';

export interface PendingApproval {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  package_id: number;
  package_name: string;
  package_credits: number;
  package_price: number;
  payment_method: PaymentMethodType;
  payment_reference?: string;
  purchase_date: string;
  hours_waiting: number;
}

export interface PaymentApprovalRequest {
  payment_reference?: string;
  admin_notes?: string;
}

export interface PaymentRejectionRequest {
  rejection_reason: string;
  admin_notes?: string;
}

export interface ApprovalStats {
  total_pending: number;
  pending_today: number;
  pending_over_24h: number;
  avg_approval_time_hours: number;
  total_approved_today: number;
  total_rejected_today: number;
}

export interface CashPaymentInstructions {
  message: string;
  status: string;
  package_id: number;
  package_name: string;
  user_package_id: number;
  price: number;
  currency: string;
  payment_method: string;
  reference_code: string;
  payment_instructions: string[];
  reservation_expires_at: string;
  estimated_approval_time: string;
}