import { api } from '../utils/api';

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

class NotificationService {
  async getNotifications(limit: number = 50): Promise<Notification[]> {
    const response = await api.get(`/notifications?limit=${limit}`);
    return response.data.map((n: any) => ({
      ...n,
      timestamp: new Date(n.timestamp)
    }));
  }

  async markAsRead(notificationId: string): Promise<void> {
    await api.put(`/notifications/${notificationId}/read`);
  }

  async markAllAsRead(): Promise<void> {
    await api.put('/notifications/read-all');
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await api.delete(`/notifications/${notificationId}`);
  }

  async getUnreadCount(): Promise<number> {
    const response = await api.get('/notifications/unread-count');
    return response.data.count;
  }

  async subscribeToNotifications(callback: (notification: Notification) => void): Promise<() => void> {
    const ws = new WebSocket(`${process.env.REACT_APP_WS_URL}/notifications`);

    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      notification.timestamp = new Date(notification.timestamp);
      callback(notification);
    };

    return () => ws.close();
  }
}

export const notificationService = new NotificationService();
