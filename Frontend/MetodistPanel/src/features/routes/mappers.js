import {formatDateTimeLabel} from '../../app/date.js';


export function mapRouteStatusLabel(status) {
  if (status === 'published') return 'Опубликован';
  if (status === 'draft') return 'Черновик';
  if (status === 'archived') return 'Архив';
  return status || '—';
}

export function mapRouteRows(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
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
    source: item.source || {...item, artifactIds: item.artifact_ids || [], showOnMap: item.show_on_map, requireQr: item.require_qr, visibility: item.visibility === 'private' ? 'team' : item.visibility},
    artifactIds: item.artifact_ids || item.source?.artifactIds || item.artifactIds || [],
  }));
}

export function mapRouteSummaryData(summary) {
  if (!summary) {
    return {total: 0, published: 0, draft: 0, totalViews: 0};
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
    return [];
  }

  return items.map((item) => ({
    title: item.title,
    meta: formatDateTimeLabel(item.created_at),
  }));
}




