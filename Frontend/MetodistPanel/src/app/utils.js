import {
  ARTIFACT_PUBLISH_STATUSES,
  ARTIFACT_ROUTE_ACCESS_VALUES,
  ARTIFACT_SCREEN_STATUSES,
  ARTIFACT_STATUS_LABELS,
  ARTIFACT_STATUS_THEMES,
  ARTIFACT_VISIBILITY_VALUES,
  DASHBOARD_STATS,
  FEEDBACK_CONVERSATIONS,
  FEEDBACK_ITEMS,
  MOCK_AUTH_CREDENTIALS,
  MOCK_AUTH_USER,
  MUSEUM_PROFILE_STATS,
  NOTIFICATION_ITEMS,
  POPULAR_ROUTES,
  RECENT_ACTIVITY,
  ROUTE_ROWS,
  SCREEN_KIND_META,
  SCREEN_TYPE_BY_EDITOR,
  SCREEN_STATUS_META,
  SESSION_STORAGE_KEY,
} from './constants';

export function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function persistSession(session) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function formatArtifactDate(value) {
  if (!value) {
    return 'Без даты';
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function getArtifactStatusLabel(status) {
  return ARTIFACT_STATUS_LABELS[status] || status;
}

export function getArtifactStatusTheme(status) {
  return ARTIFACT_STATUS_THEMES[status] || 'unknown';
}

export function getScreenKindMeta(screen) {
  const key = screen.kind || screen.editor || (screen.locked ? 'system' : 'editor-text');
  return SCREEN_KIND_META[key] || SCREEN_KIND_META['editor-text'];
}

export function getScreenStatusMeta(status) {
  return SCREEN_STATUS_META[status] || SCREEN_STATUS_META.draft;
}

export function createArtifactScreen(typeId) {
  const id = `screen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const screenMap = {
    'editor-text': {
      id,
      title: 'Интересный факт',
      subtitle: 'Визуальный экран',
      body: 'Фронтовые письма часто писали карандашом на тонкой бумаге.',
      editor: 'editor-text',
      kind: 'editor-text',
      status: 'draft',
      textLines: [
        'Фронтовые письма часто писали карандашом',
        'Бумага должна была выдерживать пересылку',
        'Каждая строка проходила военную цензуру',
      ],
      mediaCount: 0,
      audioCount: 0,
      content: {body: 'Фронтовые письма часто писали карандашом на тонкой бумаге.', imageName: ''},
    },
    'editor-quiz': {
      id,
      title: 'Вопрос посетителю',
      subtitle: 'Интерактивный шаг',
      body: 'Правда ли, что письма доставляли без конвертов?',
      editor: 'editor-quiz',
      kind: 'editor-quiz',
      status: 'draft',
      textLines: [
        'Правда ли, что письма доставляли без конвертов?',
        'Выберите один из вариантов ответа',
      ],
      mediaCount: 0,
      audioCount: 0,
      content: {
        question: 'Правда ли, что письма доставляли без конвертов?',
        options: ['Правда', 'Ложь'],
        correctAnswer: 'Правда',
      },
    },
    'editor-model': {
      id,
      title: 'Рассмотреть артефакт',
      subtitle: '3D-сцена',
      body: 'Поверните письмо и изучите детали печати.',
      editor: 'editor-model',
      kind: 'editor-model',
      status: 'draft',
      textLines: [
        'Поверните письмо и изучите детали печати',
        'Отдельно выделены штампы и подписи',
      ],
      mediaCount: 0,
      audioCount: 0,
      content: {description: 'Поверните письмо и изучите детали печати.', modelName: ''},
    },
    'editor-audio': {
      id,
      title: 'Голос фронтовика',
      subtitle: 'Аудиорассказ',
      body: 'Послушайте воспоминание о пути письма домой.',
      editor: 'editor-audio',
      kind: 'editor-audio',
      status: 'draft',
      textLines: [
        'Послушайте воспоминание о пути письма домой',
        'Добавьте расшифровку и обложку аудио',
      ],
      mediaCount: 0,
      audioCount: 0,
      content: {description: 'Послушайте воспоминание о пути письма домой.', audioName: '', imageName: ''},
    },
  };

  return screenMap[typeId] || null;
}

function compactString(value) {
  return String(value ?? '').trim();
}

function normalizeEnumValue(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback;
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map(compactString).filter(Boolean);
  }

  return compactString(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function normalizeArtifactForm(form = {}) {
  const shortDescription = compactString(form.shortDescription);
  const longDescription = compactString(form.longDescription);

  return {
    title: compactString(form.title),
    shortDescription,
    description: longDescription || shortDescription,
    category: compactString(form.category) || 'letters',
    date: compactString(form.date),
    period: compactString(form.period),
    place: compactString(form.place),
    tags: normalizeTags(form.tags),
  };
}

export function normalizeArtifactScreen(screen = {}, index = 0) {
  const locked = Boolean(screen.locked);
  const editor = locked ? null : screen.editor || 'editor-text';
  const kind = screen.kind || editor || 'system';
  const type = SCREEN_TYPE_BY_EDITOR[editor] || (locked ? 'system' : 'text-photo');
  const rawContent = screen.content && typeof screen.content === 'object' ? screen.content : {};
  const content = type === 'quiz'
    ? {
      ...rawContent,
      question: compactString(rawContent.question) || compactString(screen.body),
      options: Array.isArray(rawContent.options) && rawContent.options.length >= 2
        ? rawContent.options.flatMap((option) => {
          const normalizedOption = compactString(option);
          return normalizedOption ? [normalizedOption] : [];
        })
        : ['Правда', 'Ложь'],
      correctAnswer: compactString(rawContent.correctAnswer) || 'Правда',
    }
    : rawContent;
  const settings = screen.settings && typeof screen.settings === 'object' ? screen.settings : {};

  return {
    id: compactString(screen.id) || `screen-${index + 1}`,
    order: Number.isFinite(screen.order) ? screen.order : index + 1,
    title: compactString(screen.title) || `Экран ${index + 1}`,
    subtitle: compactString(screen.subtitle),
    body: compactString(screen.body),
    editor,
    type,
    locked,
    kind,
    status: normalizeEnumValue(screen.status, ARTIFACT_SCREEN_STATUSES, 'draft'),
    textLines: Array.isArray(screen.textLines) ? screen.textLines.map(compactString).filter(Boolean) : [],
    mediaCount: Number.isFinite(screen.mediaCount) ? screen.mediaCount : 0,
    audioCount: Number.isFinite(screen.audioCount) ? screen.audioCount : 0,
    content,
    settings,
  };
}

export function normalizeArtifactScreens(screens = []) {
  return screens.map((screen, index) => normalizeArtifactScreen({...screen, order: index + 1}, index));
}

export function createArtifactDraft({form, screens, publication} = {}) {
  return {
    artifact: normalizeArtifactForm(form),
    publication: {
      status: normalizeEnumValue(publication?.status, ARTIFACT_PUBLISH_STATUSES, 'draft'),
      visibility: normalizeEnumValue(publication?.visibility, ARTIFACT_VISIBILITY_VALUES, 'public'),
      routeAccess: normalizeEnumValue(publication?.routeAccess, ARTIFACT_ROUTE_ACCESS_VALUES, 'selected'),
      showViews: publication?.showViews ?? true,
      allowDownload: Boolean(publication?.allowDownload),
    },
    screens: Array.isArray(screens) ? normalizeArtifactScreens(screens) : [],
  };
}

export function addArtifactScreenToDraft(screens, typeId) {
  const nextScreen = createArtifactScreen(typeId);
  if (!nextScreen) {
    return {screens, screen: null};
  }

  const nextScreens = normalizeArtifactScreens([...screens, nextScreen]);
  return {
    screens: nextScreens,
    screen: nextScreens[nextScreens.length - 1],
  };
}

export function updateArtifactScreenDraft(screens, screenId, updates) {
  return normalizeArtifactScreens(
    screens.map((screen) => {
      if (screen.id !== screenId) {
        return screen;
      }

      const patch = typeof updates === 'function' ? updates(screen) : updates;
      return {...screen, ...patch};
    })
  );
}

export function duplicateArtifactScreenDraft(screens, screenId) {
  const index = screens.findIndex((screen) => screen.id === screenId);
  if (index === -1) {
    return screens;
  }

  const source = normalizeArtifactScreen(screens[index], index);
  const clone = {
    ...source,
    id: `screen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `${source.title} (копия)`,
    status: source.status === 'ready' ? 'draft' : source.status,
  };

  return normalizeArtifactScreens([...screens.slice(0, index + 1), clone, ...screens.slice(index + 1)]);
}

export function removeArtifactScreenDraft(screens, screenId) {
  return normalizeArtifactScreens(screens.filter((screen) => screen.id !== screenId));
}

export function moveArtifactScreenDraft(screens, screenId, direction) {
  const index = screens.findIndex((screen) => screen.id === screenId);
  if (index === -1) {
    return screens;
  }

  const targetIndex = direction === 'left' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= screens.length) {
    return screens;
  }

  return normalizeArtifactScreens(moveItem(screens, index, targetIndex));
}

