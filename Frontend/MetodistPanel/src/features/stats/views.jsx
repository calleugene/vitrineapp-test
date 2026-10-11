import React, {useEffect, useRef} from 'react';
import Chart from 'chart.js/auto';
import {Button, Card, SegmentedRadioGroup} from '@gravity-ui/uikit';
import {STATS_TABS, STATS_TAB_CONTENT} from '../../app/constants';

function DonutCenter({value, label}) {
  return (
    <div className="donut-center">
      <strong>{value}</strong>
      {label ? <span>{label}</span> : null}
    </div>
  );
}

function GenericDonutChart({items}) {
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
        datasets: [
          {
            data: items.map((item) => item.value),
            backgroundColor: items.map((item) => item.color),
            borderWidth: 0,
            spacing: 4,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '67%',
        plugins: {
          legend: {display: false},
          tooltip: {
            displayColors: false,
            backgroundColor: 'rgba(24, 24, 27, 0.92)',
            titleColor: '#FFFFFF',
            bodyColor: '#E5E7EB',
            callbacks: {
              label: (item) => `${item.label}: ${item.formattedValue}%`,
            },
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

export function StatsView({statsTab, setStatsTab, statsPeriod, setStatsPeriod, statsData, AttendanceChart}) {
  const tabContent = STATS_TAB_CONTENT[statsTab] || STATS_TAB_CONTENT.overview;
  const fallbackSeries = tabContent.chartSeries[statsPeriod] || tabContent.chartSeries.day;
  const chartData = statsData?.chart || {labels: fallbackSeries.labels, values: fallbackSeries.values, chartLabel: tabContent.chartLabel};
  const summaryItems = statsData?.summary || tabContent.summary;
  const breakdown = statsData?.breakdown || {title: tabContent.sideTitle, items: tabContent.sideItems};
  const rankedSection = statsData?.ranked || tabContent.lowerSections[0];
  const barsSection = statsData?.bars || tabContent.lowerSections[tabContent.lowerSections.length - 1];

  const exportReportCsv = () => {
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['Раздел', tabContent.chartTitle],
      ['Период', statsPeriod],
      [],
      ['Метрика', 'Значение', 'Изменение', 'Примечание'],
      ...summaryItems.map((item) => [item.title, item.value, item.delta, item.note]),
      [],
      ['График', 'Значение'],
      ...chartData.labels.map((label, index) => [label, chartData.values[index] ?? 0]),
      [],
      ['Breakdown', 'Доля', 'Количество'],
      ...breakdown.items.map((item) => [item.label, `${item.value}%`, item.count]),
    ];
    const csv = rows.map((row) => row.map(escape).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], {type: 'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `vitrina-stats-${statsTab}-${statsPeriod}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>Статистика</h1>
        </div>
        <Button view="outlined" size="l" onClick={exportReportCsv}>Экспортировать CSV</Button>
      </div>

      <div className="profile-tabs stats-tabs">
        {STATS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`profile-tab ${statsTab === tab.id ? 'is-active' : ''}`}
            onClick={() => setStatsTab(tab.id)}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <div className="stats-grid stats-summary-grid">
        {summaryItems.map((item) => {
          return (
            <Card key={item.title} className="stat-card stats-summary-card" view="filled">
              <div className="stat-value-row">
                <div className="stat-value">{item.value}</div>
                <span className="stat-delta stats-summary-delta">{item.delta}</span>
              </div>
              <div className="stat-title">{item.title}</div>
              <div className="stats-summary-note">{item.note}</div>
            </Card>
          );
        })}
      </div>

      <div className="stats-dashboard-grid">
        <Card className="panel panel-large" view="filled">
          <div className="panel-header">
            <h3>{tabContent.chartTitle}</h3>
            <SegmentedRadioGroup
              size="m"
              value={statsPeriod}
              options={[
                {value: 'day', content: 'День'},
                {value: 'week', content: 'Неделя'},
                {value: 'month', content: 'Месяц'},
              ]}
              onUpdate={setStatsPeriod}
            />
          </div>
          <div className="chart visitors-chart stats-traffic-chart">
            <AttendanceChart labels={chartData.labels} values={chartData.values} tooltipLabel={chartData.chartLabel} />
          </div>
        </Card>

        <Card className="panel stats-side-panel" view="filled">
          <div className="panel-header">
            <h3>{breakdown.title}</h3>
            <Button view="flat" size="m">{tabContent.sideButton}</Button>
          </div>
          <div className="visitors-sources-layout stats-sources-layout">
            <div className="visitors-donut-shell">
              <GenericDonutChart items={breakdown.items} />
              <DonutCenter value="100%" />
            </div>
            <div className="visitors-sources-list">
              {breakdown.items.map((item) => (
                <div className="visitors-source-row stats-source-row" key={item.label}>
                  <div className="visitors-source-label">
                    <span className="visitors-source-dot" style={{backgroundColor: item.color}} />
                    <span>{item.label}</span>
                  </div>
                  <strong>{item.count} ({item.value}%)</strong>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="stats-lower-grid">
        {[rankedSection, barsSection].map((section) => (
          <Card className="panel" view="filled" key={section.title}>
            <div className="panel-header">
              <h3>{section.title}</h3>
              <Button view="flat" size="m">{section.cta}</Button>
            </div>

            {section.type === 'ranked' ? (
              <div className="stats-ranked-list">
                {section.items.map((item) => (
                  <div className="stats-ranked-row" key={item.title}>
                    <div className="stats-ranked-main">
                      <span className="stats-ranked-index">{item.rank}</span>
                      <div className={`stats-ranked-thumb ${section.story ? 'is-story' : ''}`} />
                      <strong>{item.title}</strong>
                    </div>
                    <div className="stats-ranked-meta">
                      <span>{item.views}</span>
                      <span className={`stats-ranked-delta ${item.tone === 'negative' ? 'is-negative' : ''}`}>{item.delta}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="stats-device-list">
                  {section.items.map((item) => (
                    <div className="stats-device-row" key={item.label}>
                      <span className="stats-device-name">{item.label}</span>
                      <div className="stats-device-bar">
                        <div className="stats-device-bar-fill" style={{width: `${item.share}%`}} />
                      </div>
                      <strong>{item.share}%</strong>
                    </div>
                  ))}
                </div>
                <div className="stats-footnote">{section.note}</div>
              </>
            )}
          </Card>
        ))}
      </div>

      <div className="stats-footnote">
        {tabContent.footnote}
      </div>
    </section>
  );
}
