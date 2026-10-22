import {formatDateTimeLabel} from '../../app/date.js';

function displayValue(value, suffix = '') {
  return value === null || value === undefined || value === '' ? '—' : `${value}${suffix}`;
}

export function mapDashboardSummary(summary) {
  const fields = ['visitors_per_month', 'avg_route_duration_minutes', 'avg_progress_percent', 'museum_rating'];
  if (!fields.some((key) => summary?.[key] !== null && summary?.[key] !== undefined && summary?.[key] !== '')) return [];
  const deltas = summary?.deltas || {};
  return [
    {title: 'Количество посетителей за месяц', value: displayValue(summary?.visitors_per_month), delta: deltas.visitors_per_month || ''},
    {title: 'Время завершённого маршрута · всё время', value: displayValue(summary?.avg_route_duration_minutes, ' мин'), delta: deltas.avg_route_duration_minutes || ''},
    {title: 'Средний прогресс маршрутов · всё время', value: displayValue(summary?.avg_progress_percent, '%'), delta: deltas.avg_progress_percent || ''},
    {title: 'Оценка опубликованных отзывов · всё время', value: displayValue(summary?.museum_rating), delta: deltas.museum_rating || ''},
  ];
}

export function mapDashboardPopularRoutes(routes) {
  if (!Array.isArray(routes)) return [];
  return routes.map((route, index) => ({
    rank: route.rank ?? index + 1,
    title: route.title,
    description: route.description,
    visits: displayValue(route.visits, ' посещения'),
    progress: Number.isFinite(route.completion_percent) ? route.completion_percent : null,
    delta: route.delta || '',
  }));
}

export function mapDashboardActivities(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    title: item.title || '—',
    meta: item.created_at ? formatDateTimeLabel(item.created_at) : '—',
  }));
}

export function mapDashboardFeedbackItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    title: item.title || '—',
    subtitle: item.subtitle || '—',
    meta: item.created_at ? formatDateTimeLabel(item.created_at) : '—',
  }));
}

export function mapDashboardAttendance(attendance) {
  const labels = attendance?.labels;
  const values = attendance?.values;
  if (!Array.isArray(labels) || !Array.isArray(values)) return {labels: [], values: [], note: 'Нет данных за выбранный период.'};
  if (labels.length !== values.length || !values.every((value) => Number.isFinite(value))) {
    throw new Error('Некорректный ответ посещаемости.');
  }
  return {labels, values, note: attendance.note || (labels.length ? '' : 'Нет данных за выбранный период.')};
}


