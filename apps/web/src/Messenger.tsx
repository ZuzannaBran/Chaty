import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { Conversation, Message, User } from "@chat/shared";
import { io, type Socket } from "socket.io-client";
import {
  Archive,
  LogOut,
  Menu,
  MessageCircleMore,
  Moon,
  Plus,
  Search,
  X,
} from "lucide-react";
import { api, API_URL, getToken } from "./api";
import { Avatar, ConversationRow } from "./components";
import { accents } from "./constants";
import { decryptMessage } from "./messageCrypto";
import { Logo } from "./Logo";
import { Chat } from "./Chat";
import { InfoPanel } from "./InfoPanel";
import { NewChat } from "./NewChat";

export function Messenger({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [newChat, setNewChat] = useState(false);
  const [info, setInfo] = useState(false);
  const [mobileList, setMobileList] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const [conversationSearch, setConversationSearch] = useState("");
  const selectedIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  const selected = conversations.find((item) => item.id === selectedId) ?? null;
  const refresh = useCallback(
    () =>
      api
        .conversations()
        .then(async (items) =>
          setConversations(
            await Promise.all(
              items.map(async (item) => ({
                ...item,
                lastMessage: item.lastMessage
                  ? await decryptMessage(item.lastMessage, item)
                  : null,
              })),
            ),
          ),
        )
        .catch(console.error),
    [],
  );
  useEffect(() => {
    refresh();
    const socket = io(API_URL, { auth: { token: getToken() } });
    socketRef.current = socket;
    socket.on("message:new", (message: Message) => {
      if (message.conversationId === selectedIdRef.current) {
        const conversation = conversationsRef.current.find(
          (item) => item.id === message.conversationId,
        );
        if (conversation)
          void decryptMessage(message, conversation).then((decoded) =>
            setMessages((current) =>
              current.some((item) => item.id === decoded.id)
                ? current
                : [...current, decoded],
            ),
          );
      }
      refresh();
    });
    socket.on("message:reaction", (message: Message) => {
      const conversation = conversationsRef.current.find(
        (item) => item.id === message.conversationId,
      );
      if (conversation)
        void decryptMessage(message, conversation).then((decoded) =>
          setMessages((current) =>
            current.map((item) => (item.id === decoded.id ? decoded : item)),
          ),
        );
    });
    socket.on("conversation:new", refresh);
    socket.on(
      "typing:update",
      (payload: { conversationId: string; isTyping: boolean }) => {
        if (payload.conversationId === selectedIdRef.current)
          setTyping(payload.isTyping);
      },
    );
    socket.on(
      "presence:update",
      ({ userId, online: value }: { userId: string; online: boolean }) =>
        setOnline((current) => {
          const next = new Set(current);
          value ? next.add(userId) : next.delete(userId);
          return next;
        }),
    );
    return () => {
      socket.disconnect();
    };
  }, [refresh]);
  useEffect(() => {
    const previous = selectedIdRef.current;
    if (previous) socketRef.current?.emit("conversation:leave", previous);
    selectedIdRef.current = selectedId;
    setTyping(false);
    if (!selectedId) return;
    const conversation = conversationsRef.current.find(
      (item) => item.id === selectedId,
    );
    if (conversation)
      api
        .messages(selectedId)
        .then((items) =>
          Promise.all(items.map((item) => decryptMessage(item, conversation))),
        )
        .then(setMessages)
        .catch(console.error);
    api.read(selectedId).then(refresh).catch(console.error);
    socketRef.current?.emit("conversation:join", selectedId);
  }, [selectedId, refresh]);
  const filteredConversations = conversations.filter((item) =>
    `${item.participant.firstName} ${item.participant.lastName} @${item.participant.tag}`
      .toLocaleLowerCase("pl")
      .includes(conversationSearch.toLocaleLowerCase("pl")),
  );
  const choose = (id: string) => {
    setSelectedId(id);
    setMobileList(false);
  };
  return (
    <main
      className="app-shell"
      style={{ "--accent": selected?.accent ?? accents[0] } as CSSProperties}
    >
      <aside className={`sidebar ${mobileList ? "mobile-open" : ""}`}>
        <header>
          <Logo />
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileList(false)}
          >
            <X />
          </button>
        </header>
        <div className="profile">
          <Avatar user={user} />
          <div>
            <strong>
              {user.firstName} {user.lastName}
            </strong>
            <span>@{user.tag}</span>
          </div>
          <button className="icon-button" title="Wyloguj" onClick={onLogout}>
            <LogOut size={18} />
          </button>
        </div>
        <button className="new-message" onClick={() => setNewChat(true)}>
          <Plus size={19} /> Nowa wiadomość
        </button>
        <div className="search-box">
          <Search size={18} />
          <input
            value={conversationSearch}
            onChange={(event) => setConversationSearch(event.target.value)}
            placeholder="Szukaj rozmowy"
          />
        </div>
        <p className="list-label">WIADOMOŚCI</p>
        <div className="conversation-list">
          {filteredConversations.length ? (
            filteredConversations.map((item) => (
              <ConversationRow
                key={item.id}
                conversation={item}
                active={item.id === selectedId}
                onClick={() => choose(item.id)}
              />
            ))
          ) : (
            <div className="empty-list">
              <MessageCircleMore />
              <p>{conversationSearch ? "Brak wyników" : "Jeszcze tu cicho"}</p>
              <span>
                {conversationSearch
                  ? "Zmień wyszukiwaną frazę."
                  : "Dodaj osobę po tagu i napisz pierwszą wiadomość."}
              </span>
            </div>
          )}
        </div>
        <footer>
          <button>
            <Archive size={18} /> Archiwum
          </button>
          <button>
            <Moon size={18} /> Tryb ciemny{" "}
            <span className="always-on">włączony</span>
          </button>
        </footer>
      </aside>
      <section className="chat-area">
        <button
          className="icon-button mobile-menu"
          onClick={() => setMobileList(true)}
        >
          <Menu />
        </button>
        {selected ? (
          <Chat
            conversation={selected}
            messages={messages}
            user={user}
            typing={typing}
            online={online.has(selected.participant.id)}
            socket={socketRef.current}
            onInfo={() => setInfo(!info)}
            onMessage={(message) =>
              setMessages((current) =>
                current.some((item) => item.id === message.id)
                  ? current
                  : [...current, message],
              )
            }
          />
        ) : (
          <div className="empty-chat">
            <div className="empty-bubble">
              <MessageCircleMore size={42} />
            </div>
            <h2>Wybierz rozmowę</h2>
            <p>albo zacznij nową, dodając osobę po jej tagu.</p>
            <button
              className="primary compact"
              onClick={() => setNewChat(true)}
            >
              <Plus /> Nowa wiadomość
            </button>
          </div>
        )}
      </section>
      {selected && info && (
        <InfoPanel
          conversation={selected}
          messages={messages}
          onClose={() => setInfo(false)}
          onAccent={async (accent) => {
            const updated = await api.updateAccent(selected.id, accent);
            setConversations((items) =>
              items.map((item) => (item.id === updated.id ? updated : item)),
            );
          }}
        />
      )}
      {newChat && (
        <NewChat
          onClose={() => setNewChat(false)}
          onCreated={(conversation) => {
            setConversations((items) => [
              conversation,
              ...items.filter((item) => item.id !== conversation.id),
            ]);
            choose(conversation.id);
            setNewChat(false);
          }}
        />
      )}
    </main>
  );
}
