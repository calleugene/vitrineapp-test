import React, {useEffect, useMemo, useRef, useState} from 'react';
import Chart from 'chart.js/auto';
import {ArrowDownToLine, ArrowUpArrowDown, Person, Persons, Stopwatch} from '@gravity-ui/icons';
import {Button, Card, SegmentedRadioGroup, Select} from '@gravity-ui/uikit';
import {analyticsApi} from '../../api';
import {VISITOR_TABLE_COLUMNS} from './demo-data';
import {formatDateTimeLabel} from '../../app/date';
import {InlineTabs} from '../../components/ui';

function VisitorsSourcesChart({items}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(context, {
      type: 'doughnut',
      data: {
        labels: items.map((item) => item.label),
        datasets: [{data: items.map((item) => item.value), backgroundColor: items.map((item) => item.color), borderWidth: 0, hoverOffset: 4}],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          legend: {display: false},
          tooltip: {
            displayColors: false,
            backgroundColor: 'rgba(24, 24, 27, 0.92)',
            titleColor: '#FFFFFF',
            bodyColor: '#E5E7EB',
            bodyFont: {size: 13},
            callbacks: {label: (item) => `${item.label}: ${item.formattedValue}%`},
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [items]);

  return <canvas ref={canvasRef} className="visitors-donut-canvas" />;
}

function DonutCenter({value, label}) {
  return (
    <div className="donut-center">
      <strong>{value}</strong>
      {label ? <span>{label}</span> : null}
    </div>
  );
}

export function VisitorsView({AttendanceChart}) {
  const [period, setPeriod] = useState('month');
  const [series, setSeries] = useState('visitors');
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [summaryCards, setSummaryCards] = useState([]);
  const [visitorsData, setVisitorsData] = useState({labels: [], visitors: [], newVisitors: []});
  const [visitorSources, setVisitorSources] = useState([]);
  const [visitorRows, setVisitorRows] = useState([]);
  const [loadState, setLoadState] = useState({key: '', errors: [], total: 0, meta: null});
  const [retry, setRetry] = useState(0);
  const itemsPerPage = 10;
  const requestKey = `${period}:${sortColumn}:${sortDirection}:${currentPage}:${retry}`;
  const loading = loadState.key !== requestKey;

  useEffect(() => {
    let cancelled = false;

    const loadVisitors = async () => {
      const [summaryResult, visitorsDynamicsResult, newVisitorsDynamicsResult, sourcesResult, listResult] = await Promise.allSettled([
        analyticsApi.visitorsSummary(period),
        analyticsApi.visitorsDynamics(period, 'visitors'),
        analyticsApi.visitorsDynamics(period, 'newVisitors'),
        analyticsApi.visitorsSources(period),
        analyticsApi.visitorsList({period, page: currentPage, limit: itemsPerPage, sortBy: sortColumn, sortDir: sortDirection}),
      ]);

      if (cancelled) {
        return;
      }

      const results = [summaryResult, visitorsDynamicsResult, newVisitorsDynamicsResult, sourcesResult, listResult];
      setLoadState({key: requestKey, errors: results.flatMap((result, index) => result.status === 'rejected' ? [['Метрики', 'Посещаемость', 'Новые посетители', 'Источники', 'Список посетителей'][index]] : []), total: listResult.status === 'fulfilled' ? listResult.value.total : 0, meta: summaryResult.status === 'fulfilled' ? summaryResult.value.meta : null});
      setSummaryCards([]);
      setVisitorsData({labels: [], visitors: [], newVisitors: []});
      setVisitorSources([]);
      setVisitorRows([]);
      const percentage = (value) => typeof value === 'number' ? `${value > 0 ? '+' : ''}${value.toFixed(1)}%` : '';

      if (summaryResult.status === 'fulfilled') {
        const payload = summaryResult.value;
        const deltas = payload.deltas || {};
        setSummaryCards([
          {icon: Persons, value: String(payload.total_visitors ?? '—'), title: 'Уникальные браузеры', delta: percentage(deltas.total_visitors), tone: 'violet'},
          {icon: Person, value: String(payload.new_visitors ?? '—'), title: 'Новые браузеры', delta: percentage(deltas.new_visitors), tone: 'green'},
          {icon: Stopwatch, value: payload.avg_session_minutes == null ? '—' : `${Number(payload.avg_session_minutes).toFixed(2)} мин`, title: 'Среднее активное время сессии', delta: percentage(deltas.avg_session_minutes), tone: 'amber'},
        ]);
      }

      if (visitorsDynamicsResult.status === 'fulfilled' || newVisitorsDynamicsResult.status === 'fulfilled') {
        const visitorsPayload = visitorsDynamicsResult.status === 'fulfilled' ? visitorsDynamicsResult.value : null;
        const newVisitorsPayload = newVisitorsDynamicsResult.status === 'fulfilled' ? newVisitorsDynamicsResult.value : null;
        setVisitorsData({
          labels: visitorsPayload?.labels || newVisitorsPayload?.labels || [],
          visitors: visitorsPayload?.values || [],
          newVisitors: newVisitorsPayload?.values || [],
        });
      }

      if (sourcesResult.status === 'fulfilled') {
        setVisitorSources((sourcesResult.value.sources || []).map((item, index) => ({...item, color: ['#5A4FF6', '#4D7EF1', '#63C987', '#FFB01F'][index % 4]})));
      }

      if (listResult.status === 'fulfilled') {
        setVisitorRows((listResult.value.items || []).map((item) => ({
          id: item.id,
          name: `${item.name} (${item.id.slice(-8)})`,
          route: item.route_title || 'Недоступно',
          firstVisit: formatDateTimeLabel(item.first_visit_at),
          duration: `${item.duration_minutes} мин`,
          collectedArtifacts: String(item.collected_artifacts),
          routeCompleted: 'Недоступно',
        })));
      }
    };

    loadVisitors();

    return () => {
      cancelled = true;
    };
  }, [period, sortColumn, sortDirection, currentPage, requestKey]);

  const sortedVisitors = loading ? [] : visitorRows;
  const total = loading ? 0 : loadState.total;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const visibleVisitors = sortedVisitors;
  const exportVisitorsCsv = () => {
    const columns = VISITOR_TABLE_COLUMNS.map((column) => column.title);
    const fields = VISITOR_TABLE_COLUMNS.map((column) => column.id);
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [columns, ...sortedVisitors.map((row) => fields.map((field) => row[field]))]
      .map((row) => row.map(escape).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], {type: 'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `vitrina-visitors-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const paginationItems = useMemo(() => {
    if (totalPages <= 1) return [1];
    if (totalPages <= 5) return Array.from({length: totalPages}, (_, index) => index + 1);

    const items = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) items.push('ellipsis-left');
    for (let page = start; page <= end; page += 1) items.push(page);
    if (end < totalPages - 1) items.push('ellipsis-right');

    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);

  const handleSort = (columnId) => {
    setCurrentPage(1);
    if (sortColumn === columnId) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortColumn(columnId);
    setSortDirection('asc');
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>Посетители</h1>
          <p>Анализируйте аудиторию вашего музея и её активность.</p>
        </div>
      </div>

      <div className="visitors-toolbar">
        <div className="visitors-filters">
          <Button view="outlined" size="l" disabled>Календарный период · UTC</Button>
          <Select disabled size="l" value={['all-routes']} options={[{value: 'all-routes', content: 'Все маршруты'}]} />
          <Select disabled size="l" value={['all-teams']} options={[{value: 'all-teams', content: 'Все команды'}]} />
          <Button disabled view="outlined" size="l">Фильтры</Button>
        </div>

        <InlineTabs compact className="section-tabs-inline" value={period} items={[{id: 'day', title: 'День'}, {id: 'week', title: 'Неделя'}, {id: 'month', title: 'Месяц'}, {id: 'year', title: 'Год'}]} onChange={(value) => { setPeriod(value); setCurrentPage(1); }} />
      </div>

      {loading ? <p role="status">Загружаем аналитику…</p> : loadState.errors.length ? <div role="alert"><p>Не удалось загрузить: {loadState.errors.join(', ')}.</p><Button onClick={() => setRetry((value) => value + 1)}>Повторить</Button></div> : null}
      {!loading && loadState.meta ? <p>Период: {loadState.meta.from} — {loadState.meta.to} ({loadState.meta.timezone}). Фильтры по маршрутам и командам пока недоступны.</p> : null}
      <div className="stats-grid">
        {(loading ? [] : summaryCards).map((item) => {
          const StatIcon = item.icon;
          return (
            <Card key={item.title} className="stat-card visitor-stat-card" view="filled">
              <div className={`visitor-stat-icon tone-${item.tone}`}><StatIcon /></div>
              <div className="visitor-stat-copy"><div className="stat-value small">{item.value}</div><div className="stat-title">{item.title}</div><div className="stat-delta">{item.delta}</div></div>
            </Card>
          );
        })}
      </div>

      <div className="visitors-analytics">
        <Card className="panel panel-large" view="filled">
          <div className="panel-header"><h3>Динамика посетителей</h3></div>
          <div className="chart visitors-chart"><AttendanceChart labels={loading ? [] : visitorsData.labels} values={loading ? [] : visitorsData.visitors} tooltipLabel="Посетителей" /></div>
        </Card>

        <Card className="panel visitors-mini-chart-card" view="filled">
          <div className="panel-header">
            <SegmentedRadioGroup size="m" value={series} options={[{value: 'visitors', content: 'Посетители'}, {value: 'newVisitors', content: 'Новые'}]} onUpdate={setSeries} />
          </div>
          <div className="chart visitors-mini-chart"><AttendanceChart labels={loading ? [] : visitorsData.labels} values={loading ? [] : visitorsData[series]} tooltipLabel={series === 'visitors' ? 'Посетителей' : 'Новых посетителей'} /></div>
        </Card>

        <Card className="panel visitors-sources-card" view="filled">
          <div className="panel-header"><h3>Источники посетителей</h3></div>
          <div className="visitors-sources-layout">
            <div className="visitors-donut-shell"><VisitorsSourcesChart items={loading ? [] : visitorSources} /><DonutCenter value={!loading && visitorSources.some((item) => item.count > 0) ? '100%' : '—'} label="Источники" /></div>
            <div className="visitors-sources-list">
              {(loading ? [] : visitorSources).map((item) => (
                <div className="visitors-source-row" key={item.label}>
                  <div className="visitors-source-label"><span className="visitors-source-dot" style={{backgroundColor: item.color}} /><span>{item.label}</span></div>
                  <strong>{item.value}% ({item.count})</strong>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card className="panel visitors-table-panel" view="filled">
        <div className="panel-header">
          <h3>Посетители</h3>
          <Button view="outlined" size="m" className="visitors-export-button" disabled={loading || !visibleVisitors.length} onClick={exportVisitorsCsv}><ArrowDownToLine />CSV текущей страницы</Button>
        </div>
        {sortedVisitors.length === 0 ? (
          <div className="visitors-empty-state"><strong>За выбранный период список пуст или недоступен.</strong></div>
        ) : (
          <>
            <div className="table-shell visitors-table-shell">
              <div className="table-head visitors-table-head">
                {VISITOR_TABLE_COLUMNS.map((column) => {
                  const isActive = sortColumn === column.id;
                  const sortLabel = isActive && sortDirection === 'desc' ? 'Я - А' : 'А - Я';
                  return (
                    <button key={column.id} type="button" className={`visitors-sort-button ${isActive ? 'is-active' : ''}`} disabled={column.id === "route" || column.id === "routeCompleted"} onClick={() => handleSort(column.id)} aria-label={`Сортировать по столбцу ${column.title}, ${sortLabel}`} title={`${column.title}, ${sortLabel}`}>
                      <span className="visitors-sort-title">{column.title}</span>
                      <span className="visitors-sort-meta"><ArrowUpArrowDown /><span>{sortLabel}</span></span>
                    </button>
                  );
                })}
              </div>
              {visibleVisitors.map((row) => (
                <div className="table-row visitors-table-row" key={row.id}>
                  <span className="table-ellipsis" title={row.name}>{row.name}</span>
                  <span className="table-ellipsis" title={row.route}>{row.route}</span>
                  <span className="table-ellipsis" title={row.firstVisit}>{row.firstVisit}</span>
                  <span className="table-ellipsis" title={row.duration}>{row.duration}</span>
                  <span className="table-ellipsis" title={row.collectedArtifacts}>{row.collectedArtifacts}</span>
                  <span className="table-ellipsis" title={row.routeCompleted}>{row.routeCompleted}</span>
                </div>
              ))}
            </div>
            <div className="visitors-table-footer">
              <span>Показано {sortedVisitors.length <= itemsPerPage ? sortedVisitors.length : `${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, total)}`} из {total}</span>
              {totalPages > 1 ? (
                <div className="visitors-pagination">
                  {paginationItems.map((item) => typeof item === 'number' ? <button type="button" key={item} className={`visitors-page ${currentPage === item ? 'is-active' : ''}`} onClick={() => setCurrentPage(item)}>{item}</button> : <span key={item}>…</span>)}
                </div>
              ) : null}
            </div>
          </>
        )}
      </Card>
    </section>
  );
}


