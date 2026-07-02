import jwt from 'jsonwebtoken';
import { config } from './config.js';
export function signToken(userId) {
    return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '30d' });
}
export function verifyToken(token) {
    return jwt.verify(token, config.JWT_SECRET);
}
export function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token)
        return res.status(401).json({ message: 'Brak autoryzacji.' });
    try {
        res.locals.userId = verifyToken(token).userId;
        next();
    }
    catch {
        return res.status(401).json({ message: 'Sesja wygasła. Zaloguj się ponownie.' });
    }
}
