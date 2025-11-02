import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { v4 as uuidv4 } from 'uuid';
import { User, Session } from '../../../../shared/types';
import { createLogger } from '../../../../shared/utils/logger';
import {
  AuthenticationError,
  ValidationError,
  ConflictError,
  NotFoundError,
} from '../../../../shared/utils/errors';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { EmailService } from './email.service';
import { RedisService } from './redis.service';

const logger = createLogger('AuthService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';
const REFRESH_TOKEN_EXPIRES_IN = '30d';
const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}

interface LoginData {
  email: string;
  password: string;
  mfaCode?: string;
  userAgent: string;
  ipAddress: string;
}

export class AuthService {
  private userRepository: UserRepository;
  private sessionRepository: SessionRepository;
  private emailService: EmailService;
  private redisService: RedisService;

  constructor() {
    this.userRepository = new UserRepository();
    this.sessionRepository = new SessionRepository();
    this.emailService = new EmailService();
    this.redisService = new RedisService();
  }

  async register(data: RegisterData): Promise<{ user: Partial<User>; token: string; refreshToken: string }> {
    const { email, password, firstName, lastName, phoneNumber } = data;

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await this.userRepository.create({
      id: uuidv4(),
      email,
      passwordHash,
      firstName,
      lastName,
      phoneNumber,
      role: 'owner',
      mfaEnabled: false,
      homes: [],
      preferences: {
        language: 'en',
        timezone: 'UTC',
        temperatureUnit: 'celsius',
        currency: 'USD',
        theme: 'auto',
        notifications: {
          enabledChannels: ['push', 'email'],
          criticalOnly: false,
          preferences: {},
        },
        privacy: {
          shareUsageData: false,
          shareEnergyData: false,
          allowRemoteAccess: true,
          localProcessingOnly: false,
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      failedLoginAttempts: 0,
      emailVerified: false,
      phoneVerified: false,
    });

    // Send verification email
    const verificationToken = await this.generateEmailVerificationToken(user.id);
    await this.emailService.sendVerificationEmail(email, verificationToken);

    // Generate tokens
    const token = this.generateAccessToken(user.id, user.role);
    const refreshToken = this.generateRefreshToken(user.id);

    // Create session
    await this.sessionRepository.create({
      userId: user.id,
      token,
      refreshToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      deviceInfo: 'Registration',
      ipAddress: 'unknown',
      userAgent: 'unknown',
      createdAt: new Date(),
    });

    logger.info(`User registered successfully: ${email}`);

    return {
      user: this.sanitizeUser(user),
      token,
      refreshToken,
    };
  }

  async login(data: LoginData): Promise<{ user: Partial<User>; token: string; refreshToken: string; requiresMFA?: boolean }> {
    const { email, password, mfaCode, userAgent, ipAddress } = data;

    // Find user
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const remainingTime = Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 60000);
      throw new AuthenticationError(`Account locked. Try again in ${remainingTime} minutes`);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.handleFailedLogin(user.id);
      throw new AuthenticationError('Invalid credentials');
    }

    // Check MFA
    if (user.mfaEnabled) {
      if (!mfaCode) {
        return {
          user: this.sanitizeUser(user),
          token: '',
          refreshToken: '',
          requiresMFA: true,
        };
      }

      const isMFAValid = this.verifyMFACode(user.mfaSecret!, mfaCode);
      if (!isMFAValid) {
        throw new AuthenticationError('Invalid MFA code');
      }
    }

    // Reset failed attempts
    await this.userRepository.update(user.id, {
      failedLoginAttempts: 0,
      accountLockedUntil: undefined,
      lastLogin: new Date(),
    });

    // Generate tokens
    const token = this.generateAccessToken(user.id, user.role);
    const refreshToken = this.generateRefreshToken(user.id);

    // Create session
    await this.sessionRepository.create({
      userId: user.id,
      token,
      refreshToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      deviceInfo: userAgent,
      ipAddress,
      userAgent,
      createdAt: new Date(),
    });

    logger.info(`User logged in successfully: ${email}`);

    return {
      user: this.sanitizeUser(user),
      token,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as { userId: string };
      
      const session = await this.sessionRepository.findByRefreshToken(refreshToken);
      if (!session) {
        throw new AuthenticationError('Invalid refresh token');
      }

      const user = await this.userRepository.findById(decoded.userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Generate new tokens
      const newToken = this.generateAccessToken(user.id, user.role);
      const newRefreshToken = this.generateRefreshToken(user.id);

      // Update session
      await this.sessionRepository.update(session.userId, session.token, {
        token: newToken,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      return {
        token: newToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new AuthenticationError('Invalid refresh token');
    }
  }

  async logout(userId: string, token: string): Promise<void> {
    await this.sessionRepository.delete(userId, token);
    await this.redisService.blacklistToken(token);
    logger.info(`User logged out: ${userId}`);
  }

  async getUserById(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return this.sanitizeUser(user);
  }

  async updateProfile(userId: string, updates: Partial<User>): Promise<Partial<User>> {
    // Remove sensitive fields
    delete updates.passwordHash;
    delete updates.mfaSecret;
    delete updates.role;

    const user = await this.userRepository.update(userId, updates);
    return this.sanitizeUser(user);
  }

  async enableMFA(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const secret = speakeasy.generateSecret({
      name: `HomeAutomation (${user.email})`,
      length: 32,
    });

    await this.userRepository.update(userId, {
      mfaSecret: secret.base32,
    });

    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url!,
    };
  }

  async disableMFA(userId: string, password: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid password');
    }

    await this.userRepository.update(userId, {
      mfaEnabled: false,
      mfaSecret: undefined,
    });

    logger.info(`MFA disabled for user: ${userId}`);
  }

  async verifyMFA(userId: string, code: string): Promise<{ verified: boolean }> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.mfaSecret) {
      throw new ValidationError('MFA not set up');
    }

    const isValid = this.verifyMFACode(user.mfaSecret, code);
    
    if (isValid && !user.mfaEnabled) {
      await this.userRepository.update(userId, { mfaEnabled: true });
    }

    return { verified: isValid };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      return;
    }

