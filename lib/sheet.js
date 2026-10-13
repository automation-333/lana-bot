// Запись событий в Google Таблицу через веб-приложение Apps Script.
// Если SHEET_URL не задан, ничего не делает: бот работает и без таблицы.
async function log(data) {
  const url = process.env.SHEET_URL;
  if (!url) return;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
      signal: ctrl.signal,
    });
  } catch (e) {
    console.error("sheet log failed", e.message);
  } finally {
    clearTimeout(t);
  }
}

module.exports = { log };