export function reorderArtifactScreenDraft(screens, fromId, toId) {
  const fromIndex = screens.findIndex((screen) => screen.id === fromId);
  const toIndex = screens.findIndex((screen) => screen.id === toId);
  if (fromIndex === -1 || toIndex === -1) {
    return screens;
  }

  return normalizeArtifactScreens(moveItem(screens, fromIndex, toIndex));
}

export function validateArtifactPublishDraft(draft) {
  const errors = [];

  if (!draft.artifact.title) {
    errors.push('Укажите название артефакта.');
  }

  if (!draft.artifact.description) {
    errors.push('Добавьте описание артефакта.');
  }

  if (!draft.artifact.category) {
    errors.push('Выберите категорию артефакта.');
  }

  const contentScreens = draft.screens.filter((screen) => !screen.locked);
  if (contentScreens.length === 0) {
    errors.push('Добавьте хотя бы один контентный экран.');
  }

  contentScreens.forEach((screen) => {
    const validation = validateArtifactScreenDraft(screen);
    validation.errors.forEach((error) => {
      errors.push(`Экран ${screen.order}: ${error}`);
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateArtifactScreenDraft(screen) {
  const normalizedScreen = normalizeArtifactScreen(screen);
  const content = normalizedScreen.content || {};
  const fieldErrors = {};
  const originalTitle = compactString(screen?.title);

  if (!originalTitle) {
    fieldErrors.title = 'Укажите название экрана.';
  }

  if (normalizedScreen.type === 'text-photo') {
    if (!compactString(content.body || normalizedScreen.body)) {
      fieldErrors.body = 'Добавьте текст экрана.';
    }

    if (!compactString(content.imageName) && normalizedScreen.mediaCount === 0) {
      fieldErrors.imageName = 'Укажите изображение или его рабочее название.';
    }
  }

  if (normalizedScreen.type === 'quiz') {
    const options = Array.isArray(content.options) ? content.options.map(compactString).filter(Boolean) : [];

    if (!compactString(content.question || normalizedScreen.body)) {
      fieldErrors.question = 'Добавьте вопрос.';
    }

    if (options.length < 2) {
      fieldErrors.options = 'Добавьте минимум два варианта ответа.';
    }

    if (!compactString(content.correctAnswer) || !options.includes(compactString(content.correctAnswer))) {
      fieldErrors.correctAnswer = 'Выберите правильный ответ из списка вариантов.';
    }
  }

  if (normalizedScreen.type === 'model-3d') {
    if (!compactString(content.description || normalizedScreen.body)) {
      fieldErrors.description = 'Добавьте описание модели.';
    }

    if (!compactString(content.modelName)) {
      fieldErrors.modelName = 'Укажите файл 3D-модели.';
    }
  }

  if (normalizedScreen.type === 'audio-photo') {
    if (!compactString(content.description || normalizedScreen.body)) {
      fieldErrors.description = 'Добавьте описание аудиоэкрана.';
    }

    if (!compactString(content.audioName) && normalizedScreen.audioCount === 0) {
      fieldErrors.audioName = 'Укажите аудиофайл.';
    }

    if (!compactString(content.imageName) && normalizedScreen.mediaCount === 0) {
      fieldErrors.imageName = 'Укажите изображение.';
    }
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
    errors: Object.values(fieldErrors),
  };
}

export function serializeArtifactScreenPayload(screen) {
  const normalizedScreen = normalizeArtifactScreen(screen);

  return JSON.stringify({
    version: 1,
    id: normalizedScreen.id,
    order: normalizedScreen.order,
    subtitle: normalizedScreen.subtitle,
    body: normalizedScreen.body,
    editor: normalizedScreen.editor,
    locked: normalizedScreen.locked,
    status: normalizedScreen.status,
    kind: normalizedScreen.kind,
    content: {
      ...normalizedScreen.content,
      textLines: normalizedScreen.textLines,
      mediaCount: normalizedScreen.mediaCount,
      audioCount: normalizedScreen.audioCount,
    },
    settings: normalizedScreen.settings,
  });
}

export function buildArtifactPublishPayload(draft) {
  const validation = validateArtifactPublishDraft(draft);

  return {
    validation,
    artifact: {
      title: draft.artifact.title,
      description: draft.artifact.description,
      category: draft.artifact.category,
      status: draft.publication.status,
    },
    metadata: {
      shortDescription: draft.artifact.shortDescription,
      date: draft.artifact.date,
      period: draft.artifact.period,
      place: draft.artifact.place,
      tags: draft.artifact.tags,
      visibility: draft.publication.visibility,
      routeAccess: draft.publication.routeAccess,
      showViews: Boolean(draft.publication.showViews),
      allowDownload: draft.publication.allowDownload,
    },
    screens: draft.screens
      .filter((screen) => !screen.locked)
      .map((screen) => ({
        type: screen.type,
        title: screen.title,
        payload: serializeArtifactScreenPayload(screen),
      })),
  };
}

export function moveItem(array, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return array;
  }

  const next = [...array];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function buildScreenPayload(screen) {
  return serializeArtifactScreenPayload(normalizeArtifactScreen(screen));
}

export function isServiceUnavailableError(error) {
  return error?.code === 'service_unavailable' || error?.message === 'service_unavailable';
}

export function isMockCredentials(email, password) {
  return email === MOCK_AUTH_CREDENTIALS.email && password === MOCK_AUTH_CREDENTIALS.password;
}

export function createMockSession() {
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    tokenType: 'Bearer',
    user: MOCK_AUTH_USER,
    isMock: true,
  };
}

export function splitFullName(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Анна',
    lastName: parts.slice(1).join(' ') || 'Смирнова',
  };
}

export function createUserProfileDraft(user) {
  const extraLanguagesRaw = user?.extra_languages || user?.extraLanguages || '[]';
  let extraLanguages = ['en', 'de'];

  try {
    const parsed = typeof extraLanguagesRaw === 'string' ? JSON.parse(extraLanguagesRaw || '[]') : extraLanguagesRaw;
    if (Array.isArray(parsed) && parsed.length > 0) {
      extraLanguages = parsed;
    }
  } catch {
    // Keep fallback defaults for malformed legacy payloads.
  }

  const nameParts = splitFullName(user?.full_name || user?.fullName || '');

  return {
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email: user?.email || 'anna.smirnova@mail.ru',
    phone: user?.phone || '+7 (916) 123-45-67',
    position: user?.position || user?.role || 'methodist',
    about: user?.about || 'Занимаюсь разработкой и проверкой образовательного контента, курирую методические материалы для музеев.',
    interfaceLanguage: user?.interface_language || user?.interfaceLanguage || 'ru',
    notifications: user?.notifications_enabled ?? user?.notifications ?? true,
    birthDate: user?.birth_date || user?.birthDate || '1988-05-15',
    gender: user?.gender || 'female',
    timezone: user?.timezone || 'moscow',
    extraLanguages,
    note: user?.note || '',
    status: user?.status || 'active',
    registeredAt: formatDateTimeLabel(user?.registered_at || user?.registeredAt),
    lastLoginAt: formatDateTimeLabel(user?.last_login_at || user?.lastLoginAt),
    userId: user?.id || '10001',
    registrationSource: user?.registration_source || user?.registrationSource || 'Приглашение администратором',
    twoFactorEnabled: user?.two_factor_enabled ?? user?.twoFactorEnabled ?? false,
    roles: [user?.role === 'museum_admin' ? 'Администратор музея' : user?.role === 'moderator' ? 'Модератор' : 'Методист'],
    museums: [],
    activities: [],
  };
}

export function parseVisitorDateTime(value) {
  if (!value) {
    return 0;
  }

  const [datePart = '', timePart = ''] = value.split(',').map((part) => part.trim());
  const [day = '0', month = '0', year = '0'] = datePart.split('.');
  const [hours = '0', minutes = '0'] = timePart.split(':');

  return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)).getTime();
}

export function parseDurationMinutes(value) {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function parseVisitorCount(value) {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function parseContacts(contacts) {
  if (!contacts) {
    return {};
  }

  if (typeof contacts === 'object') {
    return contacts;
  }

  try {
    return JSON.parse(contacts);
  } catch {
    return {};
  }
}

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

export function mapDashboardSummary(summary) {
  if (!summary) {
    return DASHBOARD_STATS;
  }

  const deltas = summary.deltas || {};
  return [
    {title: 'Количество посетителей за месяц', value: String(summary.visitors_per_month ?? 0), delta: deltas.visitors_per_month || ''},
    {title: 'Среднее время маршрута', value: `${summary.avg_route_duration_minutes ?? 0} мин`, delta: deltas.avg_route_duration_minutes || ''},
    {title: 'Средний прогресс', value: `${summary.avg_progress_percent ?? 0}%`, delta: deltas.avg_progress_percent || ''},
    {title: 'Оценка музея', value: String(summary.museum_rating ?? 0), delta: deltas.museum_rating || ''},
  ];
}

export function mapDashboardPopularRoutes(routes) {
  if (!Array.isArray(routes) || routes.length === 0) {
    return POPULAR_ROUTES;
  }

  return routes.map((route) => ({
    rank: route.rank,
    title: route.title,
    description: route.description,
    visits: `${route.visits} посещения`,
    progress: route.completion_percent,
    delta: route.delta,
  }));
}

export function mapDashboardActivities(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return RECENT_ACTIVITY;
  }

  return items.map((item) => ({
    title: item.title,
    meta: formatDateTimeLabel(item.created_at),
  }));
}

export function mapDashboardFeedbackItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return FEEDBACK_ITEMS;
  }

  return items.map((item) => ({
    title: item.title,
    subtitle: item.subtitle,
    meta: formatDateTimeLabel(item.created_at),
  }));
}

