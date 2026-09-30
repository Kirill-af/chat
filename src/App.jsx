import { useEffect, useRef, useState } from "react";
import { createClient, humanizeError, sleep } from "./api.js";
import { applyNotification } from "./messages.js";
import { loadChats, loadSession, saveChats, saveSession } from "./storage.js";
import { LoginScreen } from "./components/LoginScreen.jsx";
import { Messenger } from "./components/Messenger.jsx";

export default function App() {
  const [session, setSession] = useState(() => loadSession());
  const [chats, setChats] = useState(() => loadChats(loadSession()?.idInstance));
  const [activeId, setActiveId] = useState(null);
  const [pane, setPane] = useState("list");
  const [warning, setWarning] = useState("");
  const [link, setLink] = useState("connecting");
  const [connectionError, setConnectionError] = useState("");
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    if (!session?.idInstance) return;
    saveChats(session.idInstance, chats);
  }, [session, chats]);

  useEffect(() => {
    if (!session) return undefined;

    const client = createClient(session);
    const controller = new AbortController();
    let stopped = false;

    async function enableIncoming() {
      try {
        const settings = await client.getSettings(controller.signal);
        if (stopped || settings?.incomingWebhook === "yes") return;
        await client.setSettings({ incomingWebhook: "yes" }, controller.signal);
        if (!stopped) {
          setWarning(
            "Включил получение входящих сообщений. Попросите собеседника отправить текст ещё раз: ответ, который уже пришёл в Telegram, в очередь не попал.",
          );
        }
      } catch (error) {
        if (stopped || error.name === "AbortError") return;
        setConnectionError(humanizeError(error));
      }
    }

    async function poll() {
      await enableIncoming();
      while (!stopped) {
        try {
          setLink("online");
          setConnectionError("");
          const notification = await client.receiveNotification(20, controller.signal);
          if (stopped) return;

          if (notification?.receiptId != null) {
            if (notification.body) {
              setChats((prev) => applyNotification(prev, notification, activeIdRef.current));
            }
            if (!stopped) {
              await client.deleteNotification(notification.receiptId, controller.signal);
            }
          }
        } catch (error) {
          if (stopped || error.name === "AbortError") return;
          setLink("error");
          setConnectionError(humanizeError(error));
          try {
            await sleep(4000, controller.signal);
          } catch {
            return;
          }
        }
      }
    }

    poll();

    return () => {
      stopped = true;
      controller.abort();
    };
  }, [session]);

  function handleLogin(nextSession, loginWarning) {
    setSession(nextSession);
    setChats(loadChats(nextSession.idInstance));
    setActiveId(null);
    setPane("list");
    setWarning(loginWarning || "");
    setLink("connecting");
    setConnectionError("");
  }

  function handleLogout() {
    setSession(null);
    setChats([]);
    setActiveId(null);
    setPane("list");
    setWarning("");
    setConnectionError("");
  }

  function handleSelect(id) {
    setActiveId(id);
    setPane("chat");
    setChats((prev) => prev.map((chat) => (chat.id === id ? { ...chat, unread: 0 } : chat)));
  }

  if (!session) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <Messenger
      session={session}
      chats={chats}
      activeId={activeId}
      pane={pane}
      warning={warning}
      link={link}
      connectionError={connectionError}
      onSelect={handleSelect}
      onBack={() => setPane("list")}
      onChats={setChats}
      onLogout={handleLogout}
      onDismissWarning={() => setWarning("")}
    />
  );
}
