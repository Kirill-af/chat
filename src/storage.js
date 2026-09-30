const STORAGE_KEY = "max-green-chat";

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadSession() {
  const session = read().session;
  if (!session?.idInstance || !session?.apiTokenInstance) return null;
  return {
    apiUrl: session.apiUrl || "https://api.green-api.com",
    idInstance: String(session.idInstance),
    apiTokenInstance: String(session.apiTokenInstance),
  };
}

export function saveSession(session) {
  const data = read();
  data.session = session;
  write(data);
}

export function loadChats(idInstance) {
  if (!idInstance) return [];
  const chats = read().chats?.[idInstance];
  return Array.isArray(chats) ? chats : [];
}

export function saveChats(idInstance, chats) {
  if (!idInstance) return;
  const data = read();
  data.chats = data.chats || {};
  data.chats[idInstance] = chats;
  write(data);
}
