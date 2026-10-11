import {ROUTE_DRAFT_STORAGE_KEY} from './constants';

export const DEFAULT_ROUTE_DRAFT = {
  title: 'Письма с фронта',
  subtitle: 'Истории солдат в письмах',
  description:
    'Маршрут помогает посетителям пройти через личные истории, письма и предметы фронтового времени.',
  duration: '35 минут',
  difficulty: 'basic',
  audience: 'Школьники 7-9 классов',
  language: 'ru',
  artifactIds: [],
  status: 'draft',
  visibility: 'public',
  showOnMap: true,
  requireQr: true,
  isSaved: false,
};

export function normalizeRouteDraft(value = {}) {
  return {
    ...DEFAULT_ROUTE_DRAFT,
    ...value,
    artifactIds: Array.isArray(value.artifactIds) ? value.artifactIds : [],
    deletedRouteIds: Array.isArray(value.deletedRouteIds) ? value.deletedRouteIds : [],
  };
}

export function readStoredRouteDraft() {
  if (typeof window === 'undefined') {
    return DEFAULT_ROUTE_DRAFT;
  }

  try {
    const rawDraft = window.localStorage.getItem(ROUTE_DRAFT_STORAGE_KEY);
    return rawDraft ? normalizeRouteDraft(JSON.parse(rawDraft)) : DEFAULT_ROUTE_DRAFT;
  } catch {
    return DEFAULT_ROUTE_DRAFT;
  }
}

export function persistRouteDraft(routeDraft) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(ROUTE_DRAFT_STORAGE_KEY, JSON.stringify(normalizeRouteDraft(routeDraft)));
  } catch {
    // Local persistence is a convenience layer; the wizard must stay usable without it.
  }
}

export function createPublishedRouteDraft(routeDraft) {
  const normalized = normalizeRouteDraft(routeDraft);
  return {
    ...normalized,
    id: normalized.id || `route-${Date.now()}`,
    status: normalized.status === 'draft' ? 'published' : normalized.status,
    isSaved: true,
    updated: new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  };
}

export function createLocalRouteRowsFromStorage() {
  const routeDraft = readStoredRouteDraft();
  if (!routeDraft?.title || !routeDraft.isSaved) {
    return [];
  }

  return [
    {
      id: routeDraft.id || `local:${routeDraft.title}`,
      title: routeDraft.title,
      description: routeDraft.subtitle || routeDraft.description || 'Локальный черновик маршрута',
      status: routeDraft.status || 'draft',
      artifacts_count: routeDraft.artifactIds.length,
      updated_at: new Date().toISOString(),
      views: 0,
      localOnly: true,
      source: routeDraft,
    },
  ];
}

export function createRouteTableRow(routeDraft) {
  const normalized = normalizeRouteDraft(routeDraft);
  if (!normalized.isSaved || !normalized.title) {
    return null;
  }

  return {
    id: normalized.id || `local:${normalized.title}`,
    title: normalized.title,
    subtitle: normalized.subtitle || normalized.description || '',
    description: normalized.description || normalized.subtitle || '',
    status: normalized.status === 'published' ? 'Опубликован' : normalized.status === 'draft' ? 'Черновик' : 'Архив',
    artifacts: String(normalized.artifactIds.length),
    updated: normalized.updated || 'Только что',
    views: '0',
    localOnly: true,
    source: normalized,
    artifactIds: normalized.artifactIds,
  };
}

export function mergeRouteTableRows(routeRows = [], routeDraft) {
  const normalized = normalizeRouteDraft(routeDraft);
  const deletedIds = new Set(normalized.deletedRouteIds || []);
  const localRow = createRouteTableRow(normalized);
  const visibleRows = routeRows.filter((row) => !deletedIds.has(row.id) && row.id !== localRow?.id);

  return localRow ? [localRow, ...visibleRows] : visibleRows;
}

export function mergeLocalRouteRows(serverRoutes = []) {
  const localRoutes = createLocalRouteRowsFromStorage();
  const takenIds = new Set(localRoutes.map((item) => item.id));
  const deletedIds = new Set(readStoredRouteDraft().deletedRouteIds || []);

  return [
    ...localRoutes,
    ...serverRoutes.filter((item) => !takenIds.has(item.id) && !deletedIds.has(item.id)),
  ];
}

export function createRouteDraftFromRow(row) {
  return normalizeRouteDraft({
    id: row.id,
    title: row.title || DEFAULT_ROUTE_DRAFT.title,
    subtitle: row.subtitle || row.description || '',
    description: row.description || row.subtitle || '',
    status: row.status === 'Опубликован' ? 'published' : row.status === 'Черновик' ? 'draft' : 'archived',
    artifactIds: row.artifactIds || [],
    isSaved: true,
  });
}

export function markRouteDeleted(routeDraft, routeId) {
  const normalized = normalizeRouteDraft(routeDraft);
  return {
    ...DEFAULT_ROUTE_DRAFT,
    deletedRouteIds: Array.from(new Set([...(normalized.deletedRouteIds || []), routeId].filter(Boolean))),
  };
}
