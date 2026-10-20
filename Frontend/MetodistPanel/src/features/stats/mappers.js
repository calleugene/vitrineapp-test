const COLORS = ['#5A4FF6', '#4D7EF1', '#63C987', '#FFB01F'];

export function mapStatsSummaryCards(payload) {
  return (payload?.summary || []).map((item) => ({...item,
    value: item.value == null ? '—' : `${Number(item.value).toLocaleString('ru', {maximumFractionDigits: 2})}${item.unit === 'minutes' ? ' мин' : ''}`,
    delta: typeof item.delta === 'number' ? `${item.delta > 0 ? '+' : ''}${item.delta.toFixed(1)}%` : '',
  }));
}
export function mapStatsChartData(payload) {
  return {labels: payload?.labels || [], values: payload?.values || [], chartLabel: payload?.chart_label || ''};
}
export function mapStatsBreakdownData(payload) {
  return {title: payload?.title || 'Типы событий', items: (payload?.items || []).map((item, index) => ({...item, color: COLORS[index % COLORS.length]}))};
}
export function mapStatsRankedData(payload) {
  return {type: 'ranked', title: payload?.title || 'Популярные экспонаты', items: (payload?.items || []).map((item) => ({
    ...item, views: String(item.views ?? item.count ?? ''), delta: typeof item.delta === 'number' ? `${item.delta}%` : '', tone: item.delta_positive === false ? 'negative' : 'positive',
  }))};
}
export function mapStatsBarsData(payload) {
  return {type: 'bars', title: payload?.title || 'Экспонаты по просмотрам', note: payload?.note || '', items: payload?.items || []};
}
