import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { ValidationError } from '../models/validation';

// MARK: - Encryption Configuration

interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  saltLength: number;
  iterations: number;
}

const ENCRYPTION_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32, // 256 bits
  ivLength: 16,  // 128 bits
  tagLength: 16, // 128 bits
  saltLength: 32, // 256 bits
  iterations: 100000 // PBKDF2 iterations
};

// MARK: - Encryption Service

export class EncryptionService {
  private static masterKey: Buffer | null = null;

  /**
   * Initialize encryption service with master key
   */
  static initialize(masterKeyHex?: string): void {
    if (masterKeyHex) {
      this.masterKey = Buffer.from(masterKeyHex, 'hex');
      if (this.masterKey.length !== ENCRYPTION_CONFIG.keyLength) {
        throw new Error('Master key must be 256 bits (64 hex characters)');
      }
    } else {
      // Generate a new master key (should be stored securely in production)
      this.masterKey = crypto.randomBytes(ENCRYPTION_CONFIG.keyLength);
      console.warn('⚠️  Generated new master key. Store securely:', this.masterKey.toString('hex'));
    }
  }

  /**
   * Get or generate master key
   */
  private static getMasterKey(): Buffer {
    if (!this.masterKey) {
      const keyFromEnv = process.env.ENCRYPTION_MASTER_KEY;
      if (keyFromEnv) {
        this.initialize(keyFromEnv);
      } else {
        this.initialize(); // Generate new key
      }
    }
    return this.masterKey!;
  }

  /**
   * Derive encryption key from master key and salt using PBKDF2
   */
  private static deriveKey(salt: Buffer): Buffer {
    const masterKey = this.getMasterKey();
    return crypto.pbkdf2Sync(
      masterKey,
      salt,
      ENCRYPTION_CONFIG.iterations,
      ENCRYPTION_CONFIG.keyLength,
      'sha256'
    );
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   */
  static encrypt(plaintext: string): string {
    try {
      if (!plaintext || typeof plaintext !== 'string') {
        throw new ValidationError('Plaintext must be a non-empty string', []);
      }

      // Generate random salt and IV
      const salt = crypto.randomBytes(ENCRYPTION_CONFIG.saltLength);
      const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
      
      // Derive encryption key
      const key = this.deriveKey(salt);
      
      // Create cipher (AES-256-GCM) with IV and AAD
      const cipher = crypto.createCipheriv(
        ENCRYPTION_CONFIG.algorithm,
        key,
        iv
      );
      (cipher as any).setAAD(salt); // Use salt as additional authenticated data
      
      // Encrypt data
      const encryptedBuf = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      
      // Get authentication tag
      const tag = (cipher as any).getAuthTag();
      
      // Combine salt + iv + tag + encrypted data
      const combined = Buffer.concat([
        salt,
        iv,
        tag,
        encryptedBuf
      ]);
      
      return combined.toString('base64');
      
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data using AES-256-GCM
   */
  static decrypt(encryptedData: string): string {
    try {
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new ValidationError('Encrypted data must be a non-empty string', []);
      }

      // Parse combined data
      const combined = Buffer.from(encryptedData, 'base64');
      
      if (combined.length < ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.tagLength) {
        throw new Error('Invalid encrypted data format');
      }
      
      const salt = combined.subarray(0, ENCRYPTION_CONFIG.saltLength);
      const iv = combined.subarray(ENCRYPTION_CONFIG.saltLength, ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength);
      const tag = combined.subarray(
        ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength,
        ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.tagLength
      );
      const encrypted = combined.subarray(ENCRYPTION_CONFIG.saltLength + ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.tagLength);
      
      // Derive decryption key
      const key = this.deriveKey(salt);
      
      // Create decipher (AES-256-GCM) and set AAD + auth tag
      const decipher = crypto.createDecipheriv(
        ENCRYPTION_CONFIG.algorithm,
        key,
        iv
      );
      (decipher as any).setAAD(salt);
      (decipher as any).setAuthTag(tag);
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]).toString('utf8');
      
      return decrypted;
      
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    if (!password || typeof password !== 'string') {
      throw new ValidationError('Password must be a non-empty string', []);
    }

    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long', []);
    }

    if (password.length > 128) {
      throw new ValidationError('Password must be less than 128 characters', []);
    }

    const saltRounds = 12; // Recommended for 2024
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!password || !hash) {
      return false;
    }

    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Generate cryptographically secure random token
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate secure API key
   */
  static generateApiKey(): string {
    const prefix = 'nm_'; // Near Me prefix
    const randomPart = crypto.randomBytes(24).toString('base64url');
    return prefix + randomPart;
  }

