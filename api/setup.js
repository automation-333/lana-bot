// Открой /api/setup в браузере один раз после деплоя: бот привяжется к этому адресу.
const tg = require("../lib/tg");

module.exports = async (req, res) => {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const url = `https://${host}/api/bot`;
  const payload = { url, allowed_updates: ["message", "callback_query"], drop_pending_updates: true };
  if (process.env.WEBHOOK_SECRET) payload.secret_token = process.env.WEBHOOK_SECRET;
  const r1 = await tg.call("setWebhook", payload);
  const r2 = await tg.call("setMyCommands", { commands: [{ command: "start", description: "Главное меню" }] });
  res.status(200).json({ webhook: url, setWebhook: r1, setMyCommands: r2.ok });
};
