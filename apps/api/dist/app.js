import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { z } from 'zod';
import { requireAuth, signToken } from './auth.js';
import { config } from './config.js';
import { assertMember, conversationMemberIds, getConversation, getMessage, listConversations, mapUser } from './data.js';
import { db } from './db.js';
mkdirSync(config.UPLOAD_DIR, { recursive: true });
const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'text/plain', 'application/zip']);
const upload = multer({
    storage: multer.diskStorage({
        destination: config.UPLOAD_DIR,
        filename: (_req, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
    fileFilter: (_req, file, callback) => callback(null, allowedMime.has(file.mimetype)),
});
const credentialsSchema = z.object({ tag: z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,24}$/), password: z.string().min(8).max(128) });
const registerSchema = credentialsSchema.extend({ firstName: z.string().trim().min(2).max(40), lastName: z.string().trim().min(2).max(60) });
const messageSchema = z.object({ text: z.string().trim().max(4000).default('') });
const accents = ['#b8a4ff', '#f6a6c1', '#73d9c2', '#82b8ff', '#f2b66d'];
function attachmentKind(mime) {
    if (mime.startsWith('image/'))
        return 'image';
    if (mime.startsWith('audio/'))
        return 'audio';
    if (mime === 'application/pdf')
        return 'pdf';
    return 'file';
}
export function createApp(io) {
    const app = express();
    app.use(cors({ origin: config.CLIENT_ORIGIN }));
    app.use(express.json({ limit: '1mb' }));
    app.use('/uploads', express.static(config.UPLOAD_DIR, { fallthrough: false, maxAge: '1d' }));
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
    app.post('/api/auth/register', async (req, res) => {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ message: 'Sprawdź dane. Tag: 3–24 znaki, hasło: min. 8 znaków.' });
        const { tag, password, firstName, lastName } = parsed.data;
        if (db.prepare('SELECT 1 FROM users WHERE tag = ?').get(tag))
            return res.status(409).json({ message: 'Ten tag jest już zajęty.' });
        const id = randomUUID();
        const createdAt = new Date().toISOString();
        db.prepare(`INSERT INTO users (id, tag, first_name, last_name, password_hash, avatar_color, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, tag, firstName, lastName, await bcrypt.hash(password, 12), accents[Math.floor(Math.random() * accents.length)], createdAt);
        const user = mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
        return res.status(201).json({ token: signToken(id), user });
    });
    app.post('/api/auth/login', async (req, res) => {
        const parsed = credentialsSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ message: 'Nieprawidłowy tag lub hasło.' });
        const row = db.prepare('SELECT * FROM users WHERE tag = ?').get(parsed.data.tag);
        if (!row || !await bcrypt.compare(parsed.data.password, String(row.password_hash)))
            return res.status(401).json({ message: 'Nieprawidłowy tag lub hasło.' });
        return res.json({ token: signToken(String(row.id)), user: mapUser(row) });
    });
    app.use('/api', requireAuth);
    app.get('/api/me', (_req, res) => {
        const row = db.prepare('SELECT * FROM users WHERE id = ?').get(res.locals.userId);
        res.json(mapUser(row));
    });
    app.get('/api/users/search', (req, res) => {
        const query = String(req.query.q ?? '').replace(/^@/, '').trim();
        if (query.length < 2)
            return res.json([]);
        const rows = db.prepare(`SELECT * FROM users WHERE id != ? AND (tag LIKE ? OR first_name LIKE ? OR last_name LIKE ?) LIMIT 12`)
            .all(res.locals.userId, `%${query}%`, `%${query}%`, `%${query}%`);
        res.json(rows.map(mapUser));
    });
    app.get('/api/conversations', (_req, res) => res.json(listConversations(res.locals.userId)));
    app.post('/api/conversations', (req, res) => {
        const parsed = z.object({ userTag: z.string().trim().transform((value) => value.replace(/^@/, '').toLowerCase()) }).safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ message: 'Podaj poprawny tag.' });
        const other = db.prepare('SELECT id FROM users WHERE tag = ?').get(parsed.data.userTag);
        if (!other || other.id === res.locals.userId)
            return res.status(404).json({ message: 'Nie znaleziono użytkownika.' });
        const existing = db.prepare(`SELECT cm.conversation_id id FROM conversation_members cm
      JOIN conversation_members cm2 ON cm2.conversation_id = cm.conversation_id AND cm2.user_id = ?
      WHERE cm.user_id = ? AND (SELECT COUNT(*) FROM conversation_members x WHERE x.conversation_id = cm.conversation_id) = 2`)
            .get(res.locals.userId, other.id);
        const id = existing?.id ?? randomUUID();
        if (!existing) {
            const now = new Date().toISOString();
            db.transaction(() => {
                db.prepare('INSERT INTO conversations (id, accent, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, accents[0], now, now);
                const add = db.prepare('INSERT INTO conversation_members (conversation_id, user_id, last_read_at) VALUES (?, ?, ?)');
                add.run(id, res.locals.userId, now);
                add.run(id, other.id, null);
            })();
        }
        const mine = getConversation(id, res.locals.userId);
        io.to(`user:${other.id}`).emit('conversation:new', getConversation(id, other.id));
        res.status(existing ? 200 : 201).json(mine);
    });
    app.patch('/api/conversations/:id', (req, res) => {
        if (!assertMember(req.params.id, res.locals.userId))
            return res.status(403).json({ message: 'Brak dostępu.' });
        const parsed = z.object({ accent: z.enum(accents) }).safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ message: 'Nieprawidłowy kolor.' });
        db.prepare('UPDATE conversations SET accent = ? WHERE id = ?').run(parsed.data.accent, req.params.id);
        for (const userId of conversationMemberIds(req.params.id))
            io.to(`user:${userId}`).emit('conversation:new', getConversation(req.params.id, userId));
        res.json(getConversation(req.params.id, res.locals.userId));
    });
    app.get('/api/conversations/:id/messages', (req, res) => {
        const id = req.params.id;
        if (!assertMember(id, res.locals.userId))
            return res.status(403).json({ message: 'Brak dostępu.' });
        const query = String(req.query.q ?? '').trim();
        const rows = (query ? db.prepare(`SELECT id FROM messages WHERE conversation_id = ? AND text LIKE ? ORDER BY created_at ASC LIMIT 200`).all(id, `%${query}%`)
            : db.prepare('SELECT id FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 300').all(id));
        res.json(rows.map((row) => getMessage(row.id)));
    });
    app.post('/api/conversations/:id/read', (req, res) => {
        if (!assertMember(req.params.id, res.locals.userId))
            return res.status(403).json({ message: 'Brak dostępu.' });
        db.prepare('UPDATE conversation_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?')
            .run(new Date().toISOString(), req.params.id, res.locals.userId);
        res.status(204).end();
    });
    app.post('/api/conversations/:id/messages', upload.single('file'), (req, res) => {
        const conversationId = String(req.params.id);
        if (!assertMember(conversationId, res.locals.userId))
            return res.status(403).json({ message: 'Brak dostępu.' });
        const parsed = messageSchema.safeParse({ text: req.body.text ?? '' });
        if (!parsed.success || (!parsed.data.text && !req.file))
            return res.status(400).json({ message: 'Wiadomość jest pusta.' });
        const id = randomUUID();
        const now = new Date().toISOString();
        db.transaction(() => {
            db.prepare('INSERT INTO messages (id, conversation_id, sender_id, text, created_at) VALUES (?, ?, ?, ?, ?)')
                .run(id, conversationId, res.locals.userId, parsed.data.text, now);
            if (req.file)
                db.prepare(`INSERT INTO attachments (id, message_id, kind, name, mime_type, size, storage_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(randomUUID(), id, attachmentKind(req.file.mimetype), req.file.originalname, req.file.mimetype, req.file.size, req.file.filename);
            db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);
        })();
        const message = getMessage(id);
        for (const userId of conversationMemberIds(conversationId))
            io.to(`user:${userId}`).emit('message:new', message);
        res.status(201).json(message);
    });
    app.post('/api/messages/:id/reactions', (req, res) => {
        const message = getMessage(req.params.id);
        if (!assertMember(message.conversationId, res.locals.userId))
            return res.status(403).json({ message: 'Brak dostępu.' });
        const parsed = z.object({ emoji: z.string().min(1).max(8) }).safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ message: 'Nieprawidłowa reakcja.' });
        const exists = db.prepare('SELECT 1 FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
            .get(message.id, res.locals.userId, parsed.data.emoji);
        if (exists)
            db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?').run(message.id, res.locals.userId, parsed.data.emoji);
        else
            db.prepare('INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)').run(message.id, res.locals.userId, parsed.data.emoji);
        const updated = getMessage(message.id);
        for (const userId of conversationMemberIds(message.conversationId))
            io.to(`user:${userId}`).emit('message:reaction', updated);
        res.json(updated);
    });
    app.use((error, _req, res, _next) => {
        console.error(error);
        if (error instanceof multer.MulterError)
            return res.status(400).json({ message: `Załącznik jest za duży (maks. ${config.MAX_FILE_SIZE_MB} MB).` });
        res.status(500).json({ message: 'Wystąpił błąd serwera.' });
    });
    return app;
}
