import crypto from 'crypto';
import { RedisService } from './redis.service';
import { EmailService } from './email.service';
import { UserRepository } from '../repositories/user.repository';
import { logger } from '../../../shared/utils/logger';
import { BadRequestError, NotFoundError } from '../../../shared/utils/errors';
import bcrypt from 'bcryptjs';

export class PasswordResetService {
  private redisService: RedisService;
  private emailService: EmailService;
  private userRepository: UserRepository;
  private readonly RESET_TOKEN_PREFIX = 'password-reset:';
  private readonly RESET_TOKEN_TTL = 3600; // 1 hour

  constructor() {
    this.redisService = new RedisService();
    this.emailService = new EmailService();
    this.userRepository = new UserRepository();
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists
      logger.warn(`Password reset requested for non-existent email: ${email}`);
      return;
    }

    const resetToken = this.generateResetToken();
    const hashedToken = this.hashToken(resetToken);

    await this.redisService.set(
      `${this.RESET_TOKEN_PREFIX}${hashedToken}`,
      JSON.stringify({
        userId: user._id.toString(),
        email: user.email,
        createdAt: new Date().toISOString(),
      }),
      this.RESET_TOKEN_TTL
    );

    await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    logger.info(`Password reset token generated for user ${user._id}`);
  }

  async validateResetToken(token: string): Promise<{ userId: string; email: string }> {
    const hashedToken = this.hashToken(token);
    const data = await this.redisService.get(`${this.RESET_TOKEN_PREFIX}${hashedToken}`);

    if (!data) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    const tokenData = JSON.parse(data);
    return {
      userId: tokenData.userId,
      email: tokenData.email,
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { userId } = await this.validateResetToken(token);

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.userRepository.updatePassword(userId, hashedPassword);

    // Invalidate the reset token
    const hashedToken = this.hashToken(token);
    await this.redisService.delete(`${this.RESET_TOKEN_PREFIX}${hashedToken}`);

    // Send confirmation email
    await this.emailService.sendPasswordChangedEmail(user.email);

    logger.info(`Password reset completed for user ${userId}`);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new BadRequestError('Current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestError('New password must be different from current password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.userRepository.updatePassword(userId, hashedPassword);

    await this.emailService.sendPasswordChangedEmail(user.email);

    logger.info(`Password changed for user ${userId}`);
  }

  private generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async invalidateAllResetTokens(userId: string): Promise<void> {
    // This would require storing all tokens for a user, which we're not doing
    // for security reasons. Tokens expire automatically after 1 hour.
    logger.info(`Reset token invalidation requested for user ${userId}`);
  }
}