    const resetToken = await this.generatePasswordResetToken(user.id);
    await this.emailService.sendPasswordResetEmail(email, resetToken);
    
    logger.info(`Password reset requested for: ${email}`);
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const userId = await this.verifyPasswordResetToken(token);
    if (!userId) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userRepository.update(userId, { passwordHash });

    // Invalidate all sessions
    await this.sessionRepository.deleteAllForUser(userId);

    logger.info(`Password reset completed for user: ${userId}`);
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.verifyEmailVerificationToken(token);
    if (!userId) {
      throw new ValidationError('Invalid or expired verification token');
    }

    await this.userRepository.update(userId, { emailVerified: true });
    logger.info(`Email verified for user: ${userId}`);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid current password');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userRepository.update(userId, { passwordHash });

    logger.info(`Password changed for user: ${userId}`);
  }

  async getUserSessions(userId: string): Promise<Session[]> {
    return this.sessionRepository.findByUserId(userId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const sessions = await this.sessionRepository.findByUserId(userId);
    const session = sessions.find(s => s.token === sessionId);
    
    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    await this.sessionRepository.delete(userId, sessionId);
    await this.redisService.blacklistToken(sessionId);
  }

  private generateAccessToken(userId: string, role: string): string {
    return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
  }

  private verifyMFACode(secret: string, code: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });
  }

  private async handleFailedLogin(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) return;

    const failedAttempts = user.failedLoginAttempts + 1;
    const updates: Partial<User> = { failedLoginAttempts: failedAttempts };

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      updates.accountLockedUntil = new Date(Date.now() + LOCKOUT_DURATION);
      logger.warn(`Account locked due to failed login attempts: ${userId}`);
    }

    await this.userRepository.update(userId, updates);
  }

  private async generateEmailVerificationToken(userId: string): Promise<string> {
    const token = uuidv4();
    await this.redisService.setWithExpiry(`email_verify:${token}`, userId, 24 * 60 * 60);
    return token;
  }

  private async verifyEmailVerificationToken(token: string): Promise<string | null> {
    return this.redisService.get(`email_verify:${token}`);
  }

  private async generatePasswordResetToken(userId: string): Promise<string> {
    const token = uuidv4();
    await this.redisService.setWithExpiry(`password_reset:${token}`, userId, 60 * 60);
    return token;
  }

  private async verifyPasswordResetToken(token: string): Promise<string | null> {
    return this.redisService.get(`password_reset:${token}`);
  }

  private sanitizeUser(user: User): Partial<User> {
    const { passwordHash, mfaSecret, ...sanitized } = user;
    return sanitized;
  }
}
