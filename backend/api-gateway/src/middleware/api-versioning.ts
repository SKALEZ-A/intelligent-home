import { Request, Response, NextFunction } from 'express';

export interface VersionConfig {
  defaultVersion: string;
  supportedVersions: string[];
  deprecatedVersions?: { [version: string]: string };
  headerName?: string;
}

export class ApiVersioningMiddleware {
  private config: VersionConfig;

  constructor(config: VersionConfig) {
    this.config = {
      headerName: 'X-API-Version',
      ...config
    };
  }

  private extractVersion(req: Request): string | null {
    const headerVersion = req.headers[this.config.headerName!.toLowerCase()] as string;
    if (headerVersion) return headerVersion;

    const urlMatch = req.path.match(/^\/v(\d+(?:\.\d+)?)\//);
    if (urlMatch) return urlMatch[1];

    const queryVersion = req.query.version as string;
    if (queryVersion) return queryVersion;

    return null;
  }

  private isVersionSupported(version: string): boolean {
    return this.config.supportedVersions.includes(version);
  }

  private isVersionDeprecated(version: string): boolean {
    return !!this.config.deprecatedVersions?.[version];
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestedVersion = this.extractVersion(req) || this.config.defaultVersion;

      if (!this.isVersionSupported(requestedVersion)) {
        return res.status(400).json({
          error: 'Unsupported API Version',
          message: `API version ${requestedVersion} is not supported`,
          supportedVersions: this.config.supportedVersions,
          defaultVersion: this.config.defaultVersion
        });
      }

      (req as any).apiVersion = requestedVersion;
      res.setHeader('X-API-Version', requestedVersion);

      if (this.isVersionDeprecated(requestedVersion)) {
        const deprecationMessage = this.config.deprecatedVersions![requestedVersion];
        res.setHeader('X-API-Deprecated', 'true');
        res.setHeader('X-API-Deprecation-Message', deprecationMessage);
        console.warn(`Deprecated API version ${requestedVersion} used: ${deprecationMessage}`);
      }

      next();
    };
  }

  public versionRoute(version: string, handler: any) {
    return (req: Request, res: Response, next: NextFunction) => {
      const currentVersion = (req as any).apiVersion;
      if (currentVersion === version) {
        return handler(req, res, next);
      }
      next();
    };
  }
}

export const createVersioningMiddleware = (config: VersionConfig) => {
  const versioning = new ApiVersioningMiddleware(config);
  return versioning.middleware();
};