export function mapMuseumProfileData(museum) {
  if (!museum) {
    return {
      name: '', shortDescription: '', website: '', founded: '', address: '', code: '', description: '',
      timezone: 'moscow',
      logoUrl: '',
      contacts: parseContacts('{"email":"info@shm.ru","phone":"+7 (495) 692-01-51","working_hours":"Ежедневно 10:00 – 21:00"}'),
    };
  }

  return {
    name: museum.name || '',
    shortDescription: museum.short_description || '',
    website: museum.website || '',
    founded: museum.founded_year ? String(museum.founded_year) : '',
    address: museum.address || '',
    code: museum.code || '',
    description: museum.description || '',
    timezone: museum.timezone || 'moscow',
    logoUrl: museum.logo_url || '',
    contacts: parseContacts(museum.contacts),
  };
}

export function mapMuseumStatsData(stats) {
  if (!stats) {
    return MUSEUM_PROFILE_STATS;
  }

  return [
    {title: 'Артефактов', value: String(stats.artifacts_count ?? 0)},
    {title: 'Маршрутов', value: String(stats.routes_count ?? 0)},
    {title: 'Посетителей', value: String(stats.visitors_count ?? 0)},
  ];
}

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
    return FEEDBACK_CONVERSATIONS;
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
      reply: '',
      replyAuthor: '',
      replyTime: '',
      accent: item.accent || 'violet',
    };
  });
}

