import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

function matchesSecret(actual: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(actual), digest(expected));
}

function readCredential(req: Request): string | undefined {
  const direct = req.headers['x-musicrip-token'];
  if (typeof direct === 'string') return direct;
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string') return undefined;
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization);
  if (bearer) return bearer[1];
  const basic = /^Basic\s+([A-Za-z0-9+/]+={0,2})$/i.exec(authorization);
  if (!basic) return undefined;
  const decoded = Buffer.from(basic[1], 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator < 0 || decoded.slice(0, separator) !== 'musicrip') return undefined;
  return decoded.slice(separator + 1);
}

export function personalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // Read at request time: dotenv.config() runs after module imports.
  const secret = process.env.MUSICRIP_API_SECRET || '';
  res.setHeader('Cache-Control', 'no-store');
  if (!secret) {
    return res.status(503).json({
      error: 'Personal access is not configured. Set MUSICRIP_API_SECRET on the server.'
    });
  }

  // Origin/Referer are not authentication. Reject cross-site browser requests.
  const origin = req.headers.origin;
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    return res.status(403).json({ error: 'Cross-site export requests are not allowed.' });
  }
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host) {
        return res.status(403).json({ error: 'Cross-origin export requests are not allowed.' });
      }
    } catch {
      return res.status(403).json({ error: 'Invalid request origin.' });
    }
  }

  const credential = readCredential(req);
  if (!credential || !matchesSecret(credential, secret)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Music Rip Personal", charset="UTF-8"');
    return res.status(401).json({ error: 'Personal access required. Username: musicrip.' });
  }
  return next();
}
