import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { Conversation, Message, User } from "@chat/shared";
import { io, type Socket } from "socket.io-client";
import {
  Archive,
  Check,
  ChevronRight,
  Forward,
  Info,
  LogOut,
  Menu,
  MessageCircleMore,
  Mic,
  Moon,
  Palette,
  Paperclip,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Square,
  X,
} from "lucide-react";
import { api, API_URL, fetchAttachment, getToken, setToken } from "./api";
import {
  clearPrivateKey,
  createKeyBundle,
  decryptFile,
  decryptText,
  encryptFile,
  encryptText,
  hasPrivateKey,
  storePrivateKey,
  unlockKey,
} from "./e2ee";
import {
  AttachmentView,
  Avatar,
  ConversationRow,
  MediaAttachment,
  mediaTabs,
} from "./components";

const emojis = [
  "😀",
  "😂",
  "😍",
  "🥰",
  "😎",
  "🤔",
  "👍",
  "❤️",
  "🎉",
  "🔥",
  "✨",
  "🙌",
];
const accents = ["#b8a4ff", "#f6a6c1", "#73d9c2", "#82b8ff", "#f2b66d"];

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

function Logo() {
  return (
    <div className="logo">
      <MessageCircleMore size={25} fill="currentColor" />
      <span>halo</span>
    </div>
  );
}

async function decryptMessage(message: Message, conversation: Conversation) {
  const decode = (value: string) =>
    decryptText(value, conversation.id, conversation.participant).catch(
      () => "[nie można odszyfrować]",
    );
  return {
    ...message,
    text: await decode(message.text),
    replyTo: message.replyTo
      ? { ...message.replyTo, text: await decode(message.replyTo.text) }
      : null,
  };
}

