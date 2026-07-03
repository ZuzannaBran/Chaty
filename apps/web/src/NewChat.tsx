import { useEffect, useState } from "react";
import type { Conversation, User } from "@chat/shared";
import { ChevronRight, Search, X } from "lucide-react";
import { api } from "./api";
import { Avatar } from "./components";

export function NewChat({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (query.length < 2) {
      setUsers([]);
      return;
    }
    const timer = setTimeout(
      () =>
        api
          .searchUsers(query)
          .then(setUsers)
          .catch(() => setUsers([])),
      250,
    );
    return () => clearTimeout(timer);
  }, [query]);
  async function create(tag: string) {
    try {
      onCreated(await api.createConversation(tag));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Nie udało się utworzyć rozmowy.",
      );
    }
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <div>
            <p className="eyebrow">NOWA ROZMOWA</p>
            <h2>Znajdź osobę</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X />
          </button>
        </header>
        <label className="big-search">
          <span>@</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value.replace(/^@/, ""))}
            placeholder="wpisz tag użytkownika"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="user-results">
          {users.map((result) => (
            <button key={result.id} onClick={() => void create(result.tag)}>
              <Avatar user={result} />
              <span>
                <strong>
                  {result.firstName} {result.lastName}
                </strong>
                <small>@{result.tag}</small>
              </span>
              <ChevronRight />
            </button>
          ))}
          {query.length >= 2 && users.length === 0 && (
            <p className="no-results">Brak pasujących użytkowników.</p>
          )}
        </div>
      </section>
    </div>
  );
}
