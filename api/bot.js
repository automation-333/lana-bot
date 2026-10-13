const tg = require("../lib/tg");
const { handleUpdate } = require("../lib/logic");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(200).send("Bot is running");
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers["x-telegram-bot-api-secret-token"] !== secret) return res.status(401).end();
  try {
    const upd = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    await handleUpdate(tg, upd || {});
  } catch (e) {
    console.error(e);
  }
  res.status(200).json({ ok: true }); // всегда 200, чтобы Telegram не слал повторно
};
