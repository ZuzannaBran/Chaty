export type AttachmentKind = "image" | "pdf" | "audio" | "file";

export interface User {
  id: string;
  tag: string;
  firstName: string;
  lastName: string;
  avatarColor: string;
  createdAt: string;
  publicKey: JsonWebKey | null;
}

export interface KeyBundle {
  encryptedPrivateKey: string;
  salt: string;
  iv: string;
}

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  encryptionIv: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt: string | null;
  attachment: Attachment | null;
  reactions: Record<string, string[]>;
  replyTo: MessageReference | null;
  forwardedFrom: MessageReference | null;
}

export interface MessageReference {
  id: string;
  senderId: string;
  text: string;
  attachmentName: string | null;
}

export interface Conversation {
  id: string;
  participant: User;
  lastMessage: Message | null;
  unreadCount: number;
  accent: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  keyBundle: KeyBundle;
}

export interface SocketServerEvents {
  "message:new": (message: Message) => void;
  "message:reaction": (message: Message) => void;
  "typing:update": (payload: {
    conversationId: string;
    userId: string;
    isTyping: boolean;
  }) => void;
  "presence:update": (payload: { userId: string; online: boolean }) => void;
  "conversation:new": (conversation: Conversation) => void;
}

export interface SocketClientEvents {
  "conversation:join": (conversationId: string) => void;
  "conversation:leave": (conversationId: string) => void;
  "typing:set": (payload: {
    conversationId: string;
    isTyping: boolean;
  }) => void;
}
