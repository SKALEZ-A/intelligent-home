import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.REACT_APP_AUTH_SERVICE_URL || 'http://localhost:3001/api';

export interface LoginResponse {
  token?: string;
  user?: User;
  requiresTwoFactor?: boolean;
  tempToken?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface ResetPasswordData {
  token: string;
  newPassword: string;
}

class AuthService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor to handle token expiration
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.clearToken();
          window.location.href = '/auth/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.api.post('/auth/login', { email, password });
    
    if (response.data.token) {
      this.setToken(response.data.token);
    }
    
    return response.data;
  }

  async signup(data: SignupData): Promise<void> {
    await this.api.post('/auth/signup', data);
  }

  async verifyEmail(token: string): Promise<void> {
    await this.api.post('/auth/verify-email', { token });
  }

  async resendVerificationEmail(email: string): Promise<void> {
    await this.api.post('/auth/resend-verification', { email });
  }

  async forgotPassword(email: string): Promise<void> {
    await this.api.post('/auth/forgot-password', { email });
  }

  async resetPassword(data: ResetPasswordData): Promise<void> {
    await this.api.post('/auth/reset-password', data);
  }

  async verifyTwoFactor(tempToken: string, code: string): Promise<LoginResponse> {
    const response = await this.api.post('/auth/verify-2fa', { 
      tempToken, 
      code 
    });
    
    if (response.data.token) {
      this.setToken(response.data.token);
    }
    
    return response.data;
  }

  async enableTwoFactor(): Promise<{ qrCode: string; secret: string }> {
    const response = await this.api.post('/auth/enable-2fa');
    return response.data;
  }

  async confirmTwoFactor(code: string): Promise<{ backupCodes: string[] }> {
    const response = await this.api.post('/auth/confirm-2fa', { code });
    return response.data;
  }

  async disableTwoFactor(password: string): Promise<void> {
    await this.api.post('/auth/disable-2fa', { password });
  }

  async refreshToken(): Promise<string> {
    const response = await this.api.post('/auth/refresh');
    const newToken = response.data.token;
    this.setToken(newToken);
    return newToken;
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout');
    } finally {
      this.clearToken();
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.api.get('/auth/me');
    return response.data;
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await this.api.put('/auth/profile', data);
    return response.data;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  }

  async deleteAccount(password: string): Promise<void> {
    await this.api.post('/auth/delete-account', { password });
    this.clearToken();
  }

  // Token management
  setToken(token: string): void {
    localStorage.setItem('auth_token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  clearToken(): void {
    localStorage.removeItem('auth_token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  // Session management
  async checkSession(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch (error) {
      return false;
    }
  }

  // OAuth methods
  async loginWithGoogle(token: string): Promise<LoginResponse> {
    const response = await this.api.post('/auth/google', { token });
    
    if (response.data.token) {
      this.setToken(response.data.token);
    }
    
    return response.data;
  }

  async loginWithApple(token: string): Promise<LoginResponse> {
    const response = await this.api.post('/auth/apple', { token });
    
    if (response.data.token) {
      this.setToken(response.data.token);
    }
    
    return response.data;
  }

  // Security methods
  async getActiveSessions(): Promise<any[]> {
    const response = await this.api.get('/auth/sessions');
    return response.data;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.api.delete(`/auth/sessions/${sessionId}`);
  }

  async revokeAllSessions(): Promise<void> {
    await this.api.delete('/auth/sessions');
  }

  async getLoginHistory(page: number = 1, limit: number = 20): Promise<any> {
    const response = await this.api.get('/auth/login-history', {
      params: { page, limit },
    });
    return response.data;
  }
}

export const authService = new AuthService();
