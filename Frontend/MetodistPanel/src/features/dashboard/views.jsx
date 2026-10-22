import React, {useEffect, useRef} from 'react';
import Chart from 'chart.js/auto';
import museumHero from '../../assets/museum-hero.webp';
import {ArrowRight, FileText, Lock, ChartColumn, Clock, Comment, Route as RouteIcon, CircleInfo} from '@gravity-ui/icons';
import {PRODUCT_CAPABILITIES} from '../../app/capabilities';
import {Button, Card} from '@gravity-ui/uikit';

function BlockState({state, onRetry, empty, emptyIcon: EmptyIcon = FileText, children}) {
  if (state.status === 'loading') return <div className="widget-skeleton" role="status" aria-label="Загружаем данные"><i /><i /><i /></div>;
  if (state.status === 'error') return <div className="widget-state"><span className="widget-state-icon has-neutral-indicator"><FileText /></span><p role="status">Не удалось загрузить данные.</p><Button view="flat-secondary" onClick={onRetry}>Повторить</Button></div>;
  if (empty) return <div className="widget-state"><span className="widget-state-icon"><EmptyIcon /></span><p>Нет данных для отображения.</p></div>;
  return children;
}

export function AttendanceChart({labels, values, tooltipLabel = 'Посещения'}) {
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

    const gradient = context.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.22)');
    gradient.addColorStop(0.6, 'rgba(99, 102, 241, 0.06)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    chartRef.current = new Chart(context, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            data: values,
            borderColor: '#5D5FEF',
            backgroundColor: gradient,
            fill: true,
            borderWidth: 4,
            tension: 0.42,
            cubicInterpolationMode: 'monotone',
            pointRadius: 6,
            pointHoverRadius: 7,
            pointBackgroundColor: '#5D5FEF',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 4,
            pointHoverBackgroundColor: '#5D5FEF',
            pointHoverBorderColor: '#FFFFFF',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 700,
          easing: 'easeOutQuart',
        },
        plugins: {
          legend: {display: false},
          tooltip: {
            displayColors: false,
            backgroundColor: 'rgba(24, 24, 27, 0.92)',
            titleColor: '#FFFFFF',
            bodyColor: '#E5E7EB',
            titleFont: {size: 13, weight: '600'},
            bodyFont: {size: 13},
            padding: 12,
            cornerRadius: 12,
            callbacks: {
              label: (item) => `${tooltipLabel}: ${item.formattedValue}`,
            },
          },
        },
        scales: {
          x: {
            border: {display: false},
            grid: {display: false, drawTicks: false},
            ticks: {
              color: '#8B90A5',
              font: {size: 12, weight: '500'},
              padding: 12,
            },
          },
          y: {
            beginAtZero: true,
            border: {display: false},
            grid: {color: 'rgba(93, 95, 239, 0.08)', drawTicks: false},
            ticks: {
              color: '#A0A5B8',
              font: {size: 11},
              padding: 10,
              maxTicksLimit: 5,
            },
          },
        },
        layout: {
          padding: {top: 18, right: 16, bottom: 6, left: 10},
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [labels, values, tooltipLabel]);

  return (
    <div className="chart-canvas-shell">
      <canvas ref={canvasRef} className="chart-canvas" />
    </div>
  );
}

