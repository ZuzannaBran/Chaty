import type { KeyBundle, User } from "@chat/shared";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const toB64 = (data: ArrayBuffer | Uint8Array) => {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
};
const fromB64 = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

async function passwordKey(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 310_000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function createKeyBundle(password: string) {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await passwordKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(privateKey)),
  );
  return {
    publicKey,
    encryptedPrivateKey: toB64(encrypted),
    keySalt: toB64(salt),
    keyIv: toB64(iv),
    privateKey,
  };
}

export async function unlockKey(password: string, bundle: KeyBundle) {
  const key = await passwordKey(password, fromB64(bundle.salt));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(bundle.iv) },
    key,
    fromB64(bundle.encryptedPrivateKey),
  );
  const privateKey = JSON.parse(decoder.decode(plain)) as JsonWebKey;
  sessionStorage.setItem("chat_e2ee_key", JSON.stringify(privateKey));
  return privateKey;
}
export const storePrivateKey = (key: JsonWebKey) =>
  sessionStorage.setItem("chat_e2ee_key", JSON.stringify(key));
export const hasPrivateKey = () =>
  Boolean(sessionStorage.getItem("chat_e2ee_key"));
export const clearPrivateKey = () => sessionStorage.removeItem("chat_e2ee_key");

async function conversationKey(conversationId: string, participant: User) {
  const saved = sessionStorage.getItem("chat_e2ee_key");
  if (!saved || !participant.publicKey)
    throw new Error("Brak klucza E2EE rozmowy.");
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    JSON.parse(saved),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    participant.publicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const secret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256,
  );
  const material = await crypto.subtle.importKey("raw", secret, "HKDF", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(conversationId),
      info: encoder.encode("halo-e2ee-v1"),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(
  text: string,
  conversationId: string,
  participant: User,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await conversationKey(conversationId, participant);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(text),
  );
  return `e2ee:v1:${toB64(iv)}:${toB64(encrypted)}`;
}
export async function decryptText(
  text: string,
  conversationId: string,
  participant: User,
) {
  if (!text.startsWith("e2ee:v1:")) return `[starsza wiadomość] ${text}`;
  const [, , iv, payload] = text.split(":");
  const key = await conversationKey(conversationId, participant);
  return decoder.decode(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(iv!) },
      key,
      fromB64(payload!),
    ),
  );
}
export async function encryptFile(
  file: File,
  conversationId: string,
  participant: User,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await conversationKey(conversationId, participant);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    await file.arrayBuffer(),
  );
  return {
    file: new File([encrypted], `${file.name}.e2ee`, {
      type: "application/octet-stream",
    }),
    iv: toB64(iv),
    originalName: file.name,
    originalMime: file.type,
  };
}
export async function decryptFile(
  data: Blob,
  iv: string,
  conversationId: string,
  participant: User,
) {
  const key = await conversationKey(conversationId, participant);
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(iv) },
    key,
    await data.arrayBuffer(),
  );
}
