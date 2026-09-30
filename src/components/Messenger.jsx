import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, humanizeError } from "../api.js";
import { formatPhone, isSupportedPhone, normalizePhone } from "../phone.js";
import { appendOutgoing, createChat, patchMessage } from "../messages.js";
import { Logo } from "./Logo.jsx";

const AVATAR_COLORS = ["#0B63D6", "#067647", "#5925DC", "#B54708", "#B42318", "#026AA2"];

function colorFor(id) {
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(chat) {
  const words = String(chat.title || "")
    .replace(/[^A-Za-zА-Яа-яЁё]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  if (words.length === 1) return words[0][0].toUpperCase();

  const digits = String(chat.phone || "").replace(/\D/g, "").slice(-2);
  return digits || "?";
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const startOf = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = startOf(today) - startOf(date);
  if (diff === 0) return "Сегодня";
  if (diff === 24 * 60 * 60 * 1000) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function preview(chat) {
  const last = chat.messages[chat.messages.length - 1];
  return last?.text || "Нет сообщений";
}

function StatusIcon({ status }) {
  if (status === "pending") return <span className="ticks">…</span>;
  if (status === "failed") return <span className="ticks failed">!</span>;
  if (status === "read" || status === "delivered") {
    return <span className={`ticks ${status}`}>✓✓</span>;
  }
  return <span className="ticks">✓</span>;
}

export function Messenger({
  session,
  chats,
  activeId,
  pane,
  warning,
  link,
  connectionError,
  onSelect,
  onBack,
  onChats,
  onLogout,
  onDismissWarning,
}) {
  const active = chats.find((chat) => chat.id === activeId) || null;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const bottomRef = useRef(null);
  const sendingRef = useRef(false);
  const closeModal = useCallback(() => setModalOpen(false), []);

  useEffect(() => {
    setDraft("");
    setSendError("");
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [active?.messages.length, activeId]);

  async function handleSend(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!active || !text || sendingRef.current) return;
    if (text.length > 4000) {
      setSendError("Сообщение длиннее 4000 символов.");
      return;
    }

    const localId = `local-${crypto.randomUUID()}`;
    sendingRef.current = true;
    setSending(true);
    setSendError("");
    setDraft("");
    onChats((prev) =>
      appendOutgoing(prev, active.id, {
        id: localId,
        text,
        direction: "out",
        time: Date.now(),
        status: "pending",
      }),
    );

    try {
      const client = createClient(session);
      const result = await client.sendMessage(active.chatId, text);
      onChats((prev) =>
        patchMessage(prev, active.id, localId, {
          id: String(result?.idMessage || localId),
          status: "sent",
        }),
      );
    } catch (error) {
      onChats((prev) => patchMessage(prev, active.id, localId, { status: "failed" }));
      setSendError(humanizeError(error) || "Не удалось отправить сообщение.");
      setDraft(text);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function handleDraftKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const linkLabel = link === "online" ? "На связи" : link === "error" ? "Нет связи" : "Подключение";

  return (
    <div className={`shell ${pane === "chat" ? "is-chat" : ""}`}>
      <aside className="sidebar">
        <header className="sidebar-head">
          <div className="brand">
            <Logo size={36} />
            <div>
              <strong>Чаты</strong>
              <span className={`link-state ${link}`}>{linkLabel}</span>
            </div>
          </div>
          <button type="button" className="ghost" onClick={onLogout}>
            Выйти
          </button>
        </header>

        <button type="button" className="primary new-chat" onClick={() => setModalOpen(true)}>
          Новый чат
        </button>

        {warning ? (
          <div className="banner">
            <p>{warning}</p>
            <button type="button" className="ghost" onClick={onDismissWarning}>
              Скрыть
            </button>
          </div>
        ) : null}

        {connectionError ? <p className="banner error">{connectionError}</p> : null}

        <ul className="chat-list">
          {chats.length === 0 ? <li className="empty-list">Чатов пока нет. Создайте диалог по номеру телефона.</li> : null}
          {chats.map((chat) => (
            <li key={chat.id}>
              <button
                type="button"
                className={`chat-row ${chat.id === activeId ? "active" : ""}`}
                onClick={() => onSelect(chat.id)}
              >
                <span className="avatar" style={{ background: colorFor(chat.id) }}>
                  {initials(chat)}
                </span>
                <span className="chat-copy">
                  <span className="chat-title">{chat.title}</span>
                  <span className="chat-preview">{preview(chat)}</span>
                </span>
                {chat.unread > 0 ? <span className="unread">{chat.unread}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="conversation">
        {active ? (
          <>
            <header className="conversation-head">
              <button type="button" className="ghost back" onClick={onBack}>
                Назад
              </button>
              <span className="avatar" style={{ background: colorFor(active.id) }}>
                {initials(active)}
              </span>
              <div>
                <strong>{active.title}</strong>
                <span className="chat-sub">{active.phone ? formatPhone(active.phone) : "Личный чат"}</span>
              </div>
            </header>

            <div className="messages">
              <MessageList messages={active.messages} />
              <div ref={bottomRef} />
            </div>

            <form className="composer" onSubmit={handleSend}>
              <textarea
                rows={1}
                value={draft}
                maxLength={4000}
                placeholder="Сообщение"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleDraftKeyDown}
              />
              <button className="primary send" type="submit" disabled={sending || !draft.trim()}>
                Отправить
              </button>
              {sendError ? (
                <p className="alert" role="alert">
                  {sendError}
                </p>
              ) : null}
            </form>
          </>
        ) : (
          <div className="placeholder">
            <Logo size={56} />
            <h2>Выберите чат</h2>
            <p>Создайте диалог по номеру телефона и отправьте текстовое сообщение в MAX.</p>
          </div>
        )}
      </section>

      {modalOpen ? (
        <NewChatModal
          session={session}
          chats={chats}
          onClose={closeModal}
          onCreate={(chat) => {
            onChats((prev) => [chat, ...prev.filter((item) => item.id !== chat.id)]);
            onSelect(chat.id);
            setModalOpen(false);
          }}
          onSelectExisting={(id) => {
            onSelect(id);
            setModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function MessageList({ messages }) {
  let previousDay = "";

  return messages.map((message) => {
    const day = dayLabel(message.time);
    const showDay = day !== previousDay;
    previousDay = day;

    return (
      <div key={message.id} className="message-block">
        {showDay ? <div className="day">{day}</div> : null}
        <article className={`bubble ${message.direction} ${message.status === "failed" ? "is-failed" : ""}`}>
          <p>{message.text}</p>
          <span className="meta">
            <time dateTime={new Date(message.time).toISOString()}>{formatTime(message.time)}</time>
            {message.direction === "out" ? <StatusIcon status={message.status} /> : null}
          </span>
        </article>
      </div>
    );
  });
}

function NewChatModal({ session, chats, onClose, onCreate, onSelectExisting }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const digits = normalizePhone(phone);
    if (!isSupportedPhone(digits)) {
      setError("Нужен номер РФ (11 цифр, код 7) или РБ (12 цифр, код 375).");
      return;
    }

    const existing = chats.find((chat) => chat.phone === digits);
    if (existing) {
      onSelectExisting(existing.id);
      return;
    }

    setLoading(true);
    try {
      const client = createClient(session);
      const result = await client.checkAccount(digits);
      if (result?.status === false) {
        throw new Error(result.reason || "Не удалось проверить номер.");
      }
      if (!result?.exist || !result.chatId) {
        throw new Error("На этом номере нет аккаунта MAX.");
      }

      onCreate(createChat({ phone: digits, chatId: result.chatId, title: formatPhone(digits) }));
    } catch (checkError) {
      const raw = checkError.message || "";
      if (/not authorized|starting/i.test(raw)) {
        setError("Инстанс не авторизован или ещё запускается. Подтвердите QR-код в личном кабинете GREEN-API.");
      } else if (/limit/i.test(raw)) {
        setError("MAX временно ограничил проверку номеров. Подождите и попробуйте снова.");
      } else {
        setError(humanizeError(checkError) || "Не удалось создать чат.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
        <h2>Новый чат</h2>
        <p className="hint">Введите номер получателя. Мы проверим, что на нём есть MAX, и получим идентификатор чата.</p>
        <label>
          Номер телефона
          <input
            ref={inputRef}
            name="phone"
            inputMode="tel"
            autoComplete="off"
            placeholder="79991234567"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Отмена
          </button>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Проверяем..." : "Создать чат"}
          </button>
        </div>
      </form>
    </div>
  );
}
