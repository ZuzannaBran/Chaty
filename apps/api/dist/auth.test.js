import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from './auth.js';
describe('token sesji', () => {
    it('zachowuje identyfikator użytkownika', () => {
        const token = signToken('user-test-id');
        expect(verifyToken(token).userId).toBe('user-test-id');
    });
    it('odrzuca zmodyfikowany token', () => {
        const token = signToken('user-test-id');
        expect(() => verifyToken(`${token}x`)).toThrow();
    });
});
