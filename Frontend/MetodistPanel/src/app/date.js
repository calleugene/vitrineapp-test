export function formatDateTimeLabel(value) {
  if (!value) {
    return 'Недавно';
  }

  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