  /**
   * Hash sensitive data for comparison (one-way)
   */
  static hashData(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate HMAC signature for data integrity
   */
  static generateHMAC(data: string, secret?: string): string {
    const hmacSecret = secret || this.getMasterKey().toString('hex');
    return crypto.createHmac('sha256', hmacSecret).update(data).digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  static verifyHMAC(data: string, signature: string, secret?: string): boolean {
    try {
      const expectedSignature = this.generateHMAC(data, secret);
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Encrypt object data (converts to JSON first)
   */
  static encryptObject(obj: any): string {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString);
  }

  /**
   * Decrypt object data (parses JSON after decryption)
   */
  static decryptObject<T = any>(encryptedData: string): T {
    const jsonString = this.decrypt(encryptedData);
    return JSON.parse(jsonString);
  }

  /**
   * Secure data wiping (overwrite memory)
   */
  static secureWipe(buffer: Buffer): void {
    if (buffer && Buffer.isBuffer(buffer)) {
      crypto.randomFillSync(buffer);
      buffer.fill(0);
    }
  }

  /**
   * Generate device fingerprint for additional security
   */
  static generateDeviceFingerprint(userAgent: string, ip: string): string {
    const data = `${userAgent}:${ip}:${Date.now()}`;
    return this.hashData(data);
  }

  /**
   * Encrypt data with expiration timestamp
   */
  static encryptWithExpiration(plaintext: string, expirationMs: number): string {
    const expirationTime = Date.now() + expirationMs;
    const dataWithExpiration = JSON.stringify({
      data: plaintext,
      expires: expirationTime
    });
    return this.encrypt(dataWithExpiration);
  }

  /**
   * Decrypt data and check expiration
   */
  static decryptWithExpiration(encryptedData: string): string | null {
    try {
      const decryptedJson = this.decrypt(encryptedData);
      const parsed = JSON.parse(decryptedJson);
      
      if (Date.now() > parsed.expires) {
        return null; // Expired
      }
      
      return parsed.data;
    } catch (error) {
      return null;
    }
  }
}

// MARK: - Key Rotation Service

export class KeyRotationService {
  private static rotationInterval: NodeJS.Timeout | null = null;

  /**
   * Start automatic key rotation
   */
  static startRotation(intervalHours: number = 24 * 7): void { // Weekly by default
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    this.rotationInterval = setInterval(() => {
      this.rotateKeys();
    }, intervalMs);

    console.log(`🔄 Key rotation scheduled every ${intervalHours} hours`);
  }

  /**
   * Stop automatic key rotation
   */
  static stopRotation(): void {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
    }
  }

  /**
   * Perform key rotation
   */
  private static rotateKeys(): void {
    try {
      console.log('🔄 Starting key rotation...');
      
      // Generate new master key
      const newMasterKey = crypto.randomBytes(ENCRYPTION_CONFIG.keyLength);
      
      // Store old key for decryption of existing data
      const oldMasterKey = EncryptionService['masterKey'];
      
      // Update master key
      EncryptionService['masterKey'] = newMasterKey;
      
      console.log('✅ Key rotation completed');
      console.log('⚠️  New master key:', newMasterKey.toString('hex'));
      console.log('⚠️  Update ENCRYPTION_MASTER_KEY environment variable');
      
      // In production, you would:
      // 1. Store the new key in your key management system
      // 2. Re-encrypt critical data with the new key
      // 3. Update environment variables
      // 4. Notify administrators
      
    } catch (error) {
      console.error('❌ Key rotation failed:', error);
    }
  }

  /**
   * Manual key rotation trigger
   */
  static async manualRotation(): Promise<string> {
    this.rotateKeys();
    return EncryptionService['masterKey']?.toString('hex') || '';
  }
}

// Initialize encryption service on module load
if (process.env.NODE_ENV !== 'test') {
  EncryptionService.initialize(process.env.ENCRYPTION_MASTER_KEY);
  
  // Start key rotation in production
  if (process.env.NODE_ENV === 'production') {
    KeyRotationService.startRotation(24 * 7); // Weekly rotation
  }
}