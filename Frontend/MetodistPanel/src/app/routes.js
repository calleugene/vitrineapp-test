export const DEFAULT_VIEW = 'dashboard';

export const VIEW_ROUTE_MAP = {
  dashboard: '/dashboard',
  museum: '/museum',
  'user-profile': '/user-profile',
  visitors: '/visitors',
  stats: '/stats',
  feedback: '/feedback',
  routes: '/routes',
  'route-basic': '/routes/basic',
  'route-content': '/routes/content',
  'route-publish': '/routes/publish',
  'route-success': '/routes/success',
  artifacts: '/artifacts',
  'artifact-basic': '/artifacts/basic',
  'artifact-content': '/artifacts/content',
  'artifact-publish': '/artifacts/publish',
  'artifact-success': '/artifacts/success',
  'editor-text': '/artifacts/editor/text',
  'editor-model': '/artifacts/editor/model',
  'editor-quiz': '/artifacts/editor/quiz',
  'editor-audio': '/artifacts/editor/audio',
};

export const VIEW_TITLE_MAP = {
  dashboard: 'Дашборд',
  museum: 'Профиль музея',
  'user-profile': 'Профиль пользователя',
  visitors: 'Посетители',
  stats: 'Статистика',
  feedback: 'Обратная связь',
  routes: 'Маршруты',
  'route-basic': 'Маршруты: Основное',
  'route-content': 'Маршруты: Контент',
  'route-publish': 'Маршруты: Публикация',
  'route-success': 'Маршруты: Успешно',
  artifacts: 'Артефакты',
  'artifact-basic': 'Артефакты: Основное',
  'artifact-content': 'Артефакты: Контент',
  'artifact-publish': 'Артефакты: Публикация',
  'artifact-success': 'Артефакты: Успешно',
  'editor-text': 'Редактор: Текст',
  'editor-model': 'Редактор: 3D-модель',
  'editor-quiz': 'Редактор: Викторина',
  'editor-audio': 'Редактор: Аудио',
};

const ROUTE_VIEW_ENTRIES = Object.entries(VIEW_ROUTE_MAP)
  .map(([view, path]) => [path, view])
  .sort((left, right) => right[0].length - left[0].length);

export function normalizePathname(pathname) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

export function getRouteFromPathname(pathname) {
	const normalizedPath = normalizePathname(pathname);
	const artifactMatch = normalizedPath.match(/^\/artifacts\/([^/]+)\/(basic|content|publish|success)$/);
	if (artifactMatch) return {view: `artifact-${artifactMatch[2]}`, artifactId: artifactMatch[1] === 'new' ? null : artifactMatch[1]};

  if (normalizedPath === '/') {
		return {view: DEFAULT_VIEW, artifactId: null};
  }

  const matchedRoute = ROUTE_VIEW_ENTRIES.find(([path]) => path === normalizedPath);
	return {view: matchedRoute?.[1] || DEFAULT_VIEW, artifactId: null};
}

export function getViewFromPathname(pathname) { return getRouteFromPathname(pathname).view; }

export function getPathnameFromView(view, artifactId = null) {
	if (['artifact-basic', 'artifact-content', 'artifact-publish', 'artifact-success'].includes(view)) return `/artifacts/${artifactId || 'new'}/${view.replace('artifact-', '')}`;
	return VIEW_ROUTE_MAP[view] || VIEW_ROUTE_MAP[DEFAULT_VIEW];
}

export function getDocumentTitle(view, isAuthenticated) {
  if (!isAuthenticated) {
    return 'Витрина | Вход';
  }

  const viewTitle = VIEW_TITLE_MAP[view] || VIEW_TITLE_MAP[DEFAULT_VIEW];
  return `Витрина | ${viewTitle}`;
}
