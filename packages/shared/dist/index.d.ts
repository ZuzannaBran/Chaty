export type AttachmentKind = 'image' | 'pdf' | 'audio' | 'file';
export interface User {
    id: string;
    tag: string;
    firstName: string;
    lastName: string;
    avatarColor: string;
    createdAt: string;
}
export interface Attachment {
    id: string;
    kind: AttachmentKind;
    name: string;
    mimeType: string;
    size: number;
    url: string;
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
}
export interface SocketServerEvents {
    'message:new': (message: Message) => void;
    'message:reaction': (message: Message) => void;
    'typing:update': (payload: {
        conversationId: string;
        userId: string;
        isTyping: boolean;
    }) => void;
    'presence:update': (payload: {
        userId: string;
        online: boolean;
    }) => void;
    'conversation:new': (conversation: Conversation) => void;
}
export interface SocketClientEvents {
    'conversation:join': (conversationId: string) => void;
    'typing:set': (payload: {
        conversationId: string;
        isTyping: boolean;
    }) => void;
}
