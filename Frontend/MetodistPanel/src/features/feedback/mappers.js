import {formatDateTimeLabel} from '../../app/date';


export function mapFeedbackMessageType(type) {
  if (type === 'review') return {label: 'Отзыв', theme: 'info'};
  if (type === 'question') return {label: 'Вопрос', theme: 'success'};
  if (type === 'suggestion') return {label: 'Предложение', theme: 'warning'};
  return {label: type || 'Сообщение', theme: 'utility'};
}

export function mapReplyStatusLabel(status) {
  if (status === 'published') return 'Опубликован';
  if (status === 'draft') return 'Черновик';
  return 'Нет ответа';
}

export function mapFeedbackConversations(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items.map((item) => {
    const type = mapFeedbackMessageType(item.type);
    return {
      id: item.id,
      initial: item.author_initials || (item.author_name || '?').slice(0, 2).toUpperCase(),
      author: item.author_name || 'Посетитель',
      museum: item.museum_id || 'Музей',
      type: type.label,
      typeTheme: type.theme,
      preview: item.body || '',
      time: formatDateTimeLabel(item.created_at),
      title: item.title || 'Сообщение',
      body: item.body || '',
      section: item.section || '—',
      route: item.route_title || '—',
      source: item.source || '—',
      device: item.device || '—',
      rating: item.rating || null,
      replyStatus: mapReplyStatusLabel(item.reply_status),
      reply: item.reply || '',
      version: item.version,
      moderationStatus: item.status,
      replyAuthor: item.reply_author || '',
      replyTime: item.reply_at ? formatDateTimeLabel(item.reply_at) : '',
      accent: item.accent || 'violet',
    };
  });
}


