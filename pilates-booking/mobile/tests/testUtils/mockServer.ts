/**
 * Enhanced Mock Service Worker setup for realistic API mocking in tests.
 * Includes comprehensive error scenarios, network simulation, and business logic.
 */

import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { mockUsers, mockClasses, mockBookings, mockPackages } from './testData';

const baseUrl = 'http://localhost:8000/api/v1';

// Mock state management for stateful operations
const mockState = {
  users: { ...mockUsers },
  classes: [...mockClasses],
  bookings: [...mockBookings],
  packages: [...mockPackages],
  rateLimitCounts: new Map<string, number>(),
  networkReliability: 0.95, // 95% success rate by default
  responseDelay: { min: 100, max: 500 }, // Realistic response times
};

// Helper functions for realistic API behavior
const getRealisticDelay = () => {
  const { min, max } = mockState.responseDelay;
  return Math.random() * (max - min) + min;
};

const shouldSimulateNetworkFailure = () => {
  return Math.random() > mockState.networkReliability;
};

const checkRateLimit = (ip: string, limit: number = 100) => {
  const count = mockState.rateLimitCounts.get(ip) || 0;
  mockState.rateLimitCounts.set(ip, count + 1);
  return count >= limit;
};

const validateAuthToken = (req: any) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.replace('Bearer ', '');
  return token && token !== 'invalid_token';
};

// Business logic validators
const validateBookingRules = (booking: any, user: any) => {
  const errors: string[] = [];
  
  // Check if user has sufficient credits
  const userPackage = user.packages?.find((p: any) => p.id === booking.user_package_id);
  if (!userPackage) {
    errors.push('Invalid package selected');
  } else if (!userPackage.is_unlimited && userPackage.remaining_credits <= 0) {
    errors.push('Insufficient credits remaining');
  }
  
  // Check if class is not in the past
  const classItem = mockState.classes.find(c => c.id === booking.class_instance_id);
  if (classItem && new Date(classItem.start_datetime) < new Date()) {
    errors.push('Cannot book past classes');
  }
  
  // Check if class has capacity
  if (classItem && classItem.available_spots <= 0) {
    errors.push('Class is full');
  }
  
  // Check for double booking
  const existingBooking = mockState.bookings.find(b => 
    b.user_id === user.id && 
    b.class_instance_id === booking.class_instance_id &&
    b.status === 'confirmed'
  );
  if (existingBooking) {
    errors.push('You have already booked this class');
  }
  
  return errors;
};

// Enhanced Mock API handlers with realistic behavior
const handlers = [
  // Auth endpoints with comprehensive validation
  rest.post(`${baseUrl}/auth/login`, async (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Connection timeout');
    }

    const clientIp = req.headers.get('x-forwarded-for') || 'test-ip';
    if (checkRateLimit(clientIp, 5)) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(429),
        ctx.json({
          detail: 'Too many login attempts. Please try again later.',
          retry_after: 300
        })
      );
    }

    const body = await req.json();
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(422),
        ctx.json({
          detail: 'Validation error',
          errors: [
            ...(email ? [] : [{ field: 'email', message: 'Email is required' }]),
            ...(password ? [] : [{ field: 'password', message: 'Password is required' }])
          ]
        })
      );
    }

    // Simulate different login scenarios
    if (email === 'invalid@example.com') {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(401),
        ctx.json({ detail: 'Invalid email or password' })
      );
    }

    if (email === 'unverified@example.com') {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(403),
        ctx.json({ 
          detail: 'Please verify your email before logging in',
          verification_required: true
        })
      );
    }

    if (email === 'suspended@example.com') {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(403),
        ctx.json({ 
          detail: 'Account suspended. Contact support.',
          support_email: 'support@pilatesstudio.com'
        })
      );
    }

    // Successful login
    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json({
        access_token: 'mock_access_token_' + Date.now(),
        refresh_token: 'mock_refresh_token_' + Date.now(),
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: 1,
          email,
          role: email.includes('admin') ? 'admin' : 'student',
          first_name: 'Test',
          last_name: 'User',
          is_verified: true
        }
      })
    );
  }),

  rest.post(`${baseUrl}/auth/register`, async (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Registration failed due to network error');
    }

    const body = await req.json();
    const { email, password, first_name, last_name, phone } = body;

    // Comprehensive validation
    const errors = [];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ field: 'email', message: 'Valid email is required' });
    }
    if (!password || password.length < 8) {
      errors.push({ field: 'password', message: 'Password must be at least 8 characters' });
    }
    if (!first_name) {
      errors.push({ field: 'first_name', message: 'First name is required' });
    }
    if (!last_name) {
      errors.push({ field: 'last_name', message: 'Last name is required' });
    }

    if (errors.length > 0) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(422),
        ctx.json({ detail: 'Validation failed', errors })
      );
    }

    // Simulate existing email
    if (email === 'existing@example.com') {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(409),
        ctx.json({ 
          detail: 'Email already registered',
          login_url: '/auth/login'
        })
      );
    }

    // Successful registration
    const newUser = {
      id: Date.now(),
      email,
      first_name,
      last_name,
      phone,
      role: 'student',
      is_verified: false,
      is_active: true,
      created_at: new Date().toISOString()
    };

    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(201),
      ctx.json({
        message: 'Registration successful. Please check your email for verification.',
        user: newUser,
        verification_required: true
      })
    );
  }),

  rest.get(`${baseUrl}/users/me`, (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Failed to fetch user profile');
    }

    if (!validateAuthToken(req)) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(401),
        ctx.json({ 
          detail: 'Authentication credentials were not provided or are invalid',
          error_code: 'INVALID_TOKEN'
        })
      );
    }

    // Return user with realistic data structure
    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json({
        ...mockState.users.student,
        last_login: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        profile_completion: 85,
        preferences: {
          email_notifications: true,
          push_notifications: true,
          marketing_emails: false
        }
      })
    );
  }),

  // Classes endpoints with pagination and filtering
  rest.get(`${baseUrl}/classes`, (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Failed to load classes');
    }

    if (!validateAuthToken(req)) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(401),
        ctx.json({ detail: 'Authentication required' })
      );
    }

    // Extract query parameters for pagination and filtering
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const level = url.searchParams.get('level');
    const instructor = url.searchParams.get('instructor');
    const date = url.searchParams.get('date');

    let filteredClasses = [...mockState.classes];

    // Apply filters
    if (level) {
      filteredClasses = filteredClasses.filter(c => c.template.level === level);
    }
    if (instructor) {
      filteredClasses = filteredClasses.filter(c => 
        c.instructor.first_name.toLowerCase().includes(instructor.toLowerCase()) ||
        c.instructor.last_name.toLowerCase().includes(instructor.toLowerCase())
      );
    }
    if (date) {
      filteredClasses = filteredClasses.filter(c => 
        c.start_datetime.startsWith(date)
      );
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedClasses = filteredClasses.slice(startIndex, endIndex);

    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json({
        classes: paginatedClasses,
        pagination: {
          page,
          limit,
          total: filteredClasses.length,
          pages: Math.ceil(filteredClasses.length / limit)
        },
        filters_applied: { level, instructor, date }
      })
    );
  }),

  rest.get(`${baseUrl}/classes/:id`, (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Failed to load class details');
    }

    const { id } = req.params;
    const classItem = mockState.classes.find((c) => c.id === Number(id));
    
    if (!classItem) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(404), 
        ctx.json({ 
          detail: 'Class not found',
          error_code: 'CLASS_NOT_FOUND',
          suggestions: ['Check the class ID', 'Browse available classes']
        })
      );
    }

    // Simulate real-time capacity updates
    const currentBookings = mockState.bookings.filter(b => 
      b.class_instance_id === Number(id) && b.status === 'confirmed'
    );
    const availableSpots = Math.max(0, classItem.capacity - currentBookings.length);
    
    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200), 
      ctx.json({
        ...classItem,
        available_spots: availableSpots,
        current_bookings: currentBookings.length,
        is_full: availableSpots === 0,
        waitlist_count: mockState.bookings.filter(b => 
          b.class_instance_id === Number(id) && b.status === 'waitlisted'
        ).length
      })
    );
  }),

  // Enhanced Bookings endpoints with comprehensive business logic
  rest.get(`${baseUrl}/bookings`, (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Failed to load bookings');
    }

    if (!validateAuthToken(req)) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(401),
        ctx.json({ detail: 'Authentication required' })
      );
    }

    // Filter bookings by status
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    
    let userBookings = [...mockState.bookings];
    
    if (status) {
      userBookings = userBookings.filter(b => b.status === status);
    }

    // Add class details to each booking
    const enrichedBookings = userBookings.map(booking => ({
      ...booking,
      class_instance: mockState.classes.find(c => c.id === booking.class_instance_id),
      can_cancel: new Date(booking.class_instance?.start_datetime || '') > new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours before
      cancellation_deadline: new Date(new Date(booking.class_instance?.start_datetime || '').getTime() - 2 * 60 * 60 * 1000).toISOString()
    }));

    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json(enrichedBookings)
    );
  }),

  rest.post(`${baseUrl}/bookings`, async (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Booking failed due to network error');
    }

    if (!validateAuthToken(req)) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(401),
        ctx.json({ detail: 'Authentication required' })
      );
    }

    const body = await req.json();
    const { class_instance_id, user_package_id, payment_method } = body;

    // Validate request
    if (!class_instance_id) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(422),
        ctx.json({ 
          detail: 'Validation error',
          errors: [{ field: 'class_instance_id', message: 'Class ID is required' }]
        })
      );
    }

    // Find the class
    const classItem = mockState.classes.find(c => c.id === class_instance_id);
    if (!classItem) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(404),
        ctx.json({ detail: 'Class not found' })
      );
    }

    // Simulate business rule validation
    const validationErrors = validateBookingRules(body, mockState.users.student);
    if (validationErrors.length > 0) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(400),
        ctx.json({ 
          detail: 'Booking validation failed',
          errors: validationErrors.map(error => ({ message: error }))
        })
      );
    }

    // Check if class is full (for waitlist logic)
    const currentBookings = mockState.bookings.filter(b => 
      b.class_instance_id === class_instance_id && b.status === 'confirmed'
    );
    const isClassFull = currentBookings.length >= classItem.capacity;

    // Create booking
    const newBooking = {
      id: Date.now(),
      user_id: mockState.users.student.id,
      class_instance_id,
      user_package_id,
      status: isClassFull ? 'waitlisted' : 'confirmed',
      payment_method: payment_method || 'credits',
      credits_used: payment_method === 'cash' ? 0 : 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockState.bookings.push(newBooking);

    // Update user package credits if applicable
    if (payment_method !== 'cash' && user_package_id) {
      const userPackage = mockState.users.student.packages?.find((p: any) => p.id === user_package_id);
      if (userPackage && !userPackage.is_unlimited) {
        userPackage.remaining_credits -= 1;
      }
    }

    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(isClassFull ? 200 : 201),
      ctx.json({
        ...newBooking,
        class_instance: classItem,
        message: isClassFull ? 'Added to waitlist' : 'Booking confirmed'
      })
    );
  }),

  rest.delete(`${baseUrl}/bookings/:id`, async (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Cancellation failed');
    }

    if (!validateAuthToken(req)) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(401),
        ctx.json({ detail: 'Authentication required' })
      );
    }

    const { id } = req.params;
    const bookingId = Number(id);
    
    const booking = mockState.bookings.find(b => b.id === bookingId);
    if (!booking) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(404),
        ctx.json({ detail: 'Booking not found' })
      );
    }

    // Check cancellation window
    const classItem = mockState.classes.find(c => c.id === booking.class_instance_id);
    const classStartTime = new Date(classItem?.start_datetime || '');
    const cancellationDeadline = new Date(classStartTime.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
    
    if (new Date() > cancellationDeadline) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(400),
        ctx.json({ 
          detail: 'Cannot cancel booking within 2 hours of class start',
          cancellation_deadline: cancellationDeadline.toISOString()
        })
      );
    }

    // Cancel booking
    booking.status = 'cancelled';
    booking.cancelled_at = new Date().toISOString();
    
    // Refund credit if applicable
    let creditRefunded = false;
    if (booking.user_package_id && booking.credits_used > 0) {
      const userPackage = mockState.users.student.packages?.find((p: any) => p.id === booking.user_package_id);
      if (userPackage) {
        if (userPackage.is_unlimited) {
          creditRefunded = false; // No credit to refund for unlimited
        } else {
          userPackage.remaining_credits += booking.credits_used;
          creditRefunded = true;
        }
      }
    }

    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json({
        ...booking,
        message: 'Booking cancelled successfully',
        credit_refunded: creditRefunded,
        refunded_credits: creditRefunded ? booking.credits_used : 0
      })
    );
  }),

  // Enhanced Packages endpoints with business logic validation
  rest.get(`${baseUrl}/packages`, (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Failed to load packages');
    }

    // Optional authentication check for package visibility
    const url = new URL(req.url);
    const includeInactive = url.searchParams.get('include_inactive') === 'true';
    
    let availablePackages = [...mockState.packages];
    
    // Filter inactive packages unless admin
    if (!includeInactive) {
      availablePackages = availablePackages.filter(p => p.is_active !== false);
    }

    // Add dynamic pricing simulation
    const packagesWithDynamicPricing = availablePackages.map(pkg => ({
      ...pkg,
      is_popular: pkg.credits === 10, // Mark 10-class packs as popular
      discount_percentage: pkg.credits >= 20 ? 15 : (pkg.credits >= 10 ? 10 : 0),
      limited_time_offer: Math.random() > 0.7, // 30% chance of limited offer
      purchase_count: Math.floor(Math.random() * 100), // Simulate popularity
    }));

    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json({
        packages: packagesWithDynamicPricing,
        metadata: {
          total_count: packagesWithDynamicPricing.length,
          active_promotions: packagesWithDynamicPricing.filter(p => p.limited_time_offer).length,
          most_popular: packagesWithDynamicPricing.find(p => p.is_popular)
        }
      })
    );
  }),

  rest.get(`${baseUrl}/packages/:id`, (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Failed to load package details');
    }

    const { id } = req.params;
    const packageItem = mockState.packages.find(p => p.id === Number(id));
    
    if (!packageItem) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(404),
        ctx.json({ 
          detail: 'Package not found',
          error_code: 'PACKAGE_NOT_FOUND',
          suggestions: ['Check the package ID', 'Browse available packages']
        })
      );
    }

    // Enhance package details with additional metadata
    const enhancedPackage = {
      ...packageItem,
      terms_and_conditions: [
        'Package expires after validity period',
        'Credits cannot be refunded after use',
        'Transfers between users not allowed',
        'Subject to studio terms of service'
      ],
      features: packageItem.is_unlimited ? 
        ['Unlimited class bookings', 'Priority booking access', 'Guest passes included'] :
        [`${packageItem.credits} class credits`, 'Flexible scheduling', 'Transfer between locations'],
      estimated_savings: packageItem.credits ? 
        Math.round((packageItem.credits * 25 - packageItem.price) * 100) / 100 : null
    };

    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json(enhancedPackage)
    );
  }),

  rest.post(`${baseUrl}/packages/:id/purchase`, async (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Payment service unavailable');
    }

    if (!validateAuthToken(req)) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(401),
        ctx.json({ detail: 'Authentication required for purchases' })
      );
    }

    const { id } = req.params;
    const body = await req.json();
    const { payment_method_id, billing_details, promotional_code } = body;

    const packageItem = mockState.packages.find(p => p.id === Number(id));
    if (!packageItem) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(404),
        ctx.json({ detail: 'Package not found' })
      );
    }

    // Validate package availability
    if (!packageItem.is_active) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(400),
        ctx.json({ 
          detail: 'Package is no longer available',
          error_code: 'PACKAGE_INACTIVE'
        })
      );
    }

    // Validate required fields
    if (!payment_method_id) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(422),
        ctx.json({
          detail: 'Payment method is required',
          errors: [{ field: 'payment_method_id', message: 'Payment method ID is required' }]
        })
      );
    }

    // Simulate payment processing scenarios
    if (payment_method_id === 'pm_card_visa_chargeDeclined') {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(402),
        ctx.json({
          detail: 'Payment failed',
          error_code: 'CARD_DECLINED',
          decline_code: 'generic_decline',
          message: 'Your card was declined. Please try a different payment method.'
        })
      );
    }

    if (payment_method_id === 'pm_card_visa_insufficientFunds') {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(402),
        ctx.json({
          detail: 'Payment failed',
          error_code: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient funds on your payment method.'
        })
      );
    }

    // Apply promotional code if provided
    let finalPrice = packageItem.price;
    let discount = 0;
    if (promotional_code) {
      if (promotional_code === 'WELCOME10') {
        discount = packageItem.price * 0.1;
        finalPrice = packageItem.price - discount;
      } else if (promotional_code === 'NEWMEMBER20') {
        discount = packageItem.price * 0.2;
        finalPrice = packageItem.price - discount;
      } else if (promotional_code === 'INVALID') {
        return res(
          ctx.delay(getRealisticDelay()),
          ctx.status(400),
          ctx.json({ 
            detail: 'Invalid promotional code',
            error_code: 'INVALID_PROMO_CODE'
          })
        );
      }
    }

    // Simulate successful payment intent creation
    const paymentIntent = {
      payment_intent_id: `pi_mock_${Date.now()}`,
      client_secret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
      amount: Math.round(finalPrice * 100), // Convert to cents
      currency: 'usd',
      status: 'requires_confirmation',
      package_id: packageItem.id,
      discount_applied: discount,
      promotional_code: promotional_code || null,
      metadata: {
        package_name: packageItem.name,
        user_email: 'test@example.com' // In real app, would be from auth
      }
    };

    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json(paymentIntent)
    );
  }),

  // Enhanced Payment endpoints with comprehensive processing simulation
  rest.post(`${baseUrl}/payments/confirm`, async (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Payment confirmation failed');
    }

    if (!validateAuthToken(req)) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(401),
        ctx.json({ detail: 'Authentication required' })
      );
    }

    const body = await req.json();
    const { payment_intent_id, expected_amount } = body;

    if (!payment_intent_id) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(422),
        ctx.json({
          detail: 'Payment intent ID is required',
          errors: [{ field: 'payment_intent_id', message: 'Payment intent ID is required' }]
        })
      );
    }

    // Simulate various payment confirmation scenarios
    if (payment_intent_id.includes('fail')) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(400),
        ctx.json({
          detail: 'Payment confirmation failed',
          error_code: 'PAYMENT_FAILED',
          message: 'Payment could not be processed at this time.'
        })
      );
    }

    if (payment_intent_id.includes('timeout')) {
      return res(
        ctx.delay(5000), // Long delay to simulate timeout
        ctx.status(408),
        ctx.json({
          detail: 'Payment confirmation timed out',
          error_code: 'PAYMENT_TIMEOUT'
        })
      );
    }

    // Successful payment confirmation
    const userPackageId = Date.now();
    const paymentId = `pay_mock_${Date.now()}`;

    // Add package to user's account (simulate)
    const newUserPackage = {
      id: userPackageId,
      package_id: 1, // Assume first package for mock
      user_id: mockState.users.student.id,
      remaining_credits: 10,
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
      purchased_at: new Date().toISOString()
    };

    // Add to mock state (if user packages exist)
    if (!mockState.users.student.packages) {
      mockState.users.student.packages = [];
    }
    mockState.users.student.packages.push(newUserPackage);

    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json({
        payment_id: paymentId,
        payment_status: 'succeeded',
        user_package_id: userPackageId,
        confirmation_number: `CONF${Date.now().toString().slice(-6)}`,
        receipt_url: `https://pilatesstudio.com/receipts/${paymentId}`,
        package_details: {
          name: 'Mock Package',
          credits: 10,
          expires_at: newUserPackage.expires_at
        },
        next_steps: [
          'Your package has been activated',
          'You can now book classes',
          'Check your email for receipt'
        ]
      })
    );
  }),

  rest.post(`${baseUrl}/payments/refund`, async (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Refund service unavailable');
    }

    if (!validateAuthToken(req)) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(401),
        ctx.json({ detail: 'Authentication required' })
      );
    }

    const body = await req.json();
    const { payment_id, reason, amount } = body;

    // Validate refund eligibility
    if (!payment_id) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(422),
        ctx.json({
          detail: 'Payment ID is required for refunds',
          errors: [{ field: 'payment_id', message: 'Payment ID is required' }]
        })
      );
    }

    // Simulate refund policy checks
    if (payment_id.includes('old')) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(400),
        ctx.json({
          detail: 'Refund window has expired',
          error_code: 'REFUND_EXPIRED',
          policy: 'Refunds must be requested within 7 days of purchase'
        })
      );
    }

    if (payment_id.includes('used')) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(400),
        ctx.json({
          detail: 'Cannot refund used package',
          error_code: 'PACKAGE_USED',
          message: 'Package has been used and cannot be fully refunded'
        })
      );
    }

    // Successful refund initiation
    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json({
        refund_id: `refund_mock_${Date.now()}`,
        refund_status: 'processing',
        refund_amount: amount || 150.00,
        estimated_arrival: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        reason: reason || 'Customer request',
        next_steps: [
          'Refund is being processed',
          'You will receive email confirmation',
          'Funds typically arrive in 3-5 business days'
        ]
      })
    );
  }),

  // Enhanced Admin endpoints with role-based access and validation
  rest.get(`${baseUrl}/admin/users`, (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Admin service unavailable');
    }

    // Check admin authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.includes('admin')) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(403),
        ctx.json({ 
          detail: 'Admin access required',
          error_code: 'INSUFFICIENT_PERMISSIONS' 
        })
      );
    }

    // Simulate pagination and filtering for admin user management
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const role = url.searchParams.get('role');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    let users = [mockState.users.student, mockState.users.instructor];

    // Apply filters
    if (role) {
      users = users.filter(u => u.role === role);
    }
    if (status) {
      users = users.filter(u => status === 'active' ? u.is_active : !u.is_active);
    }
    if (search) {
      users = users.filter(u => 
        u.first_name.toLowerCase().includes(search.toLowerCase()) ||
        u.last_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Add admin metadata
    const enrichedUsers = users.map(user => ({
      ...user,
      total_bookings: Math.floor(Math.random() * 50),
      last_activity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      registration_source: ['web', 'mobile', 'referral'][Math.floor(Math.random() * 3)],
      lifetime_value: Math.floor(Math.random() * 1000) + 100
    }));

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedUsers = enrichedUsers.slice(startIndex, startIndex + limit);

    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json({
        users: paginatedUsers,
        pagination: {
          page,
          limit,
          total: enrichedUsers.length,
          pages: Math.ceil(enrichedUsers.length / limit)
        },
        summary: {
          total_users: enrichedUsers.length,
          active_users: enrichedUsers.filter(u => u.is_active).length,
          new_this_month: Math.floor(enrichedUsers.length * 0.1)
        }
      })
    );
  }),

  rest.get(`${baseUrl}/admin/analytics/dashboard`, (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Analytics service unavailable');
    }

    // Check admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.includes('admin')) {
      return res(
        ctx.delay(getRealisticDelay()),
        ctx.status(403),
        ctx.json({ detail: 'Admin access required' })
      );
    }

    // Simulate comprehensive admin dashboard data
    const dashboardData = {
      overview: {
        total_bookings_today: Math.floor(Math.random() * 50) + 20,
        total_revenue_today: Math.floor(Math.random() * 2000) + 500,
        active_users: Math.floor(Math.random() * 500) + 100,
        class_utilization_rate: Math.floor(Math.random() * 40) + 60 // 60-100%
      },
      recent_activity: [
        { type: 'booking', user: 'John D.', class: 'Morning Pilates', time: '2 min ago' },
        { type: 'payment', user: 'Sarah M.', amount: '$149.99', time: '5 min ago' },
        { type: 'registration', user: 'Mike K.', source: 'referral', time: '12 min ago' }
      ],
      popular_classes: [
        { name: 'Beginner Pilates', bookings: 145, trend: 'up' },
        { name: 'Advanced Flow', bookings: 89, trend: 'stable' },
        { name: 'Morning Stretch', bookings: 67, trend: 'down' }
      ],
      revenue_chart: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        revenue: Math.floor(Math.random() * 1000) + 500
      })),
      alerts: [
        { type: 'warning', message: 'Class "Evening Yoga" has low enrollment', priority: 'medium' },
        { type: 'info', message: '3 new users registered today', priority: 'low' }
      ]
    };

    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json(dashboardData)
    );
  }),

  rest.post(`${baseUrl}/admin/tasks/expire-packages`, (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Task execution failed');
    }

    // Simulate admin task execution
    const expiredCount = Math.floor(Math.random() * 10) + 1;
    
    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json({
        task: 'expire-packages',
        status: 'completed',
        expired_packages: expiredCount,
        execution_time: Math.floor(Math.random() * 5000) + 1000, // 1-6 seconds
        next_scheduled_run: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    );
  }),

  // Enhanced Error simulation handlers for comprehensive testing
  rest.get(`${baseUrl}/error/500`, (req, res, ctx) => {
    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(500), 
      ctx.json({ 
        detail: 'Internal Server Error',
        error_code: 'INTERNAL_ERROR',
        request_id: `req_${Date.now()}`,
        timestamp: new Date().toISOString()
      })
    );
  }),

  rest.get(`${baseUrl}/error/404`, (req, res, ctx) => {
    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(404), 
      ctx.json({ 
        detail: 'The requested resource was not found',
        error_code: 'NOT_FOUND',
        suggestions: ['Check the URL', 'Verify resource exists']
      })
    );
  }),

  rest.get(`${baseUrl}/error/network`, (req, res, ctx) => {
    return res.networkError('Network connection failed');
  }),

  rest.get(`${baseUrl}/error/timeout`, (req, res, ctx) => {
    return res(
      ctx.delay(10000), // 10 second delay to simulate timeout
      ctx.status(408),
      ctx.json({ 
        detail: 'Request timeout',
        error_code: 'TIMEOUT' 
      })
    );
  }),

  rest.get(`${baseUrl}/error/rate-limit`, (req, res, ctx) => {
    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(429),
      ctx.json({
        detail: 'Rate limit exceeded',
        error_code: 'RATE_LIMIT_EXCEEDED',
        retry_after: 60,
        limit: 100,
        remaining: 0,
        reset_time: new Date(Date.now() + 60 * 1000).toISOString()
      })
    );
  }),

  rest.get(`${baseUrl}/error/maintenance`, (req, res, ctx) => {
    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(503),
      ctx.json({
        detail: 'Service temporarily unavailable for maintenance',
        error_code: 'SERVICE_UNAVAILABLE',
        maintenance_window: {
          start: new Date().toISOString(),
          estimated_end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        },
        message: 'We are currently performing scheduled maintenance. Please try again later.'
      })
    );
  }),

  // Webhook simulation endpoints
  rest.post(`${baseUrl}/webhooks/stripe`, async (req, res, ctx) => {
    if (shouldSimulateNetworkFailure()) {
      return res.networkError('Webhook processing failed');
    }

    const body = await req.json();
    const { type } = body;

    // Simulate webhook processing delays
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

    return res(
      ctx.delay(getRealisticDelay()),
      ctx.status(200),
      ctx.json({
        received: true,
        event_type: type,
        processed_at: new Date().toISOString(),
        webhook_id: `wh_${Date.now()}`
      })
    );
  }),
];

// Create mock server
export const mockServer = setupServer(...handlers);

// Helper functions for test setup
export const setupMockServer = () => {
  beforeAll(() => mockServer.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => mockServer.resetHandlers());
  afterAll(() => mockServer.close());
};

// Custom handlers for specific test scenarios
export const mockServerHandlers = {
  // Simulate network error
  networkError: (endpoint: string) => {
    mockServer.use(
      rest.get(`${baseUrl}${endpoint}`, (req, res, ctx) => {
        return res.networkError('Network connection failed');
      })
    );
  },

  // Simulate server error
  serverError: (endpoint: string, status: number = 500) => {
    mockServer.use(
      rest.get(`${baseUrl}${endpoint}`, (req, res, ctx) => {
        return res(ctx.status(status), ctx.json({ detail: 'Server Error' }));
      })
    );
  },

  // Simulate authentication error
  authError: () => {
    mockServer.use(
      rest.get(`${baseUrl}/users/me`, (req, res, ctx) => {
        return res(ctx.status(401), ctx.json({ detail: 'Not authenticated' }));
      })
    );
  },

  // Simulate slow response
  slowResponse: (endpoint: string, delay: number = 2000) => {
    mockServer.use(
      rest.get(`${baseUrl}${endpoint}`, (req, res, ctx) => {
        return res(ctx.delay(delay), ctx.status(200), ctx.json({}));
      })
    );
  },

  // Reset to default handlers
  reset: () => {
    mockServer.resetHandlers(...handlers);
  },
};