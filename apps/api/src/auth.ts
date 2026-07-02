import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

export interface TokenPayload { userId: string }

export function signToken(userId: string) {
  return jwt.sign({ userId } satisfies TokenPayload, config.JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token: string) {
  return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Brak autoryzacji.' });
  try {
    res.locals.userId = verifyToken(token).userId;
    next();
  } catch {
    return res.status(401).json({ message: 'Sesja wygasła. Zaloguj się ponownie.' });
  }
}
