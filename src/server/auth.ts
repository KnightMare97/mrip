import { NextFunction, Request, Response } from 'express';

const PERSONAL_SECRET = process.env.MUSICRIP_API_SECRET || '';

/**
 * Middleware ensuring export endpoints cannot be abused as an unrestricted public proxy
 */
export function personalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // If no secret configured, allow local dev / same-origin requests
  if (!PERSONAL_SECRET) {
    const origin = req.headers.origin || req.headers.referer || '';
    const host = req.headers.host || '';

    // Allow localhost, 127.0.0.1, or same-host requests
    if (
      !origin ||
      origin.includes(host) ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return next();
    }
  }

  const token =
    req.headers['x-musicrip-token'] ||
    req.headers.authorization?.replace(/^Bearer\s+/, '') ||
    req.query.token;

  if (PERSONAL_SECRET && token !== PERSONAL_SECRET) {
    return res.status(401).json({
      error: 'Unauthorized: Personal access token required for export operations.'
    });
  }

  next();
}
