import React, {useEffect, useRef, useState} from 'react';
import Chart from 'chart.js/auto';
import {ArrowRight} from '@gravity-ui/icons';
import {Button, Card, SegmentedRadioGroup} from '@gravity-ui/uikit';
import {ATTENDANCE_SERIES} from '../../app/constants';

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

export function DashboardView({setView, userName, dashboardData}) {
  const [attendancePeriod, setAttendancePeriod] = useState('month');
  const attendanceData = attendancePeriod === 'month' ? dashboardData.attendance : ATTENDANCE_SERIES[attendancePeriod];

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>Добрый день, {userName || 'методист'}!</h1>
          <p>Смотрите, что происходит в вашем музее сегодня.</p>
        </div>
      </div>

      <div className="stats-grid">
        {dashboardData.summary.map((item) => (
          <Card key={item.title} className="stat-card" view="filled">
            <div className="stat-value">{item.value}</div>
            <div className="stat-title">{item.title}</div>
            <div className="stat-delta">{item.delta}</div>
          </Card>
        ))}
      </div>

      <div className="dashboard-grid">
        <Card className="panel panel-large" view="filled">
          <div className="panel-header">
            <h3>Посещаемость</h3>
            <SegmentedRadioGroup
              size="m"
              value={attendancePeriod}
              options={[
                {value: 'week', content: 'Неделя'},
                {value: 'month', content: 'Месяц'},
                {value: 'year', content: 'Год'},
              ]}
              onUpdate={setAttendancePeriod}
            />
          </div>
          <div className="chart">
            <AttendanceChart labels={attendanceData.labels} values={attendanceData.values} />
          </div>
          <div className="chart-note">{attendanceData.note}</div>
        </Card>

        <Card className="panel" view="filled">
          <div className="panel-header">
            <h3>Недавняя активность</h3>
            <Button view="flat" size="m">Смотреть все</Button>
          </div>
          <ul className="activity-feed">
            {dashboardData.recentActivity.map((item) => (
              <li className="activity-feed-item" key={item.title}>
                <div className="activity-feed-copy">
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="panel" view="filled">
          <div className="panel-header">
            <h3>Популярные маршруты</h3>
            <Button view="flat" size="m" onClick={() => setView('routes')}>Смотреть все</Button>
          </div>
          <div className="rank-list">
            {dashboardData.popularRoutes.map((route) => (
              <div className="rank-card" key={route.title}>
                <div className="rank-card-main">
                  <div className="rank-badge">{route.rank}</div>
                  <div className="rank-copy">
                    <div className="rank-title-row"><strong>{route.title}</strong></div>
                    <span className="rank-description">{route.description}</span>
                    <div className="rank-progress"><div className="rank-progress-bar" style={{width: `${route.progress}%`}} /></div>
                  </div>
                </div>
                <div className="rank-metric">
                  <span className={`rank-trend-chip ${route.delta.startsWith('-') ? 'is-negative' : ''}`}>{route.delta}</span>
                  <strong>{route.visits}</strong>
                  <span>Завершение {route.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="panel" view="filled">
          <div className="panel-header">
            <h3>Заявки и обратная связь</h3>
            <Button view="flat" size="m">Смотреть все</Button>
          </div>
          <ul className="feedback-feed">
            {dashboardData.feedbackItems.map((item) => (
              <li className="feedback-feed-item" key={item.title}>
                <div className="feedback-feed-copy">
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                  <small>{item.meta}</small>
                </div>
                <button type="button" className="feedback-expand-button" aria-label={`Открыть ${item.title}`}>
                  <ArrowRight />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}
