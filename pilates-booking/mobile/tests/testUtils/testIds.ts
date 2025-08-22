/**
 * Test IDs for E2E testing and component identification.
 * Centralized location for all test identifiers.
 */

export const testIds = {
  // Authentication screens
  auth: {
    loginScreen: 'login-screen',
    registerScreen: 'register-screen',
    forgotPasswordScreen: 'forgot-password-screen',
    emailInput: 'email-input',
    passwordInput: 'password-input',
    confirmPasswordInput: 'confirm-password-input',
    firstNameInput: 'first-name-input',
    lastNameInput: 'last-name-input',
    phoneInput: 'phone-input',
    loginButton: 'login-button',
    registerButton: 'register-button',
    forgotPasswordLink: 'forgot-password-link',
    backToLoginLink: 'back-to-login-link',
    showPasswordButton: 'show-password-button',
    biometricLoginButton: 'biometric-login-button',
  },

  // Navigation
  navigation: {
    homeTab: 'home-tab',
    scheduleTab: 'schedule-tab',
    bookingsTab: 'bookings-tab',
    packagesTab: 'packages-tab',
    profileTab: 'profile-tab',
    backButton: 'back-button',
    menuButton: 'menu-button',
    settingsButton: 'settings-button',
  },

  // Home screen
  home: {
    screen: 'home-screen',
    welcomeMessage: 'welcome-message',
    upcomingClassCard: 'upcoming-class-card',
    quickBookButton: 'quick-book-button',
    viewScheduleButton: 'view-schedule-button',
    creditsDisplay: 'credits-display',
    notificationBell: 'notification-bell',
  },

  // Schedule screen
  schedule: {
    screen: 'schedule-screen',
    calendar: 'calendar',
    classCard: 'class-card',
    classCardPrefix: 'class-card-', // append class ID
    bookButton: 'book-button',
    bookButtonPrefix: 'book-button-', // append class ID
    filterButton: 'filter-button',
    refreshButton: 'refresh-button',
    loadingSpinner: 'loading-spinner',
    emptyState: 'empty-state',
  },

  // Class details
  classDetails: {
    modal: 'class-details-modal',
    title: 'class-title',
    description: 'class-description',
    instructor: 'instructor-name',
    duration: 'class-duration',
    capacity: 'class-capacity',
    level: 'class-level',
    equipment: 'equipment-needed',
    bookButton: 'book-class-button',
    joinWaitlistButton: 'join-waitlist-button',
    closeButton: 'close-modal-button',
    attendeeAvatars: 'attendee-avatars',
  },

  // Bookings screen
  bookings: {
    screen: 'bookings-screen',
    bookingCard: 'booking-card',
    bookingCardPrefix: 'booking-card-', // append booking ID
    cancelButton: 'cancel-booking-button',
    rescheduleButton: 'reschedule-booking-button',
    filterTabs: 'booking-filter-tabs',
    upcomingTab: 'upcoming-bookings-tab',
    pastTab: 'past-bookings-tab',
    cancelledTab: 'cancelled-bookings-tab',
    emptyState: 'bookings-empty-state',
  },

  // Packages screen
  packages: {
    screen: 'packages-screen',
    packageCard: 'package-card',
    packageCardPrefix: 'package-card-', // append package ID
    buyButton: 'buy-package-button',
    myPackagesSection: 'my-packages-section',
    availablePackagesSection: 'available-packages-section',
    creditsRemaining: 'credits-remaining',
    expiryDate: 'expiry-date',
  },

  // Payment screen
  payment: {
    screen: 'payment-screen',
    cardInput: 'card-input',
    payButton: 'pay-button',
    amount: 'payment-amount',
    description: 'payment-description',
    loadingSpinner: 'payment-loading',
    successMessage: 'payment-success',
    errorMessage: 'payment-error',
    backButton: 'payment-back-button',
  },

  // Profile screen
  profile: {
    screen: 'profile-screen',
    avatar: 'profile-avatar',
    name: 'profile-name',
    email: 'profile-email',
    editProfileButton: 'edit-profile-button',
    settingsButton: 'profile-settings-button',
    logoutButton: 'logout-button',
    creditsCard: 'credits-card',
    membershipCard: 'membership-card',
  },

  // Edit profile screen
  editProfile: {
    screen: 'edit-profile-screen',
    firstNameInput: 'edit-first-name-input',
    lastNameInput: 'edit-last-name-input',
    phoneInput: 'edit-phone-input',
    dobInput: 'edit-dob-input',
    emergencyContactNameInput: 'edit-emergency-contact-name-input',
    emergencyContactPhoneInput: 'edit-emergency-contact-phone-input',
    healthConditionsInput: 'edit-health-conditions-input',
    notesInput: 'edit-notes-input',
    saveButton: 'save-profile-button',
    cancelButton: 'cancel-edit-button',
    avatarUpload: 'avatar-upload-button',
  },

  // Settings screens
  settings: {
    screen: 'settings-screen',
    securitySettings: 'security-settings-item',
    privacySettings: 'privacy-settings-item',
    notificationSettings: 'notification-settings-item',
    paymentMethods: 'payment-methods-item',
    aboutItem: 'about-item',
    logoutItem: 'logout-item',
    biometricToggle: 'biometric-toggle',
    notificationsToggle: 'notifications-toggle',
  },

  // Admin screens
  admin: {
    screen: 'admin-screen',
    userManagement: 'user-management-button',
    classManagement: 'class-management-button',
    reportsButton: 'reports-button',
    systemSettings: 'system-settings-button',
    userCard: 'admin-user-card',
    userCardPrefix: 'admin-user-card-', // append user ID
    addClass: 'add-class-button',
    editClass: 'edit-class-button',
  },

  // Common components
  common: {
    loadingSpinner: 'loading-spinner',
    errorMessage: 'error-message',
    successMessage: 'success-message',
    confirmDialog: 'confirm-dialog',
    confirmButton: 'confirm-action-button',
    cancelButton: 'cancel-action-button',
    searchInput: 'search-input',
    filterButton: 'filter-button',
    sortButton: 'sort-button',
    refreshButton: 'refresh-button',
    backButton: 'back-button',
    closeButton: 'close-button',
    emptyState: 'empty-state',
    fab: 'floating-action-button',
  },

  // Modals and overlays
  modals: {
    backdrop: 'modal-backdrop',
    container: 'modal-container',
    header: 'modal-header',
    title: 'modal-title',
    closeButton: 'modal-close-button',
    content: 'modal-content',
    footer: 'modal-footer',
    confirmButton: 'modal-confirm-button',
    cancelButton: 'modal-cancel-button',
  },

  // Forms
  forms: {
    submitButton: 'form-submit-button',
    resetButton: 'form-reset-button',
    validationError: 'validation-error',
    fieldError: 'field-error',
    requiredIndicator: 'required-indicator',
    helpText: 'help-text',
  },

  // Lists and grids
  lists: {
    container: 'list-container',
    item: 'list-item',
    itemPrefix: 'list-item-', // append item ID
    header: 'list-header',
    footer: 'list-footer',
    separator: 'list-separator',
    sectionHeader: 'section-header',
    emptyState: 'list-empty-state',
    loadMore: 'load-more-button',
  },

  // Social features
  social: {
    attendeeAvatars: 'attendee-avatars',
    attendeeModal: 'attendee-modal',
    attendeeList: 'attendee-list',
    friendProfile: 'friend-profile',
    addFriendButton: 'add-friend-button',
    removeFriendButton: 'remove-friend-button',
    friendsTab: 'friends-tab',
  },
} as const;

// Helper function to generate test IDs with prefixes
export const generateTestId = (prefix: string, id: string | number): string => {
  return `${prefix}${id}`;
};

// Type for accessing test IDs
export type TestIds = typeof testIds;