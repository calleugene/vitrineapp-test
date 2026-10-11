import {ARTIFACT_PLURAL_FORMS, SAFE_EXTERNAL_PROTOCOLS} from './config.js';

/* Русский счёт: 1 артефакт, 2 артефакта, 5 артефактов, 21 артефакт, 22 артефакта. */
export function pluralForm(count, forms) {
  const value = Number.isFinite(count) ? Math.abs(Math.trunc(count)) : 0;
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export function formatArtifactsLabel(count) {
  const value = Number.isFinite(count) ? count : 0;
  return `${value} ${pluralForm(value, ARTIFACT_PLURAL_FORMS)}`;
}

/* Прогресс музея считается в одном месте, чтобы список и экран музея
   не расходились в трактовке «всё найдено» (в т.ч. для музея без экспонатов). */
export function readMuseumProgress(museum) {
  const found = Number(museum?.found_artifacts) || 0;
  const total = Number(museum?.total_artifacts) || 0;
  return {
    found,
    total,
    percent: total ? Math.min(100, Math.round((found / total) * 100)) : 0,
    allFound: total > 0 && found >= total,
  };
}

export function readArtifacts(museum) {
  return Array.isArray(museum?.artifacts) ? museum.artifacts : [];
}

export function filterMuseums(museums, query) {
  const list = Array.isArray(museums) ? museums : [];
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return list;
  return list.filter((museum) => String(museum?.name || '').toLowerCase().includes(needle));
}

/* Приводит адрес сайта музея к безопасному абсолютному URL.
   Пустая строка означает «показывать ссылку нельзя». */
export function normalizeExternalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    return SAFE_EXTERNAL_PROTOCOLS.includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
