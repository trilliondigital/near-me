import { Request, Response, NextFunction } from 'express';
import { 
  authenticateToken, 
  optionalAuthentication, 
  requirePremium, 
  checkTaskLimit,
  rateLimit 
} from '../auth';
import { AuthService } from '../../services/authService';
import { ValidationError } from '../../models/validation';

// Mock AuthService
jest.mock('../../services/authService', () => ({
  AuthService: {
    validateSession: jest.fn()
  }
}));

const mockValidateSession = AuthService.validateSession as jest.Mock;

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      ip: '127.0.0.1'
    } as Partial<Request>;
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', async () => {
      const mockUser = { id: 'user-123' };
      const mockSessionId = 'session-456';

      mockReq.headers = {
        authorization: 'Bearer valid-token'
      };

      mockValidateSession.mockResolvedValue({
        user: mockUser as any,
        sessionId: mockSessionId
      });

      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as any).user).toBe(mockUser);
      expect((mockReq as any).sessionId).toBe(mockSessionId);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 for missing authorization header', async () => {
      await authenticateToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Authorization header is required',
          timestamp: expect.any(String)
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requirePremium', () => {
    it('should allow premium user', () => {
      (mockReq as any).user = {
        isPremium: () => true
      };

      requirePremium(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('rateLimit', () => {
    it('should allow requests under limit', () => {
      const rateLimitMiddleware = rateLimit(60000, 10);

      rateLimitMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests over limit', () => {
      const rateLimitMiddleware = rateLimit(60000, 1);

      // First request should pass
      rateLimitMiddleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Second request should be blocked
      jest.clearAllMocks();
      rateLimitMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});