const S = require("./salon");
const { esc } = require("./tg");
const sheet = require("./sheet");

// ---------- helpers ----------
const WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const allServices = () => S.categories.flatMap((c) => c.services.map((s) => ({ ...s, cat: c.id })));
const svcById = (id) => allServices().find((s) => s.id === id);
const catById = (id) => S.categories.find((c) => c.id === id);
const money = (n) => `${n.toLocaleString("ru-RU").replace(/ /g, " ")} ${S.currency}`;
const dur = (m) => (m < 60 ? `${m} мин` : m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч`);

const localNow = () => new Date(Date.now() + S.tzOffset * 3600e3); // читать только UTC-геттерами
const dayKey = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
const parseKey = (k) => new Date(Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8)));
const isValidKey = (k) => /^\d{8}$/.test(k || "");
const fmtDate = (k) => `${k.slice(6, 8)}.${k.slice(4, 6)}.${k.slice(0, 4)}`;

function dayLabel(k) {
  const d = parseKey(k);
  const today = dayKey(localNow());
  const tomorrow = dayKey(new Date(localNow().getTime() + 864e5));
  const pre = k === today ? "Сегодня" : k === tomorrow ? "Завтра" : WD[d.getUTCDay()];
  return `${pre}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

function hash(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Свободные слоты. В демо часть времени "занята" псевдослучайно, чтобы выглядело живо.
function slots(svc, k) {
  const now = localNow();
  const isToday = k === dayKey(now);
  const last = S.close - Math.ceil(svc.min / 60);
  const out = [];
  for (let h = S.open; h <= last; h++) {
    if (isToday && h <= now.getUTCHours()) continue;
    if (hash(k + svc.id + h) % 3 === 0) continue;
    out.push(h);
  }
  return out;
}

function days(svc) {
  const out = [];
  for (let i = 0; i < S.daysAhead; i++) {
    const k = dayKey(new Date(localNow().getTime() + i * 864e5));
    if (slots(svc, k).length) out.push(k);
  }
  return out;
}

const btn = (text, data) => ({ text, callback_data: data });
const kb = (rows) => ({ inline_keyboard: rows });
const chunk = (arr, n) => arr.reduce((a, x, i) => (i % n ? a[a.length - 1].push(x) : a.push([x]), a), []);
const fullName = (u) => [u.first_name, u.last_name].filter(Boolean).join(" ") || "Клиент";
const who = (u) => `${esc(fullName(u))}${u.username ? ` (@${esc(u.username)})` : ""}`;
const hh = (h) => `${String(h).padStart(2, "0")}:00`;

// ---------- screens ----------
const MENU_BTN = [btn("В меню", "m")];

function scrMain(u) {
  return {
    text:
      `Здравствуйте${u ? `, ${esc(u.first_name || "")}` : ""}! Это бот студии красоты «${esc(S.name)}».\n\n` +
      `Здесь можно посмотреть цены, записаться на удобное время и задать вопрос. Отвечаю круглосуточно.`,
    kb: kb([
      [btn("Записаться", "bk")],
      [btn("Услуги и цены", "p")],
      [btn("Частые вопросы", "faq"), btn("Адрес и контакты", "addr")],
      [btn("Связаться с администратором", "hum")],
    ]),
  };
}

function scrPrices() {
  return {
    text: "Выберите направление:",
    kb: kb([...S.categories.map((c) => [btn(c.title, `pc:${c.id}`)]), MENU_BTN]),
  };
}

function scrPriceCat(cid) {
  const c = catById(cid);
  if (!c) return scrPrices();
  const lines = c.services.map((s) => `• ${esc(s.title)}: <b>${money(s.price)}</b>, ${dur(s.min)}`);
  return {
    text: `<b>${esc(c.title)}</b>\n\n${lines.join("\n")}`,
    kb: kb([...c.services.map((s) => [btn(`Записаться: ${s.title}`, `bs:${s.id}`)]), [btn("Назад", "p")], MENU_BTN]),
  };
}

function scrBook() {
  return {
    text: "На какую услугу вас записать?",
    kb: kb([...S.categories.map((c) => [btn(c.title, `bc:${c.id}`)]), MENU_BTN]),
  };
}

function scrBookCat(cid) {
  const c = catById(cid);
  if (!c) return scrBook();
  return {
    text: `<b>${esc(c.title)}</b>\nВыберите услугу:`,
    kb: kb([...c.services.map((s) => [btn(`${s.title} · ${money(s.price)}`, `bs:${s.id}`)]), [btn("Назад", "bk")]]),
  };
}

function scrDay(sid) {
  const s = svcById(sid);
  if (!s) return scrBook();
  const ds = days(s);
  return {
    text: `<b>${esc(s.title)}</b>, ${money(s.price)}, ${dur(s.min)}\n\nВыберите день:`,
    kb: kb([...chunk(ds.map((k) => btn(dayLabel(k), `bd:${sid}:${k}`)), 2), [btn("Назад", `bc:${s.cat}`)]]),
  };
}

function scrTime(sid, k) {
  const s = svcById(sid);
  if (!s || !isValidKey(k)) return scrBook();
  const sl = slots(s, k);
  if (!sl.length) return { text: "На этот день мест уже нет. Выберите другой:", kb: scrDay(sid).kb };
  return {
    text: `<b>${esc(s.title)}</b>\n${dayLabel(k)}\n\nСвободное время:`,
    kb: kb([...chunk(sl.map((h) => btn(hh(h), `bt:${sid}:${k}:${h}`)), 4), [btn("Другой день", `bs:${sid}`)]]),
  };
}

function bookingLines(s, k, h) {
  return `Услуга: ${esc(s.title)}\nДата: ${dayLabel(k)}\nВремя: ${hh(h)}\nСтоимость: ${money(s.price)}`;
}

function scrConfirm(sid, k, h) {
  const s = svcById(sid);
  if (!s || !isValidKey(k)) return scrBook();
  return {
    text: `Проверьте, пожалуйста:\n\n${bookingLines(s, k, h)}\n\nВсе верно?`,
    kb: kb([[btn("Подтвердить запись", `ok:${sid}:${k}:${h}`)], [btn("Выбрать другое время", `bd:${sid}:${k}`)]]),
  };
}

function scrFaq() {
  return {
    text: "Частые вопросы. Или просто напишите свой вопрос в чат.",
    kb: kb([...S.faq.map((f, i) => [btn(f.q, `fq:${i}`)]), MENU_BTN]),
  };
}

function scrFaqAnswer(i) {
  const f = S.faq[i];
  if (!f) return scrFaq();
  return {
    text: `<b>${esc(f.q)}</b>\n\n${esc(f.a)}`,
    kb: kb([[btn("Записаться", "bk")], [btn("Другие вопросы", "faq")], MENU_BTN]),
  };
}

function scrAddr() {
  return {
    text: `<b>${esc(S.name)}</b>\n\nАдрес: ${esc(S.address)}\nГрафик: ${esc(S.hoursText)}\nТелефон: ${esc(S.phone)}`,
    kb: kb([[btn("Записаться", "bk")], MENU_BTN]),
  };
}

// ---------- admin ----------
async function notifyAdmin(tg, clientChatId, text, markup) {
  const adminId = process.env.ADMIN_CHAT_ID;
  const preview = !adminId || process.env.DEMO_PREVIEW === "1";
  if (adminId) {
    await tg.call("sendMessage", { chat_id: adminId, text, parse_mode: "HTML", reply_markup: markup });
  }
  if (preview && String(adminId) !== String(clientChatId)) {
    await tg.call("sendMessage", {
      chat_id: clientChatId,
      text: `<i>Демо: так это сообщение видит администратор салона</i>\n\n${text}`,
      parse_mode: "HTML",
      reply_markup: markup,
    });
  }
}

// ---------- routing ----------
function route(data, u) {
  const [a, b, c, d] = data.split(":");
  switch (a) {
    case "m": return scrMain(u);
    case "p": return scrPrices();
    case "pc": return scrPriceCat(b);
    case "bk": return scrBook();
    case "bc": return scrBookCat(b);
    case "bs": return scrDay(b);
    case "bd": return scrTime(b, c);
    case "bt": return scrConfirm(b, c, +d);
    case "faq": return scrFaq();
    case "fq": return scrFaqAnswer(+b);
    case "addr": return scrAddr();
    default: return null;
  }
}

async function onCallback(tg, q) {
  const data = q.data || "";
  const u = q.from;
  const chatId = q.message.chat.id;
  const msgId = q.message.message_id;
  const [a, b, c, d, e] = data.split(":");
  await tg.call("answerCallbackQuery", { callback_query_id: q.id });

  // клиент подтвердил запись
  if (a === "ok") {
    const s = svcById(b);
    if (!s || !isValidKey(c)) return;
    await tg.call("editMessageText", {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      text: `Заявка отправлена администратору!\n\n${bookingLines(s, c, +d)}\n\nКак только администратор подтвердит время, я сразу напишу вам здесь.`,
      reply_markup: kb([[btn("Оставить телефон для связи", "ph")], MENU_BTN]),
    });
    await sheet.log({
      type: "Запись", id: `${u.id}-${b}-${c}-${d}`, clientId: u.id, client: fullName(u), username: u.username || "",
      service: s.title, date: fmtDate(c), time: hh(+d), price: s.price, status: "Ожидает подтверждения",
    });
    await notifyAdmin(tg, chatId, `<b>Новая запись</b>\n\nКлиент: ${who(u)}\n${bookingLines(s, c, +d)}`,
      kb([[btn("Подтвердить", `aok:${u.id}:${b}:${c}:${d}`), btn("Отклонить", `ano:${u.id}:${b}:${c}:${d}`)]]));
    return;
  }

  // администратор подтвердил / отклонил
  if (a === "aok" || a === "ano") {
    const s = svcById(c);
    if (!s || !isValidKey(d)) return;
    const status = a === "aok" ? "Подтверждено" : "Отклонено";
    await sheet.log({ type: "status", id: `${b}-${c}-${d}-${e}`, status });
    await tg.call("editMessageText", {
      chat_id: chatId, message_id: msgId, parse_mode: "HTML",
      text: `${q.message.text ? esc(q.message.text) : ""}\n\n<b>${status}</b>`,
    });
    if (a === "aok") {
      await tg.call("sendMessage", {
        chat_id: b, parse_mode: "HTML",
        text: `Ваша запись подтверждена!\n\n${bookingLines(s, d, +e)}\n\nЖдем вас в «${esc(S.name)}». Если планы изменятся, просто напишите сюда.`,
        reply_markup: kb([MENU_BTN]),
      });
    } else {
      await tg.call("sendMessage", {
        chat_id: b,
        text: "К сожалению, это время уже занято. Выберите, пожалуйста, другое, подберем удобное.",
        reply_markup: kb([[btn("Выбрать другое время", `bs:${c}`)], MENU_BTN]),
      });
    }
    return;
  }

  if (a === "hum") {
    await tg.call("editMessageText", {
      chat_id: chatId, message_id: msgId,
      text: "Позвал администратора, он ответит вам здесь в рабочее время. Можете сразу написать свой вопрос в чат.",
      reply_markup: kb([MENU_BTN]),
    });
    await sheet.log({ type: "Просит связаться", clientId: u.id, client: fullName(u), username: u.username || "" });
    await notifyAdmin(tg, chatId, `<b>Клиент просит связаться</b>\n\nКлиент: ${who(u)}`);
    return;
  }

  if (a === "ph") {
    await tg.call("sendMessage", {
      chat_id: chatId,
      text: "Нажмите кнопку ниже, чтобы отправить номер телефона.",
      reply_markup: { keyboard: [[{ text: "Отправить номер телефона", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
    });
    return;
  }

  const scr = route(data, u);
  if (scr) {
    await tg.call("editMessageText", {
      chat_id: chatId, message_id: msgId, text: scr.text, parse_mode: "HTML", reply_markup: scr.kb,
    });
  }
}

function matchText(t) {
  const s = ` ${t.toLowerCase()} `;
  const i = S.faq.findIndex((f) => f.keys.some((k) => s.includes(k)));
  if (i >= 0) return scrFaqAnswer(i);
  if (/(цен|стоим|сколько стоит|прайс|почем)/.test(s)) return scrPrices();
  if (/(запиш|записат|запись|свободн|окошк)/.test(s)) return scrBook();
  return null;
}

async function onMessage(tg, m) {
  if (m.chat.type !== "private") return;
  const chatId = m.chat.id;
  const u = m.from;

  if (m.contact) {
    await tg.call("sendMessage", {
      chat_id: chatId, text: "Спасибо, номер получили!", reply_markup: { remove_keyboard: true },
    });
    const s = scrMain();
    await tg.call("sendMessage", { chat_id: chatId, text: "Чем еще могу помочь?", reply_markup: s.kb });
    await sheet.log({ type: "phone", clientId: u.id, client: fullName(u), username: u.username || "", phone: m.contact.phone_number });
    await notifyAdmin(tg, chatId, `<b>Телефон клиента</b>\n\nКлиент: ${who(u)}\nТелефон: ${esc(m.contact.phone_number)}`);
    return;
  }

  const text = (m.text || "").trim();
  if (!text) return;

  if (text.startsWith("/start") || text.startsWith("/menu")) {
    const s = scrMain(u);
    await tg.call("sendMessage", { chat_id: chatId, text: s.text, parse_mode: "HTML", reply_markup: s.kb });
    return;
  }

  const hit = matchText(text);
  if (hit) {
    await tg.call("sendMessage", { chat_id: chatId, text: hit.text, parse_mode: "HTML", reply_markup: hit.kb });
    return;
  }

  await tg.call("sendMessage", {
    chat_id: chatId,
    text: "Передал ваш вопрос администратору, он ответит здесь в рабочее время. А пока можете записаться или посмотреть цены:",
    reply_markup: kb([[btn("Записаться", "bk"), btn("Цены", "p")], MENU_BTN]),
  });
  await sheet.log({ type: "Вопрос", clientId: u.id, client: fullName(u), username: u.username || "", text });
  await notifyAdmin(tg, chatId, `<b>Вопрос от клиента</b>\n\nКлиент: ${who(u)}\n«${esc(text)}»`);
}

async function handleUpdate(tg, upd) {
  if (upd.callback_query) return onCallback(tg, upd.callback_query);
  if (upd.message) return onMessage(tg, upd.message);
}

module.exports = { handleUpdate, _t: { slots, days, dayLabel, matchText, svcById } };
