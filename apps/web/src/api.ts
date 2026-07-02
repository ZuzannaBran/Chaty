import type { AuthResponse, Conversation, Message, User } from "@chat/shared";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
let token = localStorage.getItem("chat_token");
export const setToken = (next: string | null) => {
  token = next;
  next
    ? localStorage.setItem("chat_token", next)
    : localStorage.removeItem("chat_token");
};
export const getToken = () => token;

export async function fetchAttachment(path: string) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Nie udało się pobrać załącznika.");
  return response.blob();
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => ({ message: "Błąd połączenia z serwerem." }))) as {
      message?: string;
    };
    throw new Error(body.message ?? "Nie udało się wykonać operacji.");
  }
  return (response.status === 204 ? undefined : response.json()) as Promise<T>;
}

export const api = {
  register: (data: {
    tag: string;
    password: string;
    firstName: string;
    lastName: string;
    publicKey: JsonWebKey;
    encryptedPrivateKey: string;
    keySalt: string;
    keyIv: string;
  }) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  login: (data: {
    tag: string;
    password: string;
    publicKey?: JsonWebKey;
    encryptedPrivateKey?: string;
    keySalt?: string;
    keyIv?: string;
  }) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  me: () => request<User>("/api/me"),
  conversations: () => request<Conversation[]>("/api/conversations"),
  createConversation: (userTag: string) =>
    request<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ userTag }),
    }),
  updateAccent: (id: string, accent: string) =>
    request<Conversation>(`/api/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ accent }),
    }),
  searchUsers: (query: string) =>
    request<User[]>(`/api/users/search?q=${encodeURIComponent(query)}`),
  messages: (id: string, query = "") =>
    request<Message[]>(
      `/api/conversations/${id}/messages${query ? `?q=${encodeURIComponent(query)}` : ""}`,
    ),
  sendMessage: (
    id: string,
    text: string,
    file?: File,
    replyToId?: string,
    encryption?: { iv: string; originalName: string; originalMime: string },
  ) => {
    const body = new FormData();
    body.set("text", text);
    if (file) body.set("file", file);
    if (replyToId) body.set("replyToId", replyToId);
    if (encryption) {
      body.set("encryptionIv", encryption.iv);
      body.set("originalName", encryption.originalName);
      body.set("originalMime", encryption.originalMime);
    }
    return request<Message>(`/api/conversations/${id}/messages`, {
      method: "POST",
      body,
    });
  },
  read: (id: string) =>
    request<void>(`/api/conversations/${id}/read`, { method: "POST" }),
  react: (id: string, emoji: string) =>
    request<Message>(`/api/messages/${id}/reactions`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    }),
};
