export function formatMinutes(value) {
  return `${value || 0} мин`;
}

export function formatFoundAt(foundAt) {
  if (!foundAt) return 'Недавно';
  const date = new Date(foundAt);
  return `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function progressPercent(found, total) {
  return total ? Math.round((found / total) * 100) : 0;
}
