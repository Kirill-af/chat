export const DEFAULT_API_URL = "https://api.green-api.com";

function trimUrl(url) {
  return String(url || DEFAULT_API_URL).trim().replace(/\/+$/, "");
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(data, response) {
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object") {
    return data.message || data.reason || data.error || data.description || response.statusText;
  }
  return response.statusText || `Ошибка ${response.status}`;
}

export function humanizeError(error) {
  if (!error || error.name === "AbortError") return "";

  const raw = String(error.message || "");
  if (error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(raw)) {
    return "Нет соединения с GREEN-API. Проверьте интернет и адрес apiUrl: запросы уходят из браузера напрямую.";
  }

  if (/webhook/i.test(raw)) {
    return "В личном кабинете GREEN-API заполнен webhook URL. Очистите его и подождите около минуты: входящие через HTTP API приходят только при пустом webhook.";
  }

  if (error.status === 401 || error.status === 403) {
    return "GREEN-API отклонил доступ. Проверьте idInstance и apiTokenInstance.";
  }

  if (/idInstance/i.test(raw)) {
    return "Некорректный idInstance. Он должен состоять только из цифр.";
  }

  if (/apiTokenInstance/i.test(raw)) {
    return "Не указан apiTokenInstance.";
  }

  return raw || "Неизвестная ошибка GREEN-API.";
}

export function createClient({ apiUrl, idInstance, apiTokenInstance }) {
  const root = `${trimUrl(apiUrl)}/waInstance${idInstance}`;

  async function request(path, { method = "GET", body, signal } = {}) {
    const response = await fetch(`${root}${path}`, {
      method,
      signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await readBody(response);
    if (!response.ok) {
      const error = new Error(errorMessage(data, response));
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  return {
    getStateInstance(signal) {
      return request(`/getStateInstance/${apiTokenInstance}`, { signal });
    },

    getSettings(signal) {
      return request(`/getSettings/${apiTokenInstance}`, { signal });
    },

    setSettings(settings, signal) {
      return request(`/setSettings/${apiTokenInstance}`, {
        method: "POST",
        body: settings,
        signal,
      });
    },

    checkAccount(phoneNumber, signal) {
      return request(`/checkAccount/${apiTokenInstance}`, {
        method: "POST",
        body: { phoneNumber: Number(phoneNumber) },
        signal,
      });
    },

    sendMessage(chatId, message, signal) {
      return request(`/sendMessage/${apiTokenInstance}`, {
        method: "POST",
        body: { chatId, message },
        signal,
      });
    },

    receiveNotification(timeoutSeconds, signal) {
      const timeout = timeoutSeconds ?? 20;
      return request(`/receiveNotification/${apiTokenInstance}?receiveTimeout=${timeout}`, { signal });
    },

    deleteNotification(receiptId, signal) {
      return request(`/deleteNotification/${apiTokenInstance}/${receiptId}`, {
        method: "DELETE",
        signal,
      });
    },
  };
}

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
