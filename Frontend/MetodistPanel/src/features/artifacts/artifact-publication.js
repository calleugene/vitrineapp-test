import {contentError, screenValues} from './screen-content.js';

export function artifactReadiness({artifact, draft, screens = [], dirty = false}) {
  const title = (draft?.title ?? artifact?.title ?? '').trim();
  const invalidScreens = screens.filter((screen) => contentError(screen.type || 'text', screenValues(screen)));
  const published = artifact?.status === 'published' && artifact.published_revision > 0;
  const changed = !published || artifact.has_unpublished_changes || artifact.draft_revision > artifact.published_revision;
  let blocker = '';
  if (artifact?.status === 'archived') blocker = 'Восстановите экспонат из архива.';
  else if (!title) blocker = 'Укажите название в разделе «Основная информация».';
  else if (!artifact?.id || dirty) blocker = 'Сохраните основные сведения об экспонате.';
  else if (!screens.length) blocker = 'Добавьте хотя бы один экран в разделе «Контент».';
  else if (invalidScreens.length) blocker = 'Исправьте незаполненные экраны в разделе «Контент».';
  return {
    published,
    hasChanges: Boolean(changed),
    blocker,
    canPublish: !blocker && Boolean(changed),
    items: [
      {label: title ? 'Название заполнено' : 'Добавьте название', ready: Boolean(title)},
      {label: invalidScreens.length ? 'Проверьте содержание экранов' : screens.length ? 'Контент готов' : 'Добавьте контент', description: invalidScreens.map((screen) => screen.title || `Экран ${screens.indexOf(screen) + 1}`).join(', '), ready: screens.length > 0 && !invalidScreens.length},
      {label: dirty || !artifact?.id ? 'Сохраните основные сведения' : 'Сведения сохранены', ready: Boolean(artifact?.id && !dirty)},
    ],
  };
}