export function mapNotifications(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return NOTIFICATION_ITEMS;
  }

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    meta: `${item.meta || item.type || 'Событие'} · ${formatDateTimeLabel(item.created_at)}`,
  }));
}

export function mapRouteStatusLabel(status) {
  if (status === 'published') return 'Опубликован';
  if (status === 'draft') return 'Черновик';
  if (status === 'archived') return 'Архив';
  return status || '—';
}

export function mapRouteRows(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return ROUTE_ROWS;
  }

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.description,
    description: item.description,
    status: mapRouteStatusLabel(item.status),
    artifacts: String(item.artifacts_count ?? 0),
    updated: formatDateTimeLabel(item.updated_at),
    views: String(item.views ?? 0),
    localOnly: Boolean(item.localOnly),
    source: item.source || null,
    artifactIds: item.source?.artifactIds || item.artifactIds || [],
  }));
}

export function mapRouteSummaryData(summary) {
  if (!summary) {
    return {total: 12, published: 8, draft: 3, totalViews: 4328};
  }

  return {
    total: summary.total ?? 0,
    published: summary.published ?? 0,
    draft: summary.draft ?? 0,
    totalViews: summary.total_views ?? 0,
  };
}

export function mapRouteActivities(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [
      {title: 'Опубликован маршрут «История города в письмах»', meta: 'Сегодня, 14:20'},
      {title: 'Обновлён маршрут «Письма с фронта»', meta: 'Сегодня, 11:45'},
      {title: 'Создан черновик «Покорение космоса»', meta: 'Вчера, 17:10'},
    ];
  }

  return items.map((item) => ({
    title: item.title,
    meta: formatDateTimeLabel(item.created_at),
  }));
}

