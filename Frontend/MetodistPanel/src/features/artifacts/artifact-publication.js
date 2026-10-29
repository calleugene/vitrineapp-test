import {contentError, screenValues} from './screen-content.js';

export function artifactReadiness({artifact, draft, screens = [], dirty = false}) {
  const title = (draft?.title ?? artifact?.title ?? '').trim();
  const invalidScreens = screens.filter((screen) => contentError(screen.type || 'text', screenValues(screen)));
  const published = artifact?.status === 'published' && artifact.published_revision > 0;
  const changed = !published || artifact.has_unpublished_changes || artifact.draft_revision > artifact.published_revision;
  const ready = Boolean(artifact?.id && title && screens.length && !invalidScreens.length && !dirty && artifact.status !== 'archived');
  return {
    published,
    hasChanges: Boolean(changed),
    canPublish: ready && Boolean(changed),
    items: [
      {label: title ? 'Название заполнено' : 'Добавьте название', description: title || 'Укажите название в основной информации.', ready: Boolean(title)},
      {label: screens.length ? `Экранов в истории: ${screens.length}` : 'Добавьте контент', description: !screens.length ? 'Нужен хотя бы один экран в разделе «Контент».' : invalidScreens.length ? `Проверьте содержание экранов: ${invalidScreens.length}.` : 'Проверьте содержание и порядок экранов перед публикацией.', ready: screens.length > 0 && !invalidScreens.length},
      {label: dirty || !artifact?.id ? 'Сохраните основные сведения' : 'Сведения сохранены', description: dirty ? 'Вернитесь к основной информации и сохраните изменения.' : 'Основные сведения сохранены в черновике.', ready: Boolean(artifact?.id && !dirty)},
    ],
  };
}
