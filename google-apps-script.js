// Вставить в Google Таблицу: Расширения > Apps Script, заменить весь код этим, сохранить.
// Затем: Начать развертывание > Новое развертывание > Тип: Веб-приложение,
// Запуск от имени: Я, Доступ: Все. Скопировать URL веб-приложения в Vercel как SHEET_URL.

const HEADERS = ["Создано", "Тип", "ID записи", "ID клиента", "Клиент", "Username", "Телефон",
  "Услуга", "Дата", "Время", "Цена", "Статус", "Текст"];
const COL = Object.fromEntries(HEADERS.map((h, i) => [h, i + 1]));

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS);
      sh.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
      sh.setFrozenRows(1);
    }

    // Админ подтвердил или отклонил: обновляем статус у существующей записи
    if (d.type === "status") {
      const row = findLastRow(sh, COL["ID записи"], d.id);
      if (row) {
        sh.getRange(row, COL["Статус"]).setValue(d.status);
        return out({ ok: true, updated: row });
      }
    }

    // Клиент прислал телефон: дописываем в его последнюю строку
    if (d.type === "phone") {
      const row = findLastRow(sh, COL["ID клиента"], String(d.clientId));
      if (row) {
        sh.getRange(row, COL["Телефон"]).setValue(d.phone);
        return out({ ok: true, updated: row });
      }
    }

    const typeName = { status: "Статус", phone: "Телефон" }[d.type] || d.type || "";
    sh.appendRow([new Date(), typeName, d.id || "", d.clientId ? String(d.clientId) : "", d.client || "",
      d.username ? "@" + d.username : "", d.phone || "", d.service || "", d.date || "", d.time || "",
      d.price || "", d.status || "", d.text || ""]);
    return out({ ok: true, appended: sh.getLastRow() });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function findLastRow(sh, col, value) {
  const last = sh.getLastRow();
  if (last < 2 || !value) return 0;
  const vals = sh.getRange(2, col, last - 1, 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]) === String(value)) return i + 2;
  return 0;
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