export function mapUserMuseums(museums) {
  if (!Array.isArray(museums) || museums.length === 0) {
    return [];
  }

  return museums.map((museum) => ({
    name: museum.name,
    city: museum.city || '—',
    status: museum.access_level === 'edit' ? 'Редактирование' : 'Просмотр',
  }));
}

export function mapUserActivities(activities) {
  if (!Array.isArray(activities) || activities.length === 0) {
    return [];
  }

  return activities.map((activity) => ({
    id: activity.id,
    title: activity.action,
    meta: activity.details || '',
    createdAt: formatDateTimeLabel(activity.created_at),
  }));
}

export function mapStatsSummaryCards(summaryPayload, fallback) {
  const items = summaryPayload?.summary;
  return Array.isArray(items) && items.length > 0 ? items : fallback.summary;
}

export function mapStatsChartData(chartPayload, fallbackSeries, fallbackLabel) {
  return {
    labels: chartPayload?.labels || fallbackSeries.labels,
    values: chartPayload?.values || fallbackSeries.values,
    chartLabel: chartPayload?.chart_label || fallbackLabel,
  };
}

export function mapStatsBreakdownData(payload, fallback) {
  return {
    title: payload?.title || fallback.sideTitle,
    items: payload?.items || fallback.sideItems,
  };
}

export function mapStatsRankedData(payload, fallbackSection) {
  return {
    ...fallbackSection,
    title: payload?.title || fallbackSection.title,
    items:
      Array.isArray(payload?.items) && payload.items.length > 0
        ? payload.items.map((item) => ({
            rank: item.rank,
            title: item.title,
            views: String(item.views ?? item.count ?? ''),
            delta: item.delta || '',
            tone: item.delta_positive === false ? 'negative' : 'positive',
          }))
        : fallbackSection.items,
  };
}

export function mapStatsBarsData(payload, fallbackSection) {
  return {
    ...fallbackSection,
    title: payload?.title || fallbackSection.title,
    note: payload?.note || fallbackSection.note,
    items: payload?.items || fallbackSection.items,
  };
}
