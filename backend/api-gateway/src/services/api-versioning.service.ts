import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface ApiVersion {
  version: string;
  deprecated: boolean;
  sunsetDate?: Date;
  routes: Map<string, any>;
}

export class ApiVersioningService {
  private versions: Map<string, ApiVersion> = new Map();
  private defaultVersion: string = 'v1';

  constructor() {
    this.initializeVersions();
  }

  private initializeVersions(): void {
    this.versions.set('v1', {
      version: 'v1',
      deprecated: false,
      routes: new Map()
    });

    this.versions.set('v2', {
      version: 'v2',
      deprecated: false,
      routes: new Map()
    });

    logger.info('API versions initialized', { 
      versions: Array.from(this.versions.keys())
    });
  }

  public extractVersion(req: Request): string {
    // Check URL path first
    const pathMatch = req.path.match(/^\/api\/(v\d+)\//);
    if (pathMatch) {
      return pathMatch[1];
    }

    // Check Accept header
    const acceptHeader = req.headers['accept'];
    if (acceptHeader) {
      const versionMatch = acceptHeader.match(/application\/vnd\.smarthome\.(v\d+)\+json/);
      if (versionMatch) {
        return versionMatch[1];
      }
    }

    // Check custom header
    const versionHeader = req.headers['api-version'] as string;
    if (versionHeader) {
      return versionHeader;
    }

    return this.defaultVersion;
  }

  public versionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const version = this.extractVersion(req);
      const versionInfo = this.versions.get(version);

      if (!versionInfo) {
        return res.status(400).json({
          error: 'Invalid API version',
          supportedVersions: Array.from(this.versions.keys())
        });
      }

      if (versionInfo.deprecated) {
        res.setHeader('X-API-Deprecated', 'true');
        if (versionInfo.sunsetDate) {
          res.setHeader('X-API-Sunset', versionInfo.sunsetDate.toISOString());
        }
        res.setHeader('X-API-Warning', `API version ${version} is deprecated`);
      }

      req.apiVersion = version;
      next();
    };
  }

  public deprecateVersion(version: string, sunsetDate?: Date): void {
    const versionInfo = this.versions.get(version);
    if (versionInfo) {
      versionInfo.deprecated = true;
      versionInfo.sunsetDate = sunsetDate;
      logger.info('API version deprecated', { version, sunsetDate });
    }
  }

  public getVersionInfo(version: string): ApiVersion | undefined {
    return this.versions.get(version);
  }

  public listVersions(): ApiVersion[] {
    return Array.from(this.versions.values());
  }
}

export const apiVersioningService = new ApiVersioningService();

declare global {
  namespace Express {
    interface Request {
      apiVersion?: string;
    }
  }
}
