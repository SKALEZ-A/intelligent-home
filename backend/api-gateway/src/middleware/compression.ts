import { Request, Response, NextFunction } from 'express';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);
const brotliCompress = promisify(zlib.brotliCompress);

interface CompressionOptions {
  threshold?: number;
  level?: number;
  filter?: (req: Request, res: Response) => boolean;
  brotliEnabled?: boolean;
}

export class CompressionMiddleware {
  private options: Required<CompressionOptions>;

  constructor(options: CompressionOptions = {}) {
    this.options = {
      threshold: options.threshold || 1024,
      level: options.level || 6,
      filter: options.filter || this.defaultFilter,
      brotliEnabled: options.brotliEnabled !== false
    };
  }

  private defaultFilter(req: Request, res: Response): boolean {
    const contentType = res.getHeader('Content-Type') as string;
    if (!contentType) return false;

    return /json|text|javascript|xml|svg/.test(contentType);
  }

  private shouldCompress(req: Request, res: Response, body: Buffer): boolean {
    if (!this.options.filter(req, res)) return false;
    if (body.length < this.options.threshold) return false;
    if (res.getHeader('Content-Encoding')) return false;

    const acceptEncoding = req.headers['accept-encoding'] || '';
    return /gzip|deflate|br/.test(acceptEncoding);
  }

  private selectEncoding(acceptEncoding: string): string | null {
    if (this.options.brotliEnabled && /\bbr\b/.test(acceptEncoding)) {
      return 'br';
    }
    if (/\bgzip\b/.test(acceptEncoding)) {
      return 'gzip';
    }
    if (/\bdeflate\b/.test(acceptEncoding)) {
      return 'deflate';
    }
    return null;
  }

  private async compressData(data: Buffer, encoding: string): Promise<Buffer> {
    switch (encoding) {
      case 'br':
        return await brotliCompress(data, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: this.options.level
          }
        });
      case 'gzip':
        return await gzip(data, { level: this.options.level });
      case 'deflate':
        return await deflate(data, { level: this.options.level });
      default:
        return data;
    }
  }

  public middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      const originalJson = res.json;

      res.send = async function(this: Response, body: any): Response {
        if (typeof body === 'string') {
          body = Buffer.from(body);
        } else if (!Buffer.isBuffer(body)) {
          body = Buffer.from(JSON.stringify(body));
        }

        const acceptEncoding = req.headers['accept-encoding'] || '';
        const encoding = this.selectEncoding(acceptEncoding);

        if (this.shouldCompress(req, res, body) && encoding) {
          try {
            const compressed = await this.compressData(body, encoding);
            res.setHeader('Content-Encoding', encoding);
            res.setHeader('Content-Length', compressed.length.toString());
            res.setHeader('Vary', 'Accept-Encoding');
            return originalSend.call(this, compressed);
          } catch (error) {
            console.error('Compression error:', error);
          }
        }

        return originalSend.call(this, body);
      }.bind(this);

      res.json = async function(this: Response, body: any): Response {
        res.setHeader('Content-Type', 'application/json');
        return res.send(body);
      }.bind(this);

      next();
    };
  }
}

export const createCompressionMiddleware = (options?: CompressionOptions) => {
  const compression = new CompressionMiddleware(options);
  return compression.middleware();
};
