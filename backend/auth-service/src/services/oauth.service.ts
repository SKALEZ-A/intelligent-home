import crypto from 'crypto';
import { logger } from '../../../../shared/utils/logger';
import { UnauthorizedError } from '../../../../shared/utils/errors';

interface OAuthProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string[];
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface OAuthUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  provider: string;
}

export class OAuthService {
  private providers: Map<string, OAuthProvider> = new Map();
  private stateStore: Map<string, { userId?: string; redirectUri: string; expiresAt: Date }> = new Map();

  constructor() {
    this.initializeProviders();
    this.startStateCleanup();
  }

  private initializeProviders() {
    const googleProvider: OAuthProvider = {
      name: 'google',
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scope: ['openid', 'email', 'profile']
    };

    const githubProvider: OAuthProvider = {
      name: 'github',
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      scope: ['user:email']
    };

    this.providers.set('google', googleProvider);
    this.providers.set('github', githubProvider);
  }

  public generateAuthorizationUrl(provider: string, redirectUri: string): string {
    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    const state = this.generateState();
    this.stateStore.set(state, {
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    const params = new URLSearchParams({
      client_id: providerConfig.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: providerConfig.scope.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `${providerConfig.authorizationUrl}?${params.toString()}`;
  }

  public async handleCallback(provider: string, code: string, state: string): Promise<OAuthUserInfo> {
    const stateData = this.stateStore.get(state);
    if (!stateData) {
      throw new UnauthorizedError('Invalid or expired state parameter');
    }

    if (stateData.expiresAt < new Date()) {
      this.stateStore.delete(state);
      throw new UnauthorizedError('State parameter has expired');
    }

    this.stateStore.delete(state);

    const providerConfig = this.providers.get(provider);
    if (!providerConfig) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }

    const tokenResponse = await this.exchangeCodeForToken(providerConfig, code, stateData.redirectUri);
    const userInfo = await this.fetchUserInfo(providerConfig, tokenResponse.access_token);

    return {
      ...userInfo,
      provider
    };
  }

  private async exchangeCodeForToken(
    provider: OAuthProvider,
    code: string,
    redirectUri: string
  ): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    try {
      const response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('OAuth token exchange failed', { provider: provider.name, error });
      throw new UnauthorizedError('Failed to exchange authorization code');
    }
  }

  private async fetchUserInfo(provider: OAuthProvider, accessToken: string): Promise<Omit<OAuthUserInfo, 'provider'>> {
    try {
      const response = await fetch(provider.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`User info fetch failed: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        id: data.id || data.sub,
        email: data.email,
        name: data.name || data.login,
        picture: data.picture || data.avatar_url
      };
    } catch (error) {
      logger.error('OAuth user info fetch failed', { provider: provider.name, error });
      throw new UnauthorizedError('Failed to fetch user information');
    }
  }

  private generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private startStateCleanup() {
    setInterval(() => {
      const now = new Date();
      for (const [state, data] of this.stateStore.entries()) {
        if (data.expiresAt < now) {
          this.stateStore.delete(state);
        }
      }
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }
}

export const oauthService = new OAuthService();