function Auth({ onAuth }: { onAuth: (user: User, token: string) => void }) {
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

function Messenger({ user, onLogout }: { user: User; onLogout: () => void }) {
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
      style={
        { "--accent": selected?.accent ?? accents[0] } as React.CSSProperties
      }
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

function Chat({
  conversation,
  messages,
  user,
  typing,
  online,
  socket,
  onInfo,
  onMessage,
}: {
  conversation: Conversation;
  messages: Message[];
  user: User;
  typing: boolean;
  online: boolean;
  socket: Socket | null;
  onInfo: () => void;
  onMessage: (message: Message) => void;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);
  useEffect(
    () => bottom.current?.scrollIntoView({ behavior: "smooth" }),
    [messages, typing],
  );
  const visible = search
    ? messages.filter((message) =>
        message.text
          .toLocaleLowerCase("pl")
          .includes(search.toLocaleLowerCase("pl")),
      )
    : messages;
  function updateText(value: string) {
    setText(value);
    socket?.emit("typing:set", {
      conversationId: conversation.id,
      isTyping: true,
    });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(
      () =>
        socket?.emit("typing:set", {
          conversationId: conversation.id,
          isTyping: false,
        }),
      1200,
    );
  }
  async function send() {
    if ((!text.trim() && !file) || sending) return;
    setSending(true);
    try {
      const encryptedText = await encryptText(
        text,
        conversation.id,
        conversation.participant,
      );
      const encryptedFile = file
        ? await encryptFile(file, conversation.id, conversation.participant)
        : null;
      const message = await api.sendMessage(
        conversation.id,
        encryptedText,
        encryptedFile?.file,
        replyingTo?.id,
        encryptedFile
          ? {
              iv: encryptedFile.iv,
              originalName: encryptedFile.originalName,
              originalMime: encryptedFile.originalMime,
            }
          : undefined,
      );
      onMessage(await decryptMessage(message, conversation));
      setText("");
      setFile(null);
      setReplyingTo(null);
      socket?.emit("typing:set", {
        conversationId: conversation.id,
        isTyping: false,
      });
    } finally {
      setSending(false);
    }
  }
  return (
    <>
      <header className="chat-header">
        <div className="person">
          <Avatar user={conversation.participant} online={online} />
          <div>
            <strong>
              {conversation.participant.firstName}{" "}
              {conversation.participant.lastName}
            </strong>
            <span>
              {online ? "Aktywny teraz" : `@${conversation.participant.tag}`}
            </span>
          </div>
        </div>
        <div className="header-actions">
          {searchOpen && (
            <div className="inline-search">
              <Search size={16} />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Szukaj w rozmowie"
              />
              <button
                onClick={() => {
                  setSearchOpen(false);
                  setSearch("");
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <button
            className="icon-button"
            title="Szukaj"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search />
          </button>
          <button className="icon-button" title="Informacje" onClick={onInfo}>
            <Info />
          </button>
        </div>
      </header>
      <div className="messages">
        {visible.length === 0 && (
          <div className="day-separator">
            {search ? "Brak wyników" : "TO POCZĄTEK ROZMOWY"}
          </div>
        )}
        {visible.map((message, index) => {
          const mine = message.senderId === user.id;
          const showDate =
            index === 0 ||
            new Date(message.createdAt).toDateString() !==
              new Date(visible[index - 1]!.createdAt).toDateString();
          return (
            <div key={message.id}>
              {showDate && (
                <div className="day-separator">
                  {new Date(message.createdAt)
                    .toLocaleDateString("pl", { day: "numeric", month: "long" })
                    .toUpperCase()}
                </div>
              )}
              <div className={`message-line ${mine ? "mine" : ""}`}>
                <div className="message-actions">
                  <button
                    title="Odpowiedz"
                    onClick={() => setReplyingTo(message)}
                  >
                    <Reply />
                  </button>
                  <button
                    title="Przekaż dalej"
                    onClick={() => setForwarding(message)}
                  >
                    <Forward />
                  </button>
                </div>
                <div
                  className="bubble"
                  onDoubleClick={() => void api.react(message.id, "❤️")}
                >
                  {message.forwardedFrom && (
                    <span className="forwarded-label">
                      <Forward /> Przekazano dalej
                    </span>
                  )}
                  {message.replyTo && (
                    <div className="reply-preview">
                      <strong>
                        {message.replyTo.senderId === user.id
                          ? "Ty"
                          : conversation.participant.firstName}
                      </strong>
                      <span>
                        {message.replyTo.text || message.replyTo.attachmentName}
                      </span>
                    </div>
                  )}
                  {message.attachment && (
                    <AttachmentView
                      attachment={message.attachment}
                      conversation={conversation}
                    />
                  )}
                  {message.text && <p>{linkify(message.text)}</p>}
                  <time>
                    {new Date(message.createdAt).toLocaleTimeString("pl", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {mine && <Check size={13} />}
                  </time>
                  <div className="quick-reactions">
                    {["❤️", "👍", "😂"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => void api.react(message.id, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                {Object.entries(message.reactions).length > 0 && (
                  <div className="reaction-list">
                    {Object.entries(message.reactions).map(([emoji, ids]) => (
                      <button
                        key={emoji}
                        className={ids.includes(user.id) ? "reacted" : ""}
                        onClick={() => void api.react(message.id, emoji)}
                      >
                        {emoji} {ids.length}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {typing && (
          <div className="message-line">
            <div className="bubble typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="composer-wrap">
        {replyingTo && (
          <div className="pending-reply">
            <Reply />
            <span>
              <strong>Odpowiadasz</strong>
              {replyingTo.text || replyingTo.attachment?.name}
            </span>
            <button onClick={() => setReplyingTo(null)}>
              <X />
            </button>
          </div>
        )}
        {file && (
          <div className="pending-file">
            <Paperclip size={16} />
            <span>{file.name}</span>
            <button onClick={() => setFile(null)}>
              <X size={16} />
            </button>
          </div>
        )}
        <div className="composer">
          <label className="icon-button" title="Dodaj zdjęcie lub plik">
            <Paperclip />
            <input
              type="file"
              hidden
              accept="image/*,application/pdf,audio/*,.txt,.zip"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <textarea
            rows={1}
            value={text}
            onChange={(e) => updateText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Napisz wiadomość…"
          />
          <div className="emoji-anchor">
            <button
              className="icon-button"
              onClick={() => setEmojiOpen(!emojiOpen)}
            >
              <Smile />
            </button>
            {emojiOpen && (
              <div className="emoji-picker">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setText((current) => current + emoji);
                      setEmojiOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Recorder onRecorded={setFile} />
          <button
            className="send-button"
            disabled={sending || (!text.trim() && !file)}
            onClick={() => void send()}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
      {forwarding && (
        <ForwardDialog
          message={forwarding}
          sourceConversation={conversation}
          onClose={() => setForwarding(null)}
        />
      )}
    </>
  );
}

function ForwardDialog({
  message,
  sourceConversation,
  onClose,
}: {
  message: Message;
  sourceConversation: Conversation;
  onClose: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    api.conversations().then(setConversations).catch(console.error);
  }, []);
  async function forward(conversationId: string) {
    setBusy(conversationId);
    try {
      const target = conversations.find((item) => item.id === conversationId)!;
      const encryptedText = await encryptText(
        message.text,
        target.id,
        target.participant,
      );
      let encryptedAttachment: Awaited<ReturnType<typeof encryptFile>> | null =
        null;
      if (message.attachment) {
        const blob = await fetchAttachment(message.attachment.url);
        const plain = message.attachment.encryptionIv
          ? await decryptFile(
              blob,
              message.attachment.encryptionIv,
              sourceConversation.id,
              sourceConversation.participant,
            )
          : await blob.arrayBuffer();
        encryptedAttachment = await encryptFile(
          new File([plain], message.attachment.name, {
            type: message.attachment.mimeType,
          }),
          target.id,
          target.participant,
        );
      }
      await api.sendMessage(
        target.id,
        encryptedText,
        encryptedAttachment?.file,
        undefined,
        encryptedAttachment
          ? {
              iv: encryptedAttachment.iv,
              originalName: encryptedAttachment.originalName,
              originalMime: encryptedAttachment.originalMime,
            }
          : undefined,
      );
      onClose();
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal forward-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">PRZEKAŻ DALEJ</p>
            <h2>Wybierz rozmowę</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="user-results">
          {conversations.map((item) => (
            <button
              key={item.id}
              disabled={Boolean(busy)}
              onClick={() => void forward(item.id)}
            >
              <Avatar user={item.participant} />
              <span>
                <strong>
                  {item.participant.firstName} {item.participant.lastName}
                </strong>
                <small>@{item.participant.tag}</small>
              </span>
              {busy === item.id ? "…" : <Send />}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Recorder({ onRecorded }: { onRecorded: (file: File) => void }) {
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  async function toggle() {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      recorder.current = new MediaRecorder(stream);
      recorder.current.ondataavailable = (event) => chunks.push(event.data);
      recorder.current.onstop = () => {
        onRecorded(
          new File(chunks, `glosowka-${Date.now()}.webm`, {
            type: "audio/webm",
          }),
        );
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.current.start();
      setRecording(true);
    } catch {
      alert("Przeglądarka nie otrzymała dostępu do mikrofonu.");
    }
  }
  return (
    <button
      className={`icon-button ${recording ? "recording" : ""}`}
      title="Nagraj głosówkę"
      onClick={() => void toggle()}
    >
      {recording ? <Square fill="currentColor" /> : <Mic />}
    </button>
  );
}

function NewChat({
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

function InfoPanel({
  conversation,
  messages,
  onClose,
  onAccent,
}: {
  conversation: Conversation;
  messages: Message[];
  onClose: () => void;
  onAccent: (accent: string) => void;
}) {
  const [tab, setTab] = useState<(typeof mediaTabs)[number]["id"]>("image");
  const links = useMemo(
    () =>
      messages.flatMap(
        (message) => message.text.match(/https?:\/\/[^\s]+/g) ?? [],
      ),
    [messages],
  );
  const attachments = messages.flatMap((message) =>
    message.attachment ? [message.attachment] : [],
  );
  const shown = attachments.filter((item) =>
    tab === "file"
      ? item.kind === "pdf" || item.kind === "file"
      : item.kind === tab,
  );
  return (
    <aside className="info-panel">
      <header>
        <strong>Informacje</strong>
        <button className="icon-button" onClick={onClose}>
          <X />
        </button>
      </header>
      <div className="info-person">
        <Avatar user={conversation.participant} size="lg" />
        <h3>
          {conversation.participant.firstName}{" "}
          {conversation.participant.lastName}
        </h3>
        <span>@{conversation.participant.tag}</span>
      </div>
      <div className="accent-block">
        <p>
          <Palette size={17} /> Kolor rozmowy
        </p>
        <div className="swatches">
          {accents.map((accent) => (
            <button
              key={accent}
              style={{ background: accent }}
              className={conversation.accent === accent ? "selected" : ""}
              onClick={() => onAccent(accent)}
            />
          ))}
        </div>
      </div>
      <nav className="media-tabs">
        {mediaTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>
      <div className={`media-content ${tab === "image" ? "image-grid" : ""}`}>
        {tab === "link"
          ? links.map((link) => (
              <a key={link} href={link} target="_blank" rel="noreferrer">
                {link}
              </a>
            ))
          : shown.map((item) => (
              <MediaAttachment
                key={item.id}
                attachment={item}
                image={item.kind === "image"}
                conversation={conversation}
              />
            ))}
        {(tab === "link" ? links.length === 0 : shown.length === 0) && (
          <p className="no-results">Jeszcze nic tu nie ma.</p>
        )}
      </div>
    </aside>
  );
}

function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={index} href={part} target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  );
}
