import { formatPhone } from "./phone.js";

const STATUS_RANK = {
  pending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

export function mergeStatus(current, next) {
  if (!next) return current || "sent";
  if (next === "failed") return "failed";
  if (current === "failed") return "failed";

  const nextRank = STATUS_RANK[next];
  const currentRank = STATUS_RANK[current] ?? -1;
  if (nextRank == null) return current || "sent";
  return nextRank >= currentRank ? next : current;
}

export function extractText(messageData) {
  if (!messageData) return "";
  if (messageData.typeMessage === "textMessage") {
    return messageData.textMessageData?.textMessage || "";
  }
  if (messageData.typeMessage === "extendedTextMessage") {
    return messageData.extendedTextMessageData?.text || "";
  }
  return "";
}

function toMillis(timestamp) {
  if (!timestamp) return Date.now();
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

function isPersonalChat(sender) {
  return !sender?.chatType || sender.chatType === "user";
}

function accountPhone(body) {
  const wid = body.instanceData?.wid;
  if (!wid) return "";
  return String(wid).split("@")[0].replace(/\D/g, "");
}

function isOwnMessage(body, senderPhone) {
  if (body.typeWebhook === "outgoingMessageReceived" || body.typeWebhook === "outgoingAPIMessageReceived") {
    return true;
  }
  const ownPhone = accountPhone(body);
  return Boolean(ownPhone && senderPhone && ownPhone === senderPhone);
}

function replaceTitle(chat, phone, name) {
  if (!name) return chat.title;
  const generic = new Set([chat.phone, chat.chatId, chat.id, formatPhone(phone || chat.phone)].filter(Boolean));
  if (!chat.title || generic.has(chat.title)) return name;
  return chat.title;
}

export function applyNotification(chats, notification, activeId) {
  const body = notification?.body;
  if (!body || typeof body !== "object") return chats;

  if (body.typeWebhook === "outgoingMessageStatus") {
    return applyOutgoingStatus(chats, body);
  }

  const isIncoming = body.typeWebhook === "incomingMessageReceived";
  const isOutgoing =
    body.typeWebhook === "outgoingMessageReceived" || body.typeWebhook === "outgoingAPIMessageReceived";
  if (!isIncoming && !isOutgoing) return chats;

  const sender = body.senderData || {};
  if (!isPersonalChat(sender)) return chats;

  const text = extractText(body.messageData);
  if (!text.trim()) return chats;

  const chatId = sender.chatId ? String(sender.chatId) : "";
  const phone = sender.senderPhoneNumber ? String(sender.senderPhoneNumber) : "";
  if (!chatId && !phone) return chats;

  const own = isOwnMessage(body, phone);
  const message = {
    id: String(body.idMessage || notification.receiptId),
    text,
    direction: own ? "out" : "in",
    time: toMillis(body.timestamp),
    status: own ? "sent" : "received",
  };

  const index = chats.findIndex((chat) => {
    if (chatId && (chat.chatId === chatId || chat.id === chatId)) return true;
    if (!own && phone && chat.phone === phone) return true;
    return false;
  });

  const name = sender.senderContactName || sender.senderName || sender.chatName || "";

  if (index === -1) {
    const id = phone || chatId;
    return [
      {
        id,
        chatId: chatId || id,
        phone,
        title: name || (phone ? formatPhone(phone) : chatId),
        messages: [message],
        unread: own || id === activeId ? 0 : 1,
      },
      ...chats,
    ];
  }

  const chat = chats[index];
  if (chat.messages.some((item) => item.id === message.id)) return chats;

  const nextChat = {
    ...chat,
    chatId: chat.chatId || chatId,
    phone: own ? chat.phone : chat.phone || phone,
    title: own ? chat.title : replaceTitle(chat, phone, name),
    messages: [...chat.messages, message],
    unread: own || chat.id === activeId ? 0 : (chat.unread || 0) + 1,
  };

  return [nextChat, ...chats.filter((_, itemIndex) => itemIndex !== index)];
}

function applyOutgoingStatus(chats, body) {
  const idMessage = body.idMessage ? String(body.idMessage) : "";
  const status = body.status || body.statusData?.status;
  if (!idMessage || !status) return chats;

  let changed = false;
  const next = chats.map((chat) => {
    let chatChanged = false;
    const messages = chat.messages.map((message) => {
      if (message.id !== idMessage) return message;
      const merged = mergeStatus(message.status, status);
      if (merged === message.status) return message;
      chatChanged = true;
      changed = true;
      return { ...message, status: merged };
    });
    return chatChanged ? { ...chat, messages } : chat;
  });

  return changed ? next : chats;
}

export function createChat({ phone, chatId, title }) {
  return {
    id: phone || String(chatId),
    chatId: String(chatId),
    phone,
    title: title || formatPhone(phone) || String(chatId),
    messages: [],
    unread: 0,
  };
}

export function appendOutgoing(chats, chatLocalId, message) {
  const index = chats.findIndex((chat) => chat.id === chatLocalId);
  if (index === -1) return chats;

  const chat = chats[index];
  const nextChat = {
    ...chat,
    messages: [...chat.messages, message],
  };

  return [nextChat, ...chats.filter((_, itemIndex) => itemIndex !== index)];
}

export function patchMessage(chats, chatLocalId, localMessageId, patch) {
  return chats.map((chat) => {
    if (chat.id !== chatLocalId) return chat;
    return {
      ...chat,
      messages: chat.messages.map((message) => {
        if (message.id !== localMessageId) return message;
        const next = { ...message, ...patch };
        if (patch.status) next.status = mergeStatus(message.status, patch.status);
        return next;
      }),
    };
  });
}
