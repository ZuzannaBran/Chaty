import { useEffect, useState } from "react";
import type { User } from "@chat/shared";
import { api, getToken, setToken } from "./api";
import { clearPrivateKey, hasPrivateKey } from "./e2ee";
import { Auth } from "./Auth";
import { Logo } from "./Logo";
import { Messenger } from "./Messenger";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken() || !hasPrivateKey()) {
      if (getToken()) setToken(null);
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="splash">
        <Logo />
        <span className="loader" />
      </div>
    );

  if (!user)
    return (
      <Auth
        onAuth={(nextUser, token) => {
          setToken(token);
          setUser(nextUser);
        }}
      />
    );

  return (
    <Messenger
      user={user}
      onLogout={() => {
        setToken(null);
        clearPrivateKey();
        setUser(null);
      }}
    />
  );
}
