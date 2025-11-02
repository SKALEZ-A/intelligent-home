import { pool } from '../config/database';
import { logger } from '../../../shared/utils/logger';
import { Notification } from '../models/notification.model';

export class NotificationRepository {
  async create(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const query = `
      INSERT INTO notifications (user_id, type, title, message, priority, channels, metadata, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      notification.userId,
      notification.type,
      notification.title,
      notification.message,
      notification.priority,
      JSON.stringify(notification.channels),
      JSON.stringify(notification.metadata || {}),
      notification.status || 'pending',
    ];

    try {
      const result = await pool.query(query, values);
      return this.mapRow(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create notification', { error });
      throw error;
    }
  }

  async findById(id: string): Promise<Notification | null> {
    const query = 'SELECT * FROM notifications WHERE id = $1';
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0] ? this.mapRow(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find notification', { error, id });
      throw error;
    }
  }

  async findByUser(userId: string, limit: number = 50): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [userId, limit]);
      return result.rows.map(this.mapRow);
    } catch (error) {
      logger.error('Failed to find user notifications', { error, userId });
      throw error;
    }
  }

  async updateStatus(id: string, status: string): Promise<void> {
    const query = `
      UPDATE notifications
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `;

    try {
      await pool.query(query, [status, id]);
    } catch (error) {
      logger.error('Failed to update notification status', { error, id });
      throw error;
    }
  }

  async markAsRead(id: string): Promise<void> {
    const query = `
      UPDATE notifications
      SET read = true, read_at = NOW()
      WHERE id = $1
    `;

    try {
      await pool.query(query, [id]);
    } catch (error) {
      logger.error('Failed to mark notification as read', { error, id });
      throw error;
    }
  }

  async deleteOld(olderThan: Date): Promise<number> {
    const query = 'DELETE FROM notifications WHERE created_at < $1';

    try {
      const result = await pool.query(query, [olderThan]);
      return result.rowCount || 0;
    } catch (error) {
      logger.error('Failed to delete old notifications', { error });
      throw error;
    }
  }

  private mapRow(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      priority: row.priority,
      channels: row.channels,
      metadata: row.metadata,
      status: row.status,
      read: row.read,
      readAt: row.read_at,
      createdAt: row.created_at,
      sentAt: row.sent_at,
    };
  }
}
