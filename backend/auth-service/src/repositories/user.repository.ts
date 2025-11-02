import { Pool, PoolClient } from 'pg';
import { User, UserPreferences } from '../../../shared/types';
import { AppError } from '../../../shared/utils/errors';
import { createLogger } from '../../../shared/utils/logger';
import { getPool } from '../config/database';

const logger = createLogger('UserRepository');

export class UserRepository {
  private pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  async findById(id: string): Promise<User | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Error finding user by ID', error as Error);
      throw new AppError('Failed to find user', 500, 'DATABASE_ERROR');
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL`,
        [email]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      logger.error('Error finding user by email', error as Error);
      throw new AppError('Failed to find user', 500, 'DATABASE_ERROR');
    }
  }

  async create(userData: Partial<User>): Promise<User> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO users (
          email, password_hash, first_name, last_name, role, 
          phone_number, mfa_enabled, email_verified, phone_verified,
          failed_login_attempts, preferences, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING *`,
        [
          userData.email,
          userData.passwordHash,
          userData.firstName,
          userData.lastName,
          userData.role || 'member',
          userData.phoneNumber || null,
          userData.mfaEnabled || false,
          userData.emailVerified || false,
          userData.phoneVerified || false,
          0,
          JSON.stringify(userData.preferences || this.getDefaultPreferences()),
        ]
      );

      await client.query('COMMIT');
      logger.info('User created successfully', { userId: result.rows[0].id });

      return this.mapRowToUser(result.rows[0]);
    } catch (error: any) {
      await client.query('ROLLBACK');
      
      if (error.code === '23505') { // Unique violation
        throw new AppError('Email already exists', 409, 'EMAIL_EXISTS');
      }

      logger.error('Error creating user', error);
      throw new AppError('Failed to create user', 500, 'DATABASE_ERROR');
    } finally {
      client.release();
    }
  }

  async update(id: string, updates: Partial<User>): Promise<User> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.firstName !== undefined) {
        fields.push(`first_name = $${paramCount++}`);
        values.push(updates.firstName);
      }
      if (updates.lastName !== undefined) {
        fields.push(`last_name = $${paramCount++}`);
        values.push(updates.lastName);
      }
      if (updates.phoneNumber !== undefined) {
        fields.push(`phone_number = $${paramCount++}`);
        values.push(updates.phoneNumber);
      }
      if (updates.avatar !== undefined) {
        fields.push(`avatar = $${paramCount++}`);
        values.push(updates.avatar);
      }
      if (updates.role !== undefined) {
        fields.push(`role = $${paramCount++}`);
        values.push(updates.role);
      }
      if (updates.mfaEnabled !== undefined) {
        fields.push(`mfa_enabled = $${paramCount++}`);
        values.push(updates.mfaEnabled);
      }
      if (updates.mfaSecret !== undefined) {
        fields.push(`mfa_secret = $${paramCount++}`);
        values.push(updates.mfaSecret);
      }
      if (updates.emailVerified !== undefined) {
        fields.push(`email_verified = $${paramCount++}`);
        values.push(updates.emailVerified);
      }
      if (updates.phoneVerified !== undefined) {
        fields.push(`phone_verified = $${paramCount++}`);
        values.push(updates.phoneVerified);
      }
      if (updates.preferences !== undefined) {
        fields.push(`preferences = $${paramCount++}`);
        values.push(JSON.stringify(updates.preferences));
      }
      if (updates.passwordHash !== undefined) {
        fields.push(`password_hash = $${paramCount++}`);
        values.push(updates.passwordHash);
      }
      if (updates.failedLoginAttempts !== undefined) {
        fields.push(`failed_login_attempts = $${paramCount++}`);
        values.push(updates.failedLoginAttempts);
      }
      if (updates.accountLockedUntil !== undefined) {
        fields.push(`account_locked_until = $${paramCount++}`);
        values.push(updates.accountLockedUntil);
      }

      if (fields.length === 0) {
        throw new AppError('No fields to update', 400, 'NO_UPDATES');
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const query = `
        UPDATE users 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount} AND deleted_at IS NULL
        RETURNING *
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      logger.info('User updated successfully', { userId: id });
      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating user', error as Error);
      throw new AppError('Failed to update user', 500, 'DATABASE_ERROR');
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await this.pool.query(
        `UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (result.rowCount === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      logger.info('User deleted successfully', { userId: id });
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error deleting user', error as Error);
      throw new AppError('Failed to delete user', 500, 'DATABASE_ERROR');
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE users SET last_login = NOW(), failed_login_attempts = 0 WHERE id = $1`,
        [id]
      );
    } catch (error) {
      logger.error('Error updating last login', error as Error);
    }
  }

  async incrementFailedLoginAttempts(id: string): Promise<number> {
    try {
      const result = await this.pool.query(
        `UPDATE users 
         SET failed_login_attempts = failed_login_attempts + 1,
             account_locked_until = CASE 
               WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '30 minutes'
               ELSE account_locked_until
             END
         WHERE id = $1
         RETURNING failed_login_attempts`,
        [id]
      );

      return result.rows[0]?.failed_login_attempts || 0;
    } catch (error) {
      logger.error('Error incrementing failed login attempts', error as Error);
      return 0;
    }
  }

  async addHomeToUser(userId: string, homeId: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE users 
         SET homes = array_append(homes, $2)
         WHERE id = $1 AND NOT ($2 = ANY(homes))`,
        [userId, homeId]
      );
    } catch (error) {
      logger.error('Error adding home to user', error as Error);
      throw new AppError('Failed to add home to user', 500, 'DATABASE_ERROR');
    }
  }

  async removeHomeFromUser(userId: string, homeId: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE users 
         SET homes = array_remove(homes, $2)
         WHERE id = $1`,
        [userId, homeId]
      );
    } catch (error) {
      logger.error('Error removing home from user', error as Error);
      throw new AppError('Failed to remove home from user', 500, 'DATABASE_ERROR');
    }
  }

  async findByHomeId(homeId: string): Promise<User[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM users WHERE $1 = ANY(homes) AND deleted_at IS NULL`,
        [homeId]
      );

      return result.rows.map(row => this.mapRowToUser(row));
    } catch (error) {
      logger.error('Error finding users by home ID', error as Error);
      throw new AppError('Failed to find users', 500, 'DATABASE_ERROR');
    }
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      mfaEnabled: row.mfa_enabled,
      mfaSecret: row.mfa_secret,
      phoneNumber: row.phone_number,
      avatar: row.avatar,
      homes: row.homes || [],
      preferences: typeof row.preferences === 'string' 
        ? JSON.parse(row.preferences) 
        : row.preferences,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLogin: row.last_login,
      failedLoginAttempts: row.failed_login_attempts,
      accountLockedUntil: row.account_locked_until,
      emailVerified: row.email_verified,
      phoneVerified: row.phone_verified,
    };
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      language: 'en',
      timezone: 'UTC',
      temperatureUnit: 'celsius',
      currency: 'USD',
      theme: 'auto',
      notifications: {
        enabledChannels: ['push'],
        criticalOnly: false,
        preferences: {},
      },
      privacy: {
        shareUsageData: false,
        shareEnergyData: false,
        allowRemoteAccess: true,
        localProcessingOnly: false,
      },
    };
  }
}
