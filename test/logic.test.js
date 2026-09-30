import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedPhone, normalizePhone } from "../src/phone.js";
import { applyNotification, mergeStatus } from "../src/messages.js";

test("нормализует российские номера к формату 7XXXXXXXXXX", () => {
  assert.equal(normalizePhone("+7 (999) 123-45-67"), "79991234567");
  assert.equal(normalizePhone("8 999 123 45 67"), "79991234567");
  assert.equal(normalizePhone("9991234567"), "79991234567");
  assert.equal(normalizePhone("375291234567"), "375291234567");
  assert.equal(isSupportedPhone("79991234567"), true);
  assert.equal(isSupportedPhone("375291234567"), true);
  assert.equal(isSupportedPhone("12345"), false);
});

test("кладёт текстовый ответ в уже созданный чат и увеличивает непрочитанные", () => {
  const chats = [
    {
      id: "79991234567",
      chatId: "10000000",
      phone: "79991234567",
      title: "+7 999 123-45-67",
      messages: [],
      unread: 0,
    },
  ];

  const next = applyNotification(chats, incoming("Привет"), null);
  assert.equal(next[0].messages.length, 1);
  assert.equal(next[0].messages[0].text, "Привет");
  assert.equal(next[0].messages[0].direction, "in");
  assert.equal(next[0].title, "Анна");
  assert.equal(next[0].unread, 1);
});

test("своё сообщение из Telegram ставит справа и не переименовывает чужой чат", () => {
  const chats = [
    {
      id: "79835251560",
      chatId: "555",
      phone: "79835251560",
      title: "+7 983 525-15-60",
      messages: [],
      unread: 0,
    },
  ];

  const next = applyNotification(
    chats,
    {
      receiptId: 2,
      body: {
        typeWebhook: "incomingMessageReceived",
        timestamp: 1763115112,
        idMessage: "own-1",
        instanceData: { wid: "79835251560@c.us" },
        senderData: {
          chatId: "555",
          chatType: "user",
          senderName: "Кирилл",
          senderPhoneNumber: 79835251560,
        },
        messageData: { typeMessage: "textMessage", textMessageData: { textMessage: "так" } },
      },
    },
    null,
  );

  assert.equal(next[0].messages[0].direction, "out");
  assert.equal(next[0].title, "+7 983 525-15-60");
  assert.equal(next[0].unread, 0);
});

test("не дублирует сообщение с тем же idMessage", () => {
  const once = applyNotification([], incoming("Раз"), null);
  const twice = applyNotification(once, incoming("Раз"), null);
  assert.equal(twice[0].messages.length, 1);
  assert.equal(twice, once);
});

test("обновляет статус отправки и не понижает прочитанное до отправленного", () => {
  const chats = [
    {
      id: "79991234567",
      chatId: "10000000",
      phone: "79991234567",
      title: "Анна",
      unread: 0,
      messages: [{ id: "55", text: "Ок", direction: "out", time: 1, status: "read" }],
    },
  ];

  const same = applyNotification(
    chats,
    { body: { typeWebhook: "outgoingMessageStatus", idMessage: "55", status: "sent" } },
    null,
  );
  assert.equal(same, chats);

  const failed = applyNotification(
    chats,
    { body: { typeWebhook: "outgoingMessageStatus", idMessage: "55", status: "failed" } },
    null,
  );
  assert.equal(failed[0].messages[0].status, "failed");
  assert.equal(mergeStatus("delivered", "sent"), "delivered");
});

function incoming(text) {
  return {
    receiptId: 1,
    body: {
      typeWebhook: "incomingMessageReceived",
      timestamp: 1763115112,
      idMessage: "msg-1",
      senderData: {
        chatId: "10000000",
        chatName: "Анна",
        chatType: "user",
        senderName: "Анна",
        senderPhoneNumber: 79991234567,
      },
      messageData: {
        typeMessage: "textMessage",
        textMessageData: { textMessage: text },
      },
    },
  };
}