export function DashboardView({setView, userName, dashboardData, dashboardStates, retryDashboardBlock}) {
  const retry = (key) => () => retryDashboardBlock(key);
  return (
    <section className="page dashboard-page">
      <div className="dashboard-welcome">
      <img className="dashboard-hero-art" src={museumHero} width="1600" height="600" alt="" fetchPriority="high" />
      <div className="page-heading">
        <div>
          <h1>Добрый день,<br />{userName || 'методист'}!</h1>
          <p>Смотрите, что происходит в вашем музее сегодня.</p>
        </div>
      </div>

      {dashboardStates.summary.status === 'success' && dashboardData.summary.length > 0 ? <div className="stats-grid">
        {dashboardData.summary.map((item) => (
          <Card key={item.title} className="stat-card" view="filled">
            <div className="stat-value">{item.value}</div>
            <div className="stat-title">{item.title}</div>
            <div className="stat-delta">{item.delta}</div>
          </Card>
        ))}
      </div> : <div className="stats-grid"><Card className="panel" view="filled"><BlockState state={dashboardStates.summary} onRetry={retry('summary')} empty={!dashboardData.summary.length} /></Card></div>}

      </div>
      <div className="dashboard-grid">
        <Card className="panel panel-large" view="filled">
          <div className="panel-header">
            <h3><ChartColumn aria-hidden="true" />Посещаемость</h3>
            <span aria-label="Период посещаемости">Месяц</span>
          </div>
          <p className="chart-note"><CircleInfo aria-hidden="true" />Неделя и год недоступны для этого источника данных.</p>
          {dashboardStates.attendance.status === 'success' && dashboardData.attendance.labels.length > 0
            ? <><div className="chart"><AttendanceChart labels={dashboardData.attendance.labels} values={dashboardData.attendance.values} /></div>{dashboardData.attendance.note ? <div className="chart-note">{dashboardData.attendance.note}</div> : null}</>
            : <BlockState state={dashboardStates.attendance} emptyIcon={ChartColumn} onRetry={retry('attendance')} empty={dashboardStates.attendance.status === 'success'} />}
        </Card>

        <Card className="panel" view="filled">
          <div className="panel-header">
            <h3><Clock aria-hidden="true" />Недавняя активность</h3>
            
          </div>
          <BlockState state={dashboardStates.recentActivity} emptyIcon={Clock} onRetry={retry('recentActivity')} empty={!dashboardData.recentActivity.length}>
          <ul className="activity-feed">
            {dashboardData.recentActivity.map((item) => (
              <li className="activity-feed-item" key={item.title}>
                <div className="activity-feed-copy">
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                </div>
              </li>
            ))}
          </ul></BlockState>
        </Card>

        <Card className="panel" view="filled">
          <div className="panel-header">
            <h3><RouteIcon aria-hidden="true" />Популярные маршруты</h3>
            {PRODUCT_CAPABILITIES.routes && <Button view="flat" size="m" onClick={() => setView('routes')}>Смотреть все</Button>}
          </div>
          {!PRODUCT_CAPABILITIES.routes ? <div className="widget-state"><span className="widget-state-icon"><Lock /></span><p>Скоро появится</p><small>Доступно в следующих обновлениях</small></div> : <BlockState state={dashboardStates.popularRoutes} onRetry={retry('popularRoutes')} empty={!dashboardData.popularRoutes.length}><div className="rank-list">
            {dashboardData.popularRoutes.map((route) => (
              <div className="rank-card" key={route.title}>
                <div className="rank-card-main">
                  <div className="rank-badge">{route.rank}</div>
                  <div className="rank-copy">
                    <div className="rank-title-row"><strong>{route.title}</strong></div>
                    <span className="rank-description">{route.description}</span>
                    {route.progress !== null ? <div className="rank-progress"><div className="rank-progress-bar" style={{width: `${route.progress}%`}} /></div> : null}
                  </div>
                </div>
                <div className="rank-metric">
                  <span className={`rank-trend-chip ${route.delta.startsWith('-') ? 'is-negative' : ''}`}>{route.delta}</span>
                  <strong>{route.visits}</strong>
                  <span>{route.progress === null ? 'Завершение —' : `Завершение ${route.progress}%`}</span>
                </div>
              </div>
            ))}
          </div></BlockState>}
        </Card>

        <Card className="panel" view="filled">
          <div className="panel-header">
            <h3><Comment aria-hidden="true" />Заявки и обратная связь</h3>
            <Button view="flat" size="m" onClick={() => setView('feedback')}>Смотреть все <ArrowRight /></Button>
          </div>
          <BlockState state={dashboardStates.feedbackItems} emptyIcon={Comment} onRetry={retry('feedbackItems')} empty={!dashboardData.feedbackItems.length}><ul className="feedback-feed">
            {dashboardData.feedbackItems.map((item) => (
              <li className="feedback-feed-item" key={item.title}>
                <div className="feedback-feed-copy">
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                  <small>{item.meta}</small>
                </div>
                <button type="button" className="feedback-expand-button" onClick={() => setView('feedback')} aria-label={`Открыть ${item.title}`}>
                  <ArrowRight />
                </button>
              </li>
            ))}
          </ul></BlockState>
        </Card>
      </div>
    </section>
  );
}
