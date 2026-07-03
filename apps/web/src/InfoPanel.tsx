import { useMemo, useState } from "react";
import type { Conversation, Message } from "@chat/shared";
import { Palette, X } from "lucide-react";
import { Avatar, MediaAttachment, mediaTabs } from "./components";
import { accents } from "./constants";

export function InfoPanel({
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
