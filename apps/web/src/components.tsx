import { useEffect, useState } from "react";
import type { Attachment, Conversation, User } from "@chat/shared";
import { FileText, Image as ImageIcon, Link2, Mic } from "lucide-react";
import { fetchAttachment } from "./api";
import { decryptFile } from "./e2ee";

export function Avatar({
  user,
  size = "md",
  online,
}: {
  user: User;
  size?: "sm" | "md" | "lg";
  online?: boolean;
}) {
  return (
    <div
      className={`avatar avatar-${size}`}
      style={{ background: user.avatarColor }}
      aria-label={`${user.firstName} ${user.lastName}`}
    >
      {user.firstName[0]}
      {user.lastName[0]}
      {online !== undefined && (
        <span className={`presence ${online ? "online" : ""}`} />
      )}
    </div>
  );
}

export function ConversationRow({
  conversation,
  active,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const message = conversation.lastMessage;
  const preview = message?.attachment
    ? `${message.attachment.kind === "image" ? "📷" : message.attachment.kind === "audio" ? "🎙️" : "📎"} ${message.attachment.name}`
    : message?.text || "Rozpocznij rozmowę";
  return (
    <button
      className={`conversation-row ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <Avatar user={conversation.participant} />
      <span className="conversation-copy">
        <span className="row-title">
          {conversation.participant.firstName}{" "}
          {conversation.participant.lastName}
        </span>
        <span className="preview">{preview}</span>
      </span>
      <span className="row-meta">
        {message &&
          new Date(message.createdAt).toLocaleTimeString("pl", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        {conversation.unreadCount > 0 && <b>{conversation.unreadCount}</b>}
      </span>
    </button>
  );
}

export function AttachmentView({
  attachment,
  conversation,
}: {
  attachment: Attachment;
  conversation: Conversation;
}) {
  const url = useAttachmentUrl(attachment, conversation);
  if (!url)
    return <span className="attachment-loading">Ładowanie załącznika…</span>;
  if (attachment.kind === "image")
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img className="message-image" src={url} alt={attachment.name} />
      </a>
    );
  if (attachment.kind === "audio")
    return <audio className="message-audio" controls src={url} />;
  return (
    <a
      className="file-card"
      href={url}
      target="_blank"
      rel="noreferrer"
      download
    >
      <FileText size={22} />
      <span>
        <strong>{attachment.name}</strong>
        <small>{formatBytes(attachment.size)}</small>
      </span>
    </a>
  );
}

export function useAttachmentUrl(
  attachment: Attachment,
  conversation: Conversation,
) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    fetchAttachment(attachment.url)
      .then(async (blob) =>
        attachment.encryptionIv
          ? new Blob(
              [
                await decryptFile(
                  blob,
                  attachment.encryptionIv,
                  conversation.id,
                  conversation.participant,
                ),
              ],
              { type: attachment.mimeType },
            )
          : blob,
      )
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setUrl("");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    attachment.url,
    attachment.encryptionIv,
    attachment.mimeType,
    conversation.id,
    conversation.participant,
  ]);
  return url;
}

export function MediaAttachment({
  attachment,
  image = false,
  conversation,
}: {
  attachment: Attachment;
  image?: boolean;
  conversation: Conversation;
}) {
  const url = useAttachmentUrl(attachment, conversation);
  if (!url) return <span className="attachment-loading">Ładowanie…</span>;
  return image ? (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={attachment.name} />
    </a>
  ) : (
    <a className="media-file" href={url} target="_blank" rel="noreferrer">
      <FileText />
      <span>{attachment.name}</span>
    </a>
  );
}

export const formatBytes = (size: number) =>
  size < 1024 * 1024
    ? `${Math.ceil(size / 1024)} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;
export const mediaTabs = [
  { id: "image", label: "Zdjęcia", icon: ImageIcon },
  { id: "file", label: "Pliki", icon: FileText },
  { id: "link", label: "Linki", icon: Link2 },
  { id: "audio", label: "Głosówki", icon: Mic },
] as const;
