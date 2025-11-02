import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../../../shared/middleware/validation';
import { authenticate } from '../middleware/authenticate';
import { rateLimitStrict } from '../middleware/rate-limit';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyMfaSchema,
} from '../validators/auth.validators';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/register', rateLimitStrict, validateRequest(registerSchema), authController.register);
router.post('/login', rateLimitStrict, validateRequest(loginSchema), authController.login);
router.post('/refresh', validateRequest(refreshTokenSchema), authController.refreshToken);
router.post('/forgot-password', rateLimitStrict, authController.forgotPassword);
router.post('/reset-password', validateRequest(resetPasswordSchema), authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', rateLimitStrict, authController.resendVerification);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, validateRequest(changePasswordSchema), authController.changePassword);
router.get('/me', authenticate, authController.getCurrentUser);
router.put('/me', authenticate, authController.updateProfile);
router.delete('/me', authenticate, authController.deleteAccount);

// MFA routes
router.post('/mfa/setup', authenticate, authController.setupMfa);
router.post('/mfa/verify', authenticate, validateRequest(verifyMfaSchema), authController.verifyMfa);
router.post('/mfa/disable', authenticate, authController.disableMfa);
router.post('/mfa/backup-codes', authenticate, authController.generateBackupCodes);

// Session management
router.get('/sessions', authenticate, authController.getSessions);
router.delete('/sessions/:sessionId', authenticate, authController.revokeSession);
router.delete('/sessions', authenticate, authController.revokeAllSessions);

// OAuth routes
router.get('/oauth/:provider', authController.oauthLogin);
router.get('/oauth/:provider/callback', authController.oauthCallback);

export default router;
