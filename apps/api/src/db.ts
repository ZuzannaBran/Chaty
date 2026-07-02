import Database from "better-sqlite3";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { config } from "./config.js";

mkdirSync(dirname(config.DATABASE_PATH), { recursive: true });
export const db = new Database(config.DATABASE_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, tag TEXT NOT NULL UNIQUE COLLATE NOCASE,
  first_name TEXT NOT NULL, last_name TEXT NOT NULL, password_hash TEXT NOT NULL,
  avatar_color TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, accent TEXT NOT NULL DEFAULT '#b8a4ff', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TEXT, PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id), text TEXT NOT NULL DEFAULT '',
  attachment_id TEXT, created_at TEXT NOT NULL, edited_at TEXT
);
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY, message_id TEXT UNIQUE, kind TEXT NOT NULL, name TEXT NOT NULL,
  mime_type TEXT NOT NULL, size INTEGER NOT NULL, storage_name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reactions (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL, PRIMARY KEY (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_text ON messages(text);
`);

const messageColumns = db.prepare("PRAGMA table_info(messages)").all() as {
  name: string;
}[];
const userColumns = db.prepare("PRAGMA table_info(users)").all() as {
  name: string;
}[];
if (!userColumns.some(({ name }) => name === "public_key")) {
  db.exec("ALTER TABLE users ADD COLUMN public_key TEXT");
  db.exec("ALTER TABLE users ADD COLUMN encrypted_private_key TEXT");
  db.exec("ALTER TABLE users ADD COLUMN key_salt TEXT");
  db.exec("ALTER TABLE users ADD COLUMN key_iv TEXT");
}
if (!messageColumns.some(({ name }) => name === "reply_to_message_id")) {
  db.exec(
    "ALTER TABLE messages ADD COLUMN reply_to_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL",
  );
}
if (!messageColumns.some(({ name }) => name === "forwarded_from_message_id")) {
  db.exec(
    "ALTER TABLE messages ADD COLUMN forwarded_from_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL",
  );
}
const attachmentColumns = db
  .prepare("PRAGMA table_info(attachments)")
  .all() as { name: string }[];
if (!attachmentColumns.some(({ name }) => name === "encryption_iv"))
  db.exec("ALTER TABLE attachments ADD COLUMN encryption_iv TEXT");
