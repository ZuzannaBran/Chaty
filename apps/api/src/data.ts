import type { Attachment, Conversation, Message, User } from '@chat/shared';
import { db } from './db.js';

type Row = Record<string, unknown>;

export function mapUser(row: Row): User {
  return {
    id: String(row.id), tag: String(row.tag), firstName: String(row.first_name),
    lastName: String(row.last_name), avatarColor: String(row.avatar_color), createdAt: String(row.created_at),
  };
}

function getAttachment(messageId: string): Attachment | null {
  const row = db.prepare('SELECT * FROM attachments WHERE message_id = ?').get(messageId) as Row | undefined;
  return row ? {
    id: String(row.id), kind: row.kind as Attachment['kind'], name: String(row.name),
    mimeType: String(row.mime_type), size: Number(row.size), url: `/uploads/${String(row.storage_name)}`,
  } : null;
}

export function getMessage(messageId: string): Message {
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as Row;
  const reactionRows = db.prepare('SELECT user_id, emoji FROM reactions WHERE message_id = ?').all(messageId) as Row[];
  const reactions: Record<string, string[]> = {};
  for (const reaction of reactionRows) {
    const emoji = String(reaction.emoji);
    (reactions[emoji] ??= []).push(String(reaction.user_id));
  }
  return {
    id: String(row.id), conversationId: String(row.conversation_id), senderId: String(row.sender_id),
    text: String(row.text), createdAt: String(row.created_at), editedAt: row.edited_at ? String(row.edited_at) : null,
    attachment: getAttachment(messageId), reactions,
  };
}

export function assertMember(conversationId: string, userId: string) {
  return Boolean(db.prepare('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?').get(conversationId, userId));
}

export function getConversation(conversationId: string, userId: string): Conversation {
  const row = db.prepare(`
    SELECT c.*, u.id user_id, u.tag, u.first_name, u.last_name, u.avatar_color, u.created_at user_created_at,
      (SELECT id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) last_message_id,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND
        m.created_at > COALESCE(cm.last_read_at, '')) unread_count
    FROM conversations c
    JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
    JOIN conversation_members other ON other.conversation_id = c.id AND other.user_id != ?
    JOIN users u ON u.id = other.user_id WHERE c.id = ?
  `).get(userId, userId, userId, conversationId) as Row;
  return {
    id: String(row.id), accent: String(row.accent), updatedAt: String(row.updated_at),
    unreadCount: Number(row.unread_count), lastMessage: row.last_message_id ? getMessage(String(row.last_message_id)) : null,
    participant: mapUser({ id: row.user_id, tag: row.tag, first_name: row.first_name, last_name: row.last_name,
      avatar_color: row.avatar_color, created_at: row.user_created_at }),
  };
}

export function listConversations(userId: string) {
  const ids = db.prepare(`SELECT c.id FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id
    WHERE cm.user_id = ? ORDER BY c.updated_at DESC`).all(userId) as { id: string }[];
  return ids.map(({ id }) => getConversation(id, userId));
}

export function conversationMemberIds(conversationId: string) {
  return (db.prepare('SELECT user_id FROM conversation_members WHERE conversation_id = ?').all(conversationId) as { user_id: string }[])
    .map((row) => row.user_id);
}
