import { Pool } from 'pg';
import { logger } from '../utils/logger';

interface VoiceProfile {
  id: string;
  userId: string;
  name: string;
  language: string;
  voiceSignature: string;
  preferences: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface VoiceCommand {
  id: string;
  profileId: string;
  command: string;
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  executedAt: Date;
  success: boolean;
}

export class VoiceProfileService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'voice_assistant',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres'
    });
  }

  async createProfile(userId: string, name: string, language: string = 'en-US'): Promise<VoiceProfile> {
    const query = `
      INSERT INTO voice_profiles (user_id, name, language, preferences)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const defaultPreferences = {
      wakeWord: 'hey home',
      confirmationEnabled: true,
      feedbackVoice: 'female',
      volume: 80,
      speed: 1.0
    };

    try {
      const result = await this.pool.query(query, [userId, name, language, JSON.stringify(defaultPreferences)]);
      logger.info(`Created voice profile for user ${userId}`);
      return this.mapToProfile(result.rows[0]);
    } catch (error) {
      logger.error('Error creating voice profile:', error);
      throw error;
    }
  }

  async getProfile(profileId: string): Promise<VoiceProfile | null> {
    const query = 'SELECT * FROM voice_profiles WHERE id = $1';
    
    try {
      const result = await this.pool.query(query, [profileId]);
      return result.rows.length > 0 ? this.mapToProfile(result.rows[0]) : null;
    } catch (error) {
      logger.error('Error fetching voice profile:', error);
      throw error;
    }
  }

  async getProfilesByUser(userId: string): Promise<VoiceProfile[]> {
    const query = 'SELECT * FROM voice_profiles WHERE user_id = $1 ORDER BY created_at DESC';
    
    try {
      const result = await this.pool.query(query, [userId]);
      return result.rows.map(row => this.mapToProfile(row));
    } catch (error) {
      logger.error('Error fetching user voice profiles:', error);
      throw error;
    }
  }

  async updateProfile(profileId: string, updates: Partial<VoiceProfile>): Promise<VoiceProfile> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }

    if (updates.language) {
      fields.push(`language = $${paramCount++}`);
      values.push(updates.language);
    }

    if (updates.preferences) {
      fields.push(`preferences = $${paramCount++}`);
      values.push(JSON.stringify(updates.preferences));
    }

    if (updates.voiceSignature) {
      fields.push(`voice_signature = $${paramCount++}`);
      values.push(updates.voiceSignature);
    }

    fields.push(`updated_at = NOW()`);
    values.push(profileId);

    const query = `
      UPDATE voice_profiles
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, values);
      logger.info(`Updated voice profile ${profileId}`);
      return this.mapToProfile(result.rows[0]);
    } catch (error) {
      logger.error('Error updating voice profile:', error);
      throw error;
    }
  }

  async deleteProfile(profileId: string): Promise<void> {
    const query = 'DELETE FROM voice_profiles WHERE id = $1';
    
    try {
      await this.pool.query(query, [profileId]);
      logger.info(`Deleted voice profile ${profileId}`);
    } catch (error) {
      logger.error('Error deleting voice profile:', error);
      throw error;
    }
  }

  async logCommand(command: Omit<VoiceCommand, 'id' | 'executedAt'>): Promise<void> {
    const query = `
      INSERT INTO voice_commands (profile_id, command, intent, entities, confidence, success)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    try {
      await this.pool.query(query, [
        command.profileId,
        command.command,
        command.intent,
        JSON.stringify(command.entities),
        command.confidence,
        command.success
      ]);
    } catch (error) {
      logger.error('Error logging voice command:', error);
    }
  }

  async getCommandHistory(profileId: string, limit: number = 50): Promise<VoiceCommand[]> {
    const query = `
      SELECT * FROM voice_commands
      WHERE profile_id = $1
      ORDER BY executed_at DESC
      LIMIT $2
    `;

    try {
      const result = await this.pool.query(query, [profileId, limit]);
      return result.rows.map(row => this.mapToCommand(row));
    } catch (error) {
      logger.error('Error fetching command history:', error);
      throw error;
    }
  }

  async getCommandStats(profileId: string, days: number = 30): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_commands,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_commands,
        COUNT(CASE WHEN success = false THEN 1 END) as failed_commands,
        AVG(confidence) as avg_confidence,
        intent,
        COUNT(*) as intent_count
      FROM voice_commands
      WHERE profile_id = $1
        AND executed_at >= NOW() - INTERVAL '${days} days'
      GROUP BY intent
      ORDER BY intent_count DESC
    `;

    try {
      const result = await this.pool.query(query, [profileId]);
      return {
        totalCommands: parseInt(result.rows[0]?.total_commands || '0'),
        successfulCommands: parseInt(result.rows[0]?.successful_commands || '0'),
        failedCommands: parseInt(result.rows[0]?.failed_commands || '0'),
        avgConfidence: parseFloat(result.rows[0]?.avg_confidence || '0'),
        intentBreakdown: result.rows.map(row => ({
          intent: row.intent,
          count: parseInt(row.intent_count)
        }))
      };
    } catch (error) {
      logger.error('Error fetching command stats:', error);
      throw error;
    }
  }

  private mapToProfile(row: any): VoiceProfile {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      language: row.language,
      voiceSignature: row.voice_signature,
      preferences: typeof row.preferences === 'string' ? JSON.parse(row.preferences) : row.preferences,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapToCommand(row: any): VoiceCommand {
    return {
      id: row.id,
      profileId: row.profile_id,
      command: row.command,
      intent: row.intent,
      entities: typeof row.entities === 'string' ? JSON.parse(row.entities) : row.entities,
      confidence: parseFloat(row.confidence),
      executedAt: row.executed_at,
      success: row.success
    };
  }
}

export const voiceProfileService = new VoiceProfileService();
