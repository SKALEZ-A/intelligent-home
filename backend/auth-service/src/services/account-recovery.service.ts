import crypto from 'crypto';
import { EventEmitter } from 'events';

interface RecoveryRequest {
  id: string;
  userId: string;
  method: 'email' | 'sms' | 'security_questions' | 'backup_codes';
  token: string;
  expiresAt: number;
  attempts: number;
  status: 'pending' | 'verified' | 'expired' | 'failed';
  createdAt: number;
}

interface SecurityQuestion {
  question: string;
  answerHash: string;
}

export class AccountRecoveryService extends EventEmitter {
  private recoveryRequests: Map<string, RecoveryRequest> = new Map();
  private securityQuestions: Map<string, SecurityQuestion[]> = new Map();
  private backupCodes: Map<string, Set<string>> = new Map();
  private readonly maxAttempts = 3;
  private readonly tokenExpiry = 3600000; // 1 hour

  public async initiateRecovery(
    userId: string,
    method: RecoveryRequest['method']
  ): Promise<RecoveryRequest> {
    const token = this.generateRecoveryToken();
    const request: RecoveryRequest = {
      id: `rec_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
      userId,
      method,
      token,
      expiresAt: Date.now() + this.tokenExpiry,
      attempts: 0,
      status: 'pending',
      createdAt: Date.now()
    };

    this.recoveryRequests.set(request.id, request);
    this.emit('recoveryInitiated', request);

    return request;
  }

  public async verifyRecoveryToken(
    requestId: string,
    token: string
  ): Promise<boolean> {
    const request = this.recoveryRequests.get(requestId);

    if (!request) {
      throw new Error('Recovery request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Recovery request is not pending');
    }

    if (Date.now() > request.expiresAt) {
      request.status = 'expired';
      this.emit('recoveryExpired', request);
      return false;
    }

    request.attempts++;

    if (request.attempts > this.maxAttempts) {
      request.status = 'failed';
      this.emit('recoveryFailed', request);
      return false;
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(request.token)
    );

    if (isValid) {
      request.status = 'verified';
      this.emit('recoveryVerified', request);
    }

    return isValid;
  }

  public setSecurityQuestions(
    userId: string,
    questions: Array<{ question: string; answer: string }>
  ): void {
    const hashed = questions.map(q => ({
      question: q.question,
      answerHash: this.hashAnswer(q.answer)
    }));

    this.securityQuestions.set(userId, hashed);
  }

  public async verifySecurityAnswers(
    userId: string,
    answers: Array<{ question: string; answer: string }>
  ): Promise<boolean> {
    const questions = this.securityQuestions.get(userId);

    if (!questions || questions.length === 0) {
      return false;
    }

    let correctAnswers = 0;

    for (const answer of answers) {
      const question = questions.find(q => q.question === answer.question);
      if (question) {
        const answerHash = this.hashAnswer(answer.answer);
        if (answerHash === question.answerHash) {
          correctAnswers++;
        }
      }
    }

    return correctAnswers >= Math.ceil(questions.length * 0.7);
  }

  public generateBackupCodes(userId: string, count: number = 10): string[] {
    const codes: string[] = [];
    const codeSet = new Set<string>();

    for (let i = 0; i < count; i++) {
      const code = this.generateBackupCode();
      codes.push(code);
      codeSet.add(this.hashBackupCode(code));
    }

    this.backupCodes.set(userId, codeSet);
    this.emit('backupCodesGenerated', { userId, count });

    return codes;
  }

  public async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const codes = this.backupCodes.get(userId);

    if (!codes) {
      return false;
    }

    const hashedCode = this.hashBackupCode(code);
    const isValid = codes.has(hashedCode);

    if (isValid) {
      codes.delete(hashedCode);
      this.emit('backupCodeUsed', { userId, code });
    }

    return isValid;
  }

  private generateRecoveryToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateBackupCode(): string {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${code.slice(0, 4)}-${code.slice(4, 8)}`;
  }

  private hashAnswer(answer: string): string {
    return crypto
      .createHash('sha256')
      .update(answer.toLowerCase().trim())
      .digest('hex');
  }

  private hashBackupCode(code: string): string {
    return crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');
  }

  public getRemainingBackupCodes(userId: string): number {
    const codes = this.backupCodes.get(userId);
    return codes ? codes.size : 0;
  }

  public cleanupExpiredRequests(): void {
    const now = Date.now();
    
    for (const [id, request] of this.recoveryRequests.entries()) {
      if (request.expiresAt < now && request.status === 'pending') {
        request.status = 'expired';
        this.emit('recoveryExpired', request);
      }
    }
  }
}

export const accountRecoveryService = new AccountRecoveryService();
