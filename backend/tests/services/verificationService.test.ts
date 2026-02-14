import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockContext, createMockChat, createMockUser } from '../setup';

describe('VerificationService - Unit Tests', () => {
  let verificationService: any;
  let mockContext: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { VerificationService } = await import('../../services/verificationService');
    verificationService = new VerificationService();
    mockContext = createMockContext();
  });

  describe('generateChallenge', () => {
    it('should generate numeric captcha challenge', () => {
      const config = { captcha_length: 4 };
      const result = verificationService.generateChallenge('captcha', config);
      
      expect(result).toHaveProperty('type', 'captcha');
      expect(result).toHaveProperty('captchaCode');
      expect(result.captchaCode.length).toBe(4);
      expect(/^\d+$/.test(result.captchaCode)).toBe(true);
    });

    it('should generate alphanumeric captcha challenge', () => {
      const config = { captcha_length: 6, case_sensitive: true };
      const result = verificationService.generateChallenge('captcha', config);
      
      expect(result).toHaveProperty('type', 'captcha');
      expect(result.captchaCode.length).toBe(6);
    });

    it('should generate GIF captcha challenge', () => {
      const config = { captcha_type: 'gif' };
      const result = verificationService.generateChallenge('gif', config);
      
      expect(result).toHaveProperty('type', 'gif');
      expect(result).toHaveProperty('gifUrl');
    });
  });

  describe('validateCaptcha', () => {
    it('should validate correct captcha', () => {
      const isValid = verificationService.validateCaptcha('1234', '1234');
      expect(isValid).toBe(true);
    });

    it('should reject incorrect captcha', () => {
      const isValid = verificationService.validateCaptcha('1234', '5678');
      expect(isValid).toBe(false);
    });

    it('should be case-insensitive by default', () => {
      const isValid = verificationService.validateCaptcha('AbCd', 'abcd');
      expect(isValid).toBe(true);
    });
  });

  describe('generateMathChallenge', () => {
    it('should generate math challenge with answer', () => {
      const result = verificationService.generateMathChallenge();
      
      expect(result).toHaveProperty('type', 'math');
      expect(result).toHaveProperty('question');
      expect(result).toHaveProperty('answer');
      expect(typeof result.answer).toBe('number');
    });

    it('should generate valid math expressions', () => {
      const result = verificationService.generateMathChallenge();
      const expression = result.question;
      
      expect(expression).toMatch(/^\d+ [\+\-\*] \d+ = \?$/);
    });
  });

  describe('validateMathAnswer', () => {
    it('should validate correct answer', () => {
      const result = verificationService.generateMathChallenge();
      const isValid = verificationService.validateMathAnswer(result.answer, result.answer);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect answer', () => {
      const result = verificationService.generateMathChallenge();
      const isValid = verificationService.validateMathAnswer(result.answer, result.answer + 1);
      expect(isValid).toBe(false);
    });
  });

  describe('checkChannelSubscription', () => {
    it('should return subscription status', async () => {
      const result = await verificationService.checkChannelSubscription(
        '123456789',
        '987654321',
        'channel_username'
      );
      
      expect(result).toHaveProperty('isSubscribed');
      expect(typeof result.isSubscribed).toBe('boolean');
    });

    it('should handle missing channel', async () => {
      const result = await verificationService.checkChannelSubscription(
        '123456789',
        '987654321',
        ''
      );
      
      expect(result.isSubscribed).toBe(true);
    });
  });

  describe('startVerification', () => {
    it('should start verification process', async () => {
      const result = await verificationService.startVerification(
        mockContext,
        'captcha'
      );
      
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('startedAt');
    });

    it('should generate different challenges', async () => {
      const result1 = await verificationService.startVerification(
        mockContext,
        'captcha'
      );
      const result2 = await verificationService.startVerification(
        mockContext,
        'captcha'
      );
      
      expect(result1.captchaCode).not.toBe(result2.captchaCode);
    });
  });

  describe('completeVerification', () => {
    it('should complete verification', async () => {
      const startResult = await verificationService.startVerification(
        mockContext,
        'captcha'
      );
      
      const completeResult = await verificationService.completeVerification(
        mockContext.from.id,
        mockContext.chat.id
      );
      
      expect(completeResult.success).toBe(true);
      expect(completeResult).toHaveProperty('completedAt');
    });
  });

  describe('getVerificationStatus', () => {
    it('should return verification status', async () => {
      const status = await verificationService.getVerificationStatus(
        '987654321',
        '123456789'
      );
      
      expect(status).toHaveProperty('isVerified');
      expect(status).toHaveProperty('verifiedAt');
    });

    it('should return pending status for unverified user', async () => {
      const status = await verificationService.getVerificationStatus(
        'new_user',
        '123456789'
      );
      
      expect(status.isVerified).toBe(false);
    });
  });

  describe('resetVerification', () => {
    it('should reset verification status', async () => {
      await verificationService.startVerification(mockContext, 'captcha');
      
      const result = await verificationService.resetVerification(
        mockContext.from.id,
        mockContext.chat.id
      );
      
      expect(result.success).toBe(true);
    });
  });

  describe('isChallengeExpired', () => {
    it('should return false for active challenge', async () => {
      await verificationService.startVerification(mockContext, 'captcha');
      
      const isExpired = await verificationService.isChallengeExpired(
        mockContext.from.id,
        mockContext.chat.id
      );
      
      expect(isExpired).toBe(false);
    });
  });

  describe('getPendingVerifications', () => {
    it('should return list of pending verifications', async () => {
      await verificationService.startVerification(mockContext, 'captcha');
      
      const pending = await verificationService.getPendingVerifications(
        mockContext.chat.id
      );
      
      expect(Array.isArray(pending)).toBe(true);
    });
  });

  describe('cleanupExpiredChallenges', () => {
    it('should clean up expired challenges', async () => {
      const result = await verificationService.cleanupExpiredChallenges();
      
      expect(result).toHaveProperty('cleanedCount');
    });
  });
});

describe('VerificationConfig - Validation', () => {
  it('should validate verification type', () => {
    const validTypes = ['captcha', 'math', 'gif', 'channel', 'private'];
    
    validTypes.forEach(type => {
      expect(verificationService?.isValidVerificationType?.(type)).toBe(true);
    });
  });

  it('should reject invalid verification type', () => {
    expect(verificationService?.isValidVerificationType?.('invalid')).toBe(false);
  });
});
