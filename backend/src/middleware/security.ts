import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import { ValidationError } from '../models/validation';

// MARK: - Enhanced Rate Limiting

/**
 * Enhanced rate limiting with different tiers for different endpoints
 */
export const createRateLimit = (options: {
  windowMs?: number;
  maxRequests?: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    skipSuccessfulRequests = false,
    keyGenerator
  } = options;

  return rateLimit({
    windowMs,
    max: maxRequests,
    skipSuccessfulRequests,
    keyGenerator: keyGenerator || ((req) => {
      // Use user ID if authenticated, otherwise IP
      const user = (req as any).user;
      return user?.id || req.ip || 'unknown';
    }),
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
        timestamp: new Date().toISOString()
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      // Provide standard Retry-After header in seconds
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          timestamp: new Date().toISOString(),
          retryAfter: Math.ceil(windowMs / 1000)
        }
      });
    }
  });
};

/**
 * Aggressive rate limiting for authentication endpoints
 */
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  skipSuccessfulRequests: true
});

/**
 * Standard rate limiting for API endpoints
 */
export const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100
});

/**
 * Strict rate limiting for data export/deletion endpoints
 */
export const sensitiveOperationRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3 // 3 requests per hour
});

/**
 * Speed limiting middleware to slow down repeated requests
 */
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  delayMs: () => 500, // Add 500ms delay per request after delayAfter (v2 API)
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  skipSuccessfulRequests: true
});

// MARK: - Input Validation and Sanitization

/**
 * Sanitize string input to prevent XSS and injection attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    throw new ValidationError('Input must be a string', []);
  }

  return input
    .trim()
    .replace(/[<>\"'&]/g, (match) => {
      const entities: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[match];
    })
    .substring(0, 1000); // Limit length
}

/**
 * Validate and sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeString(email).toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    throw new ValidationError('Invalid email format', []);
  }
  
  if (sanitized.length > 254) {
    throw new ValidationError('Email address too long', []);
  }
  
  return sanitized;
}

/**
 * Validate and sanitize numeric inputs
 */
export function sanitizeNumber(input: any, min?: number, max?: number): number {
  const num = Number(input);
  
  if (isNaN(num) || !isFinite(num)) {
    throw new ValidationError('Invalid number format', []);
  }
  
  if (min !== undefined && num < min) {
    throw new ValidationError(`Number must be at least ${min}`, []);
  }
  
  if (max !== undefined && num > max) {
    throw new ValidationError(`Number must be at most ${max}`, []);
  }
  
  return num;
}

/**
 * Validate geographic coordinates
 */
export function sanitizeCoordinates(lat: any, lng: any): { latitude: number; longitude: number } {
  const latitude = sanitizeNumber(lat, -90, 90);
  const longitude = sanitizeNumber(lng, -180, 180);
  
  return { latitude, longitude };
}

/**
 * Middleware to validate request body size and structure
 */
export function validateRequestBody(maxSize: number = 1024 * 1024) { // 1MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('content-length') || '0');
    
    if (contentLength > maxSize) {
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `Request body too large. Maximum size is ${maxSize} bytes.`,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    // Validate JSON structure if content-type is JSON
    if (req.is('application/json') && req.body) {
      try {
        // Check for deeply nested objects (potential DoS)
        const depth = getObjectDepth(req.body);
        if (depth > 10) {
          res.status(400).json({
            error: {
              code: 'INVALID_REQUEST',
              message: 'Request body structure too complex',
              timestamp: new Date().toISOString()
            }
          });
          return;
        }
      } catch (error) {
        res.status(400).json({
          error: {
            code: 'INVALID_JSON',
            message: 'Invalid JSON structure',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
    }
    
    next();
  };
}

/**
 * Calculate object nesting depth
 */
function getObjectDepth(obj: any, depth: number = 0): number {
  if (depth > 20) return depth; // Prevent stack overflow
  
  if (obj && typeof obj === 'object') {
    return 1 + Math.max(
      0,
      ...Object.values(obj).map(value => getObjectDepth(value, depth + 1))
    );
  }
  
  return 0;
}

// MARK: - Security Headers

/**
 * Enhanced security headers configuration
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// MARK: - Request Logging and Monitoring

/**
 * Security event logging middleware
 */
export function securityLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Log suspicious patterns
  const suspiciousPatterns = [
    /\b(union|select|insert|delete|drop|create|alter)\b/i, // SQL injection
    /<script|javascript:|vbscript:|onload=|onerror=/i, // XSS
    /\.\.\//g, // Path traversal
    /%2e%2e%2f/gi, // Encoded path traversal
  ];
  
  const userAgent = req.get('User-Agent') || '';
  const requestBody = JSON.stringify(req.body || {});
  const queryString = JSON.stringify(req.query || {});
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.url) || 
    pattern.test(requestBody) || 
    pattern.test(queryString) ||
    pattern.test(userAgent)
  );
  
  if (isSuspicious) {
    console.warn('🚨 Suspicious request detected:', {
      ip: req.ip,
      method: req.method,
      url: req.url,
      userAgent,
      body: requestBody.substring(0, 500), // Limit log size
      timestamp: new Date().toISOString()
    });
  }
  
  // Log response time and status
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (duration > 5000) { // Log slow requests
      console.warn('🐌 Slow request:', {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip
      });
    }
    
    if (res.statusCode >= 400) {
      console.warn('❌ Error response:', {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        ip: req.ip,
        userAgent: userAgent.substring(0, 100)
      });
    }
  });
  
  next();
}

// MARK: - CORS Configuration

/**
 * Enhanced CORS configuration
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('🚫 CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key'
  ],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400 // 24 hours
};

// MARK: - API Key Validation

/**
 * API key validation middleware for external integrations
 */
export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.get('X-API-Key');
  const validApiKeys = (process.env.VALID_API_KEYS || '').split(',').filter(Boolean);
  
  if (!apiKey) {
    res.status(401).json({
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key is required',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  if (!validApiKeys.includes(apiKey)) {
    console.warn('🔑 Invalid API key attempt:', {
      key: apiKey.substring(0, 8) + '...',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(401).json({
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  next();
}

// MARK: - Request ID Generation

/**
 * Generate unique request ID for tracing
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = crypto.randomUUID();
  (req as any).requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

// MARK: - Content Type Validation

/**
 * Validate content type for POST/PUT requests
 */
export function validateContentType(allowedTypes: string[] = ['application/json']) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.get('Content-Type');
      
      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        res.status(415).json({
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
    }
    
    next();
  };
}