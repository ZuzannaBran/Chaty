import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { User } from "@chat/shared";
import {
  createKeyBundle,
  decryptText,
  encryptText,
  storePrivateKey,
  unlockKey,
} from "./e2ee";

const storage = new Map<string, string>();
beforeAll(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});

describe("E2EE", () => {
  it("odszyfrowuje wiadomość wyłącznie po odblokowaniu klucza odbiorcy", async () => {
    const alice = await createKeyBundle("bardzo-dlugie-haslo");
    const bob = await createKeyBundle("inne-bardzo-dlugie-haslo");
    const user = (id: string, publicKey: JsonWebKey): User => ({
      id,
      tag: id,
      firstName: id,
      lastName: "Test",
      avatarColor: "#fff",
      createdAt: new Date(0).toISOString(),
      publicKey,
    });
    storePrivateKey(alice.privateKey);
    const ciphertext = await encryptText(
      "ściśle tajne",
      "00000000-0000-4000-8000-000000000001",
      user("bob", bob.publicKey),
    );
    expect(ciphertext).not.toContain("ściśle tajne");
    await unlockKey("inne-bardzo-dlugie-haslo", {
      encryptedPrivateKey: bob.encryptedPrivateKey,
      salt: bob.keySalt,
      iv: bob.keyIv,
    });
    await expect(
      decryptText(
        ciphertext,
        "00000000-0000-4000-8000-000000000001",
        user("alice", alice.publicKey),
      ),
    ).resolves.toBe("ściśle tajne");
  });
});
