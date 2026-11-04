import React, {useEffect, useState} from 'react';
import {appConfig} from '../../app/config.js';
import './public-stats.css';

const number = new Intl.NumberFormat('ru-RU');
const devices = {phone: 'Телефон', desktop: 'ПК', tablet: 'Планшет'};

function duration(value) {
  const seconds = Math.round(value);
  const parts = [
    [Math.floor(seconds / 3600), 'ч'],
    [Math.floor(seconds / 60) % 60, 'мин'],
    [seconds % 60, 'с'],
  ];
  return parts.filter(([amount]) => amount > 0)
    .map(([amount, unit]) => `${number.format(amount)} ${unit}`).join(' ') || '0 с';
}

const sections = [
  ['Музеи и экспонаты', [
    ['museums', 'Музеи', 'Все музейные профили'],
    ['artifacts', 'Экспонаты всего', 'Включая черновики и архив'],
    ['viewed_artifacts', 'Просмотренные экспонаты', 'Уникальные экспонаты, которые открывали посетители'],
  ]],
  ['Посетители', [
    ['visitors', 'Пользователи-посетители', 'Зарегистрированные аккаунты'],
    ['view_seconds', 'Среднее время просмотра', 'Активное время за один просмотр экспоната', duration],
    ['devices', 'Самое популярное устройство', 'По числу просмотров с известным типом устройства',
      (values) => values.map((device) => devices[device]).filter(Boolean).join(', ')],
  ]],
  ['Методисты', [
    ['methodists', 'Пользователи-методисты', 'Зарегистрированные аккаунты'],
    ['session_seconds', 'Среднее время сессии', 'Время работы в открытой вкладке кабинета', duration],
    ['add_artifact_seconds', 'Среднее время добавления экспоната',
      'От начала создания до первого сохранения черновика', duration],
  ]],
];

export function PublicStats() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = 'Статистика Витрины';
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(appConfig.publicStatsUrl, {signal: controller.signal})
      .then((response) => {
        if (!response.ok) throw new Error('Statistics unavailable');
        return response.json();
      })
      .then(setStats)
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <main className="public-stats">
      <header>
        <a href="/museums">← К музеям</a>
        <h1>Статистика Витрины</h1>
        <p>Сводные показатели по всем музеям за всё время</p>
      </header>
      {error ? (
        <div>
          <p role="alert">Не удалось загрузить статистику.</p>
          <button type="button" onClick={() => {setError(false); setAttempt(attempt + 1);}}>Повторить</button>
        </div>
      ) : !stats ? (
        <p role="status">Загружаем статистику…</p>
      ) : sections.map(([title, metrics]) => (
        <section key={title}>
          <h2>{title}</h2>
          <dl>
            {metrics.map(([key, label, note, format = (value) => number.format(value)]) => {
              const value = stats[key] == null ? '' : format(stats[key]);
              return (
                <div className="public-stats-card" key={key}>
                  <dt>{label}</dt>
                  <dd>
                    <strong className={value ? '' : 'public-stats-empty'}>{value || 'Нет данных'}</strong>
                    <small>{note}</small>
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </main>
  );
}
