import { useEffect, useRef, useState } from "react";
import type { Conversation, Message, User } from "@chat/shared";
import type { Socket } from "socket.io-client";
import {
  Check,
  Forward,
  Info,
  Mic,
  Paperclip,
  Reply,
  Search,
  Send,
  Smile,
  Square,
  X,
} from "lucide-react";
import { api, fetchAttachment } from "./api";
import { decryptFile, encryptFile, encryptText } from "./e2ee";
import { AttachmentView, Avatar } from "./components";
import { emojis } from "./constants";
import { decryptMessage } from "./messageCrypto";

export function Chat({
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
