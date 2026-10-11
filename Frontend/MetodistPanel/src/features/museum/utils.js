import {MUSEUM_INFO_CARD, MUSEUM_LOGO_ACCEPT, MUSEUM_LOGO_MAX_MB} from './config';

/* Разрешённые файлы логотипа: и для проверки, и для атрибута accept. */
export const LOGO_ACCEPT_ATTRIBUTE = MUSEUM_LOGO_ACCEPT.join(',');
export const LOGO_MAX_BYTES = MUSEUM_LOGO_MAX_MB * 1024 * 1024;

/* Обрезка текста по лимиту — для счётчика описания. */
export function limitText(value, limit) {
  return String(value ?? '').slice(0, limit);
}

export function clampDescription(value) {
  return limitText(value, MUSEUM_INFO_CARD.descriptionLimit);
}

/* Проверка файла логотипа: список форматов и максимальный размер.
   Возвращает причину отказа, чтобы вызывающая сторона показала свой текст. */
export function validateLogoFile(file) {
  if (!MUSEUM_LOGO_ACCEPT.includes(file.type)) {
    return {ok: false, reason: 'type'};
  }
  if (file.size > LOGO_MAX_BYTES) {
    return {ok: false, reason: 'size'};
  }
  return {ok: true, reason: ''};
}

/* Профиль можно сохранять, только если заполнено обязательное название,
   а адрес сайта (если указан) приводится к абсолютному http(s)-URL. */
export function canSaveProfile(profile) {
  return Boolean(profile?.name?.trim()) && normalizeWebsite(profile?.website).ok;
}

/* Адрес сайта: пусто — допустимо, без схемы добавляем https://,
   чужая схема (ftp:, javascript:) или мусор — ошибка.

   Нормализация на границе сохранения, чтобы Visitor получил абсолютный
   URL: там из него делается href, и относительный адрес сломал бы переход. */
export function normalizeWebsite(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return {ok: true, value: ''};

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    return isHttp ? {ok: true, value: url.href} : {ok: false, value: raw};
  } catch {
    return {ok: false, value: raw};
  }
}
