import { useState, type FormEvent } from "react";
import type { User } from "@chat/shared";
import { api } from "./api";
import { createKeyBundle, storePrivateKey, unlockKey } from "./e2ee";
import { Logo } from "./Logo";

export function Auth({
  onAuth,
}: {
  onAuth: (user: User, token: string) => void;
}) {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const values = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    try {
      let result;
      if (register) {
        const bundle = await createKeyBundle(values.password!);
        result = await api.register({
          tag: values.tag!,
          password: values.password!,
          firstName: values.firstName!,
          lastName: values.lastName!,
          publicKey: bundle.publicKey,
          encryptedPrivateKey: bundle.encryptedPrivateKey,
          keySalt: bundle.keySalt,
          keyIv: bundle.keyIv,
        });
        storePrivateKey(bundle.privateKey);
      } else {
        const candidate = await createKeyBundle(values.password!);
        result = await api.login({
          tag: values.tag!,
          password: values.password!,
          publicKey: candidate.publicKey,
          encryptedPrivateKey: candidate.encryptedPrivateKey,
          keySalt: candidate.keySalt,
          keyIv: candidate.keyIv,
        });
        await unlockKey(values.password!, result.keyBundle);
      }
      onAuth(result.user, result.token);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Nie udało się zalogować.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-art">
        <Logo />
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <div className="art-copy">
          <h1>Rozmowy, które są naprawdę Twoje.</h1>
          <p>Pisz, wysyłaj i bądź blisko — bez zbędnego hałasu.</p>
        </div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <Logo />
          <p className="eyebrow">
            {register ? "NOWE KONTO" : "WITAJ PONOWNIE"}
          </p>
          <h2>{register ? "Załóż konto" : "Zaloguj się"}</h2>
          {register && (
            <div className="form-row">
              <label>
                Imię
                <input
                  name="firstName"
                  required
                  minLength={2}
                  autoComplete="given-name"
                />
              </label>
              <label>
                Nazwisko
                <input
                  name="lastName"
                  required
                  minLength={2}
                  autoComplete="family-name"
                />
              </label>
            </div>
          )}
          <label>
            Twój tag
            <div className="tag-input">
              <span>@</span>
              <input
                name="tag"
                required
                minLength={3}
                pattern="[A-Za-z0-9_.]+"
                autoComplete="username"
                placeholder="twoj.tag"
              />
            </div>
          </label>
          <label>
            Hasło
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={register ? "new-password" : "current-password"}
              placeholder="Minimum 8 znaków"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={busy}>
            {busy ? "Chwila…" : register ? "Utwórz konto" : "Zaloguj się"}
          </button>
          <p className="auth-switch">
            {register ? "Masz już konto?" : "Nie masz konta?"}{" "}
            <button
              type="button"
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Zaloguj się" : "Zarejestruj się"}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
