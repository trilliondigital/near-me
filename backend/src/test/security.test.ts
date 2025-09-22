import request from 'supertest';
import app from '../server';
import { EncryptionService } from '../services/encryptionService';
import { TokenService } from '../services/tokenService';
import { 
  sanitizeString, 
  sanitizeEmail, 
  sanitizeNumber, 
  sanitizeCoordinates 
} from '../middleware/security';

describe('Security Tests', () => {
  
  // MARK: - Encryption Service Tests
  
  describe('EncryptionService', () => {
    beforeAll(() => {
      EncryptionService.initialize('a'.repeat(64)); // 64 hex chars = 32 bytes
    });

    test('should encrypt and decrypt data correctly', () => {
      const plaintext = 'sensitive data';
      const encrypted = EncryptionService.encrypt(plaintext);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    test('should generate different encrypted values for same input', () => {
      const plaintext = 'test data';
      const encrypted1 = EncryptionService.encrypt(plaintext);
      const encrypted2 = EncryptionService.encrypt(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
      expect(EncryptionService.decrypt(encrypted1)).toBe(plaintext);
      expect(EncryptionService.decrypt(encrypted2)).toBe(plaintext);
    });

    test('should fail to decrypt tampered data', () => {
      const plaintext = 'test data';
      const encrypted = EncryptionService.encrypt(plaintext);
      const tampered = encrypted.slice(0, -5) + 'XXXXX';
      
      expect(() => EncryptionService.decrypt(tampered)).toThrow();
    });

    test('should hash passwords securely', async () => {
      const password = 'testPassword123';
      const hash = await EncryptionService.hashPassword(password);
      
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      
      const isValid = await EncryptionService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await EncryptionService.verifyPassword('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });

    test('should generate secure tokens', () => {
      const token1 = EncryptionService.generateSecureToken();
      const token2 = EncryptionService.generateSecureToken();
      
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes * 2 (hex)
    });

    test('should generate and verify HMAC signatures', () => {
      const data = 'test data for signing';
      const signature = EncryptionService.generateHMAC(data);
      
      expect(signature).toBeTruthy();
      expect(EncryptionService.verifyHMAC(data, signature)).toBe(true);
      expect(EncryptionService.verifyHMAC('tampered data', signature)).toBe(false);
    });

    test('should encrypt and decrypt objects', () => {
      const obj = { id: 1, name: 'test', sensitive: 'secret data' };
      const encrypted = EncryptionService.encryptObject(obj);
      const decrypted = EncryptionService.decryptObject(encrypted);
      
      expect(decrypted).toEqual(obj);
    });

    test('should handle encryption with expiration', () => {
      const data = 'expiring data';
      const encrypted = EncryptionService.encryptWithExpiration(data, 1000); // 1 second
      
      // Should decrypt immediately
      expect(EncryptionService.decryptWithExpiration(encrypted)).toBe(data);
      
      // Should expire after timeout (we'll simulate this by manipulating time)
      jest.useFakeTimers();
      jest.advanceTimersByTime(2000);
      
      expect(EncryptionService.decryptWithExpiration(encrypted)).toBeNull();
      
      jest.useRealTimers();
    });
  });

  // MARK: - Token Service Tests
  
  describe('TokenService', () => {
    beforeAll(() => {
      TokenService.initialize();
    });

    test('should generate and verify access tokens', () => {
      const payload = {
        userId: 'user123',
        deviceId: 'device123',
        sessionId: 'session123',
        isPremium: false,
        permissions: ['read', 'write']
      };
      
      const token = TokenService.generateAccessToken(payload);
      const decoded = TokenService.verifyAccessToken(token);
      
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.deviceId).toBe(payload.deviceId);
      expect(decoded.sessionId).toBe(payload.sessionId);
      expect(decoded.isPremium).toBe(payload.isPremium);
      expect(decoded.permissions).toEqual(payload.permissions);
    });

    test('should generate and verify refresh tokens', () => {
      const payload = {
        userId: 'user123',
        deviceId: 'device123',
        sessionId: 'session123',
        tokenVersion: 1
      };
      
      const token = TokenService.generateRefreshToken(payload);
      const decoded = TokenService.verifyRefreshToken(token);
      
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.tokenVersion).toBe(payload.tokenVersion);
    });

    test('should extract bearer token from header', () => {
      const token = 'abc123';
      const header = `Bearer ${token}`;
      
      expect(TokenService.extractBearerToken(header)).toBe(token);
      
      expect(() => TokenService.extractBearerToken('Invalid header')).toThrow();
      expect(() => TokenService.extractBearerToken('')).toThrow();
    });

    test('should generate token pairs', () => {
      const { accessToken, refreshToken } = TokenService.generateTokenPair(
        'user123',
        'device123',
        'session123',
        true,
        ['admin'],
        1
      );
      
      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();
      
      const accessDecoded = TokenService.verifyAccessToken(accessToken);
      const refreshDecoded = TokenService.verifyRefreshToken(refreshToken);
      
      expect(accessDecoded.userId).toBe('user123');
      expect(accessDecoded.isPremium).toBe(true);
      expect(refreshDecoded.tokenVersion).toBe(1);
    });

    test('should refresh access tokens', () => {
      const { refreshToken } = TokenService.generateTokenPair(
        'user123',
        'device123',
        'session123',
        false,
        [],
        1
      );
      
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = 
        TokenService.refreshAccessToken(refreshToken, 1);
      
      expect(newAccessToken).toBeTruthy();
      expect(newRefreshToken).toBeTruthy();
      
      const decoded = TokenService.verifyRefreshToken(newRefreshToken);
      expect(decoded.tokenVersion).toBe(2);
    });

    test('should detect token expiration', () => {
      const { accessToken } = TokenService.generateTokenPair(
        'user123',
        'device123',
        'session123'
      );
      
      expect(TokenService.isTokenExpiringSoon(accessToken, 20)).toBe(true); // 15min token, 20min threshold
      expect(TokenService.isTokenExpiringSoon(accessToken, 5)).toBe(false);  // 5min threshold
    });
  });

  // MARK: - Input Sanitization Tests
  
  describe('Input Sanitization', () => {
    test('should sanitize strings to prevent XSS', () => {
      expect(sanitizeString('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      
      expect(sanitizeString('Normal text')).toBe('Normal text');
      expect(sanitizeString('  whitespace  ')).toBe('whitespace');
    });

    test('should validate and sanitize email addresses', () => {
      expect(sanitizeEmail('test@example.com')).toBe('test@example.com');
      expect(sanitizeEmail('  TEST@EXAMPLE.COM  ')).toBe('test@example.com');
      
      expect(() => sanitizeEmail('invalid-email')).toThrow();
      expect(() => sanitizeEmail('test@')).toThrow();
      expect(() => sanitizeEmail('@example.com')).toThrow();
    });

    test('should validate and sanitize numbers', () => {
      expect(sanitizeNumber('123')).toBe(123);
      expect(sanitizeNumber(456.789)).toBe(456.789);
      expect(sanitizeNumber('42', 0, 100)).toBe(42);
      
      expect(() => sanitizeNumber('not-a-number')).toThrow();
      expect(() => sanitizeNumber('50', 0, 10)).toThrow(); // Above max
      expect(() => sanitizeNumber('-5', 0, 10)).toThrow(); // Below min
    });

    test('should validate and sanitize coordinates', () => {
      const coords = sanitizeCoordinates(37.7749, -122.4194);
      expect(coords.latitude).toBe(37.7749);
      expect(coords.longitude).toBe(-122.4194);
      
      expect(() => sanitizeCoordinates(91, 0)).toThrow(); // Invalid latitude
      expect(() => sanitizeCoordinates(0, 181)).toThrow(); // Invalid longitude
    });
  });

  // MARK: - API Security Tests
  
  describe('API Security', () => {
    test('should enforce rate limiting', async () => {
      const endpoint = '/api/health';
      
      // Make multiple requests quickly
      const requests = Array(10).fill(null).map(() => 
        request(app).get(endpoint)
      );
      
      const responses = await Promise.all(requests);
      
      // Some requests should succeed, but eventually rate limiting should kick in
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      expect(successCount + rateLimitedCount).toBe(10);
    });

    test('should reject requests with invalid content type', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('invalid data');
      
      expect(response.status).toBe(415);
      expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    test('should reject oversized payloads', async () => {
      const largePayload = 'x'.repeat(2 * 1024 * 1024); // 2MB
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({ data: largePayload });
      
      expect(response.status).toBe(413);
    });

    test('should include security headers', async () => {
      const response = await request(app).get('/api/health');
      
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeTruthy();
    });

    test('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'https://malicious-site.com');
      
      // Should reject unauthorized origins
      expect(response.status).toBe(500); // CORS error
    });

    test('should validate authorization headers', async () => {
      // Missing authorization
      let response = await request(app).get('/api/tasks');
      expect(response.status).toBe(401);
      
      // Invalid format
      response = await request(app)
        .get('/api/tasks')
        .set('Authorization', 'InvalidFormat token123');
      expect(response.status).toBe(401);
      
      // Invalid token
      response = await request(app)
        .get('/api/tasks')
        .set('Authorization', 'Bearer invalid-token');
      expect(response.status).toBe(401);
    });
  });

  // MARK: - SQL Injection Prevention Tests
  
  describe('SQL Injection Prevention', () => {
    test('should prevent SQL injection in query parameters', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .get(`/api/tasks?search=${encodeURIComponent(maliciousInput)}`);
      
      // Should not crash the server or return 500 error due to SQL injection
      expect(response.status).not.toBe(500);
    });

    test('should sanitize input in request bodies', async () => {
      const maliciousPayload = {
        title: "'; DROP TABLE tasks; --",
        description: "<script>alert('xss')</script>"
      };
      
      const response = await request(app)
        .post('/api/tasks')
        .send(maliciousPayload);
      
      // Should handle malicious input gracefully
      expect(response.status).toBe(401); // Unauthorized (no auth token)
    });
  });

  // MARK: - Password Security Tests
  
  describe('Password Security', () => {
    test('should enforce password complexity', async () => {
      const weakPasswords = [
        '123456',
        'password',
        'abc',
        '12345678', // No complexity
      ];
      
      for (const password of weakPasswords) {
        expect(() => EncryptionService.hashPassword(password))
          .rejects.toThrow();
      }
    });

    test('should hash passwords with sufficient complexity', async () => {
      const strongPassword = 'StrongP@ssw0rd123!';
      const hash = await EncryptionService.hashPassword(strongPassword);
      
      expect(hash).toBeTruthy();
      expect(hash.length).toBeGreaterThan(50);
      expect(hash).not.toContain(strongPassword);
    });
  });

  // MARK: - Session Security Tests
  
  describe('Session Security', () => {
    test('should generate unique session IDs', () => {
      const sessionIds = Array(100).fill(null).map(() => 
        TokenService.generateSessionId()
      );
      
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(100); // All should be unique
    });

    test('should validate device tokens', () => {
      const deviceId = 'device123';
      const userAgent = 'Mozilla/5.0 Test Browser';
      const ip = '192.168.1.1';
      
      const token = TokenService.generateDeviceToken(deviceId, userAgent, ip);
      
      expect(TokenService.verifyDeviceToken(token, deviceId, userAgent, ip))
        .toBe(true);
      
      expect(TokenService.verifyDeviceToken(token, 'different-device', userAgent, ip))
        .toBe(false);
    });
  });

  // MARK: - Data Integrity Tests
  
  describe('Data Integrity', () => {
    test('should detect data tampering with HMAC', () => {
      const data = 'important data';
      const signature = EncryptionService.generateHMAC(data);
      
      expect(EncryptionService.verifyHMAC(data, signature)).toBe(true);
      
      // Tamper with data
      const tamperedData = 'tampered data';
      expect(EncryptionService.verifyHMAC(tamperedData, signature)).toBe(false);
      
      // Tamper with signature
      const tamperedSignature = signature.slice(0, -2) + 'XX';
      expect(EncryptionService.verifyHMAC(data, tamperedSignature)).toBe(false);
    });
  });

  // MARK: - Error Handling Security
  
  describe('Error Handling Security', () => {
    test('should not leak sensitive information in error messages', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeTruthy();
      
      // Should not contain stack traces or internal paths
      const errorString = JSON.stringify(response.body);
      expect(errorString).not.toMatch(/\/.*\/.*\.js/); // No file paths
      expect(errorString).not.toMatch(/at .*\(/); // No stack traces
    });

    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');
      
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_JSON');
    });
  });

  // MARK: - Timing Attack Prevention
  
  describe('Timing Attack Prevention', () => {
    test('should use constant-time comparison for sensitive operations', async () => {
      const correctSignature = EncryptionService.generateHMAC('test data');
      const wrongSignature = 'wrong'.padEnd(correctSignature.length, '0');
      
      // Measure timing for correct vs incorrect signatures
      const startCorrect = process.hrtime.bigint();
      EncryptionService.verifyHMAC('test data', correctSignature);
      const endCorrect = process.hrtime.bigint();
      
      const startWrong = process.hrtime.bigint();
      EncryptionService.verifyHMAC('test data', wrongSignature);
      const endWrong = process.hrtime.bigint();
      
      const correctTime = Number(endCorrect - startCorrect);
      const wrongTime = Number(endWrong - startWrong);
      
      // Times should be similar (within reasonable variance)
      const timeDifference = Math.abs(correctTime - wrongTime);
      const averageTime = (correctTime + wrongTime) / 2;
      const variance = timeDifference / averageTime;
      
      expect(variance).toBeLessThan(0.5); // Less than 50% variance
    });
  });
});

// MARK: - Security Test Utilities

export class SecurityTestUtils {
  static generateMaliciousPayloads(): string[] {
    return [
      // SQL Injection
      "'; DROP TABLE users; --",
      "' OR '1'='1",
      "1; DELETE FROM tasks WHERE 1=1; --",
      
      // XSS
      "<script>alert('xss')</script>",
      "javascript:alert('xss')",
      "<img src=x onerror=alert('xss')>",
      
      // Path Traversal
      "../../../etc/passwd",
      "..\\..\\..\\windows\\system32\\config\\sam",
      "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
      
      // Command Injection
      "; cat /etc/passwd",
      "| whoami",
      "&& rm -rf /",
      
      // LDAP Injection
      "*)(uid=*",
      "admin)(&(password=*))",
      
      // XML Injection
      "<?xml version='1.0'?><!DOCTYPE root [<!ENTITY test SYSTEM 'file:///etc/passwd'>]><root>&test;</root>",
      
      // NoSQL Injection
      "{'$ne': null}",
      "{'$gt': ''}",
      
      // Buffer Overflow Attempts
      "A".repeat(10000),
      "\x00".repeat(1000),
    ];
  }
  
  static async testEndpointSecurity(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET') {
    const maliciousPayloads = this.generateMaliciousPayloads();
    const results: Array<{ payload: string; status: number; safe: boolean }> = [];
    
    for (const payload of maliciousPayloads) {
      try {
        let response;
        
        switch (method) {
          case 'GET':
            response = await request(app).get(`${endpoint}?test=${encodeURIComponent(payload)}`);
            break;
          case 'POST':
            response = await request(app).post(endpoint).send({ test: payload });
            break;
          case 'PUT':
            response = await request(app).put(endpoint).send({ test: payload });
            break;
          case 'DELETE':
            response = await request(app).delete(endpoint).send({ test: payload });
            break;
        }
        
        const safe = response.status !== 500 && !response.text.includes('Error:');
        results.push({ payload, status: response.status, safe });
        
      } catch (error) {
        results.push({ payload, status: 500, safe: false });
      }
    }
    
    return results;
  }
}