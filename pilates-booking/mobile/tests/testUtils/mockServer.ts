/**
 * Mock Service Worker setup for API mocking in tests.
 */

import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { mockUsers, mockClasses, mockBookings, mockPackages } from './testData';

const baseUrl = 'http://localhost:8000/api/v1';

// Mock API handlers
const handlers = [
  // Auth endpoints
  rest.post(`${baseUrl}/auth/login`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        token_type: 'bearer',
        expires_in: 3600,
      })
    );
  }),

  rest.post(`${baseUrl}/auth/register`, (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        message: 'User registered successfully',
        user: mockUsers.student,
      })
    );
  }),

  rest.post(`${baseUrl}/auth/refresh`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        access_token: 'new_mock_access_token',
        refresh_token: 'new_mock_refresh_token',
        token_type: 'bearer',
        expires_in: 3600,
      })
    );
  }),

  rest.get(`${baseUrl}/users/me`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(mockUsers.student));
  }),

  // Classes endpoints
  rest.get(`${baseUrl}/classes`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(mockClasses));
  }),

  rest.get(`${baseUrl}/classes/:id`, (req, res, ctx) => {
    const { id } = req.params;
    const classItem = mockClasses.find((c) => c.id === Number(id));
    
    if (!classItem) {
      return res(ctx.status(404), ctx.json({ detail: 'Class not found' }));
    }
    
    return res(ctx.status(200), ctx.json(classItem));
  }),

  // Bookings endpoints
  rest.get(`${baseUrl}/bookings`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(mockBookings));
  }),

  rest.post(`${baseUrl}/bookings`, (req, res, ctx) => {
    return res(
      ctx.status(201),
      ctx.json({
        ...mockBookings[0],
        id: Date.now(), // Generate a unique ID
      })
    );
  }),

  rest.delete(`${baseUrl}/bookings/:id`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({ message: 'Booking cancelled successfully' })
    );
  }),

  // Packages endpoints
  rest.get(`${baseUrl}/packages`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(mockPackages));
  }),

  rest.post(`${baseUrl}/packages/:id/purchase`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        client_secret: 'pi_mock_payment_intent_secret',
        payment_intent_id: 'pi_mock_payment_intent',
      })
    );
  }),

  // Payment endpoints
  rest.post(`${baseUrl}/payments/confirm`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        success: true,
        payment_id: 'pay_mock_payment',
      })
    );
  }),

  // Admin endpoints
  rest.get(`${baseUrl}/admin/users`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json([mockUsers.student, mockUsers.instructor]));
  }),

  // Error simulation handlers
  rest.get(`${baseUrl}/error/500`, (req, res, ctx) => {
    return res(ctx.status(500), ctx.json({ detail: 'Internal Server Error' }));
  }),

  rest.get(`${baseUrl}/error/404`, (req, res, ctx) => {
    return res(ctx.status(404), ctx.json({ detail: 'Not Found' }));
  }),

  rest.get(`${baseUrl}/error/network`, (req, res, ctx) => {
    return res.networkError('Network connection failed');
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