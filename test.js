// Локальный прогон без Telegram: подменяем API и печатаем, что бот отправил бы.
const { handleUpdate, _t } = require("./lib/logic");
const log = [];
const tg = { call: async (m, p) => { log.push([m, p]); return { ok: true }; } };
const user = { id: 111, first_name: "Анна", username: "anna_test" };
const chat = { id: 111, type: "private" };
const msg = (text) => ({ message: { chat, from: user, text } });
const cb = (data, mtext = "") => ({ callback_query: { id: "q", from: user, data, message: { chat, message_id: 5, text: mtext } } });
const show = (title) => {
  console.log(`\n=== ${title}`);
  for (const [m, p] of log.splice(0)) {
    if (m === "answerCallbackQuery") continue;
    console.log(`[${m}] -> ${p.chat_id}\n${p.text}`);
    const rows = p.reply_markup?.inline_keyboard || p.reply_markup?.keyboard;
    if (rows) console.log("  кнопки:", rows.map((r) => r.map((b) => `${b.text}${b.callback_data ? `{${b.callback_data}}` : ""}`).join(" | ")).join("  //  "));
    for (const r of p.reply_markup?.inline_keyboard || []) for (const b of r) if (b.callback_data && Buffer.byteLength(b.callback_data) > 64) throw new Error("callback_data > 64 bytes: " + b.callback_data);
  }
};
(async () => {
  await handleUpdate(tg, msg("/start")); show("/start");
  await handleUpdate(tg, cb("p")); show("цены");
  await handleUpdate(tg, cb("pc:n")); show("цены маникюр");
  await handleUpdate(tg, cb("bs:n1")); show("выбор дня");
  const k = _t.days(_t.svcById("n1"))[1];
  await handleUpdate(tg, cb(`bd:n1:${k}`)); show("выбор времени");
  const h = _t.slots(_t.svcById("n1"), k)[0];
  await handleUpdate(tg, cb(`bt:n1:${k}:${h}`)); show("подтверждение");
  await handleUpdate(tg, cb(`ok:n1:${k}:${h}`)); show("запись отправлена + админ");
  await handleUpdate(tg, cb(`aok:111:n1:${k}:${h}`, "Новая запись ...")); show("админ подтвердил");
  await handleUpdate(tg, cb(`ano:111:n1:${k}:${h}`, "Новая запись ...")); show("админ отклонил");
  for (const t of ["Сколько стоит маникюр?", "где вы находитесь", "можно картой оплатить?", "хочу перенести запись", "а вы делаете татуировки?"]) {
    await handleUpdate(tg, msg(t)); show(`текст: ${t}`);
  }
  await handleUpdate(tg, { message: { chat, from: user, contact: { phone_number: "+79990001122" } } }); show("контакт");
  await handleUpdate(tg, cb("bd:xx:bad")); show("мусорный callback");
  process.env.ADMIN_CHAT_ID = "999";
  await handleUpdate(tg, cb("hum")); show("позвать админа при ADMIN_CHAT_ID");
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
