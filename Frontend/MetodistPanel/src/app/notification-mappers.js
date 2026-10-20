import {formatDateTimeLabel} from './date';


export function mapNotifications(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    unread: item.unread,
    meta: `${item.meta || item.type || 'Событие'} · ${formatDateTimeLabel(item.created_at)}`,
  }));
}


