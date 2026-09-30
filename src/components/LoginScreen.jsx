import { useState } from "react";
import { createClient, DEFAULT_API_URL, humanizeError } from "../api.js";
import { Logo } from "./Logo.jsx";

export function LoginScreen({ onLogin }) {
  const [idInstance, setIdInstance] = useState("");
  const [apiTokenInstance, setApiTokenInstance] = useState("");
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const id = idInstance.trim();
    const token = apiTokenInstance.trim();
    const url = (apiUrl.trim() || DEFAULT_API_URL).replace(/\/+$/, "");

    if (!/^\d+$/.test(id)) {
      setError("idInstance должен состоять только из цифр.");
      return;
    }

    if (token.length < 10) {
      setError("Вставьте apiTokenInstance из личного кабинета GREEN-API.");
      return;
    }

    setLoading(true);
    try {
      const client = createClient({ apiUrl: url, idInstance: id, apiTokenInstance: token });
      let warning = "";

      try {
        const state = await client.getStateInstance();
        const value = state?.stateInstance;
        if (value && value !== "authorized") {
          warning =
            "Инстанс ещё не авторизован. В личном кабинете GREEN-API получите QR-код и подтвердите вход в приложении MAX.";
        }
      } catch (stateError) {
        if (stateError.status !== 404) throw stateError;
      }

      onLogin({ apiUrl: url, idInstance: id, apiTokenInstance: token }, warning);
    } catch (loginError) {
      setError(humanizeError(loginError) || "Не удалось войти.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <Logo size={52} />
        <h1>Вход в чат MAX</h1>
        <p className="lede">
          Укажите данные инстанса из личного кабинета GREEN-API. Токен остаётся в этом браузере и уходит только в GREEN-API.
        </p>

        <label>
          idInstance
          <input
            name="idInstance"
            inputMode="numeric"
            autoComplete="off"
            value={idInstance}
            onChange={(event) => setIdInstance(event.target.value)}
            placeholder="3100000001"
          />
        </label>

        <label>
          apiTokenInstance
          <span className="token-field">
            <input
              name="apiTokenInstance"
              type={showToken ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              value={apiTokenInstance}
              onChange={(event) => setApiTokenInstance(event.target.value)}
              placeholder="Ключ доступа инстанса"
            />
            <button type="button" className="ghost" onClick={() => setShowToken((value) => !value)}>
              {showToken ? "Скрыть" : "Показать"}
            </button>
          </span>
        </label>

        <label>
          apiUrl
          <input
            name="apiUrl"
            value={apiUrl}
            spellCheck={false}
            onChange={(event) => setApiUrl(event.target.value)}
            placeholder={DEFAULT_API_URL}
          />
        </label>
        <p className="hint">
          Обычно это https://api.green-api.com. Если в кабинете указан другой хост, вставьте его. Для входящих сообщений webhook URL инстанса должен быть пустым.
        </p>

        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}

        <button className="primary" type="submit" disabled={loading}>
          {loading ? "Проверяем инстанс..." : "Войти"}
        </button>
      </form>
    </main>
  );
}
