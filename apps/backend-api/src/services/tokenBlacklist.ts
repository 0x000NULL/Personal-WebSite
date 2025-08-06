import { getRedis } from '../config/database';
import { createError } from '../middleware/errorHandler';

export class TokenBlacklistService {
  private static instance: TokenBlacklistService;
  private redis: any;
  private readonly prefix = 'blacklist:';

  private constructor() {
    this.redis = getRedis();
  }

  static getInstance(): TokenBlacklistService {
    if (!TokenBlacklistService.instance) {
      TokenBlacklistService.instance = new TokenBlacklistService();
    }
    return TokenBlacklistService.instance;
  }

  /**
   * Add a token to the blacklist
   * @param token The JWT token to blacklist
   * @param expiresIn Expiration time in seconds (should match token expiry)
   */
  async blacklistToken(token: string, expiresIn: number): Promise<void> {
    if (!this.redis) {
      console.warn('Redis not available for token blacklist. Token will not be blacklisted.');
      return;
    }

    try {
      const key = `${this.prefix}${token}`;
      await this.redis.setex(key, expiresIn, 'blacklisted');
    } catch (error) {
      console.error('Failed to blacklist token:', error);
      throw createError('Failed to invalidate token', 500);
    }
  }

  /**
   * Check if a token is blacklisted
   * @param token The JWT token to check
   * @returns true if blacklisted, false otherwise
   */
  async isBlacklisted(token: string): Promise<boolean> {
    if (!this.redis) {
      // If Redis is not available, we can't check blacklist
      return false;
    }

    try {
      const key = `${this.prefix}${token}`;
      const result = await this.redis.get(key);
      return result !== null;
    } catch (error) {
      console.error('Failed to check token blacklist:', error);
      // In case of error, we'll allow the token (fail open)
      return false;
    }
  }

  /**
   * Blacklist all tokens for a specific user
   * @param userId The user ID whose tokens should be blacklisted
   * @param tokens Array of tokens to blacklist
   * @param expiresIn Expiration time in seconds
   */
  async blacklistUserTokens(userId: string, tokens: string[], expiresIn: number): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      const pipeline = this.redis.pipeline();
      
      // Blacklist each token
      for (const token of tokens) {
        const key = `${this.prefix}${token}`;
        pipeline.setex(key, expiresIn, 'blacklisted');
      }

      // Also store a user-level blacklist flag
      const userKey = `${this.prefix}user:${userId}`;
      pipeline.setex(userKey, expiresIn, Date.now().toString());

      await pipeline.exec();
    } catch (error) {
      console.error('Failed to blacklist user tokens:', error);
      throw createError('Failed to invalidate user tokens', 500);
    }
  }

  /**
   * Check if a user's tokens issued before a certain time should be considered invalid
   * @param userId The user ID to check
   * @param tokenIssuedAt Token issued at timestamp (in seconds)
   * @returns true if the token should be considered invalid
   */
  async isUserTokenInvalid(userId: string, tokenIssuedAt: number): Promise<boolean> {
    if (!this.redis) {
      return false;
    }

    try {
      const userKey = `${this.prefix}user:${userId}`;
      const blacklistTime = await this.redis.get(userKey);
      
      if (!blacklistTime) {
        return false;
      }

      // Convert to seconds for comparison with JWT iat
      const blacklistTimestamp = parseInt(blacklistTime) / 1000;
      return tokenIssuedAt < blacklistTimestamp;
    } catch (error) {
      console.error('Failed to check user token validity:', error);
      return false;
    }
  }

  /**
   * Clear all blacklisted tokens (use with caution)
   */
  async clearBlacklist(): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      const keys = await this.redis.keys(`${this.prefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Failed to clear blacklist:', error);
      throw createError('Failed to clear token blacklist', 500);
    }
  }

  /**
   * Get blacklist statistics
   */
  async getStats(): Promise<{ totalBlacklisted: number; users: number }> {
    if (!this.redis) {
      return { totalBlacklisted: 0, users: 0 };
    }

    try {
      const tokenKeys = await this.redis.keys(`${this.prefix}[^u]*`);
      const userKeys = await this.redis.keys(`${this.prefix}user:*`);
      
      return {
        totalBlacklisted: tokenKeys.length,
        users: userKeys.length
      };
    } catch (error) {
      console.error('Failed to get blacklist stats:', error);
      return { totalBlacklisted: 0, users: 0 };
    }
  }
}

export const tokenBlacklist = TokenBlacklistService.getInstance();