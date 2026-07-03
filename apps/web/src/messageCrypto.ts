import type { Conversation, Message } from "@chat/shared";
import { decryptText } from "./e2ee";

export async function decryptMessage(
  message: Message,
  conversation: Conversation,
) {
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
