// Тонкая обертка над Telegram Bot API
async function call(method, payload) {
  const token = process.env.TELEGRAM_TOKEN;
  if (!token) throw new Error("TELEGRAM_TOKEN is not set");
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!data.ok) console.error("TG error", method, JSON.stringify(data));
  return data;
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

module.exports = { call, esc };
