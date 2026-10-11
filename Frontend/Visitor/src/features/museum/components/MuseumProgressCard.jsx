import React from 'react';
import {MUSEUM_DETAIL} from '../config.js';
import {readMuseumProgress} from '../utils.js';
import {ClockIcon} from './icons.jsx';

/* Карточка прогресса: сколько найдено, бар и подсказка.

   Прогресс и признак «всё найдено» берутся из одного источника
   (readMuseumProgress), поэтому подсказка и скрытие кнопки сканирования
   всегда согласованы между собой. */
export function MuseumProgressCard({museum}) {
  const {found, total, percent, allFound} = readMuseumProgress(museum);
  const left = Math.max(total - found, 0);

  return (
    <div className="museum-progress-card">
      <div className="museum-progress-top">
        <div className="museum-progress-stat">
          <span className="museum-progress-big">{found}</span>
          <span className="museum-progress-of">{MUSEUM_DETAIL.ofWord} {total}</span>
          <span className="museum-progress-word">{MUSEUM_DETAIL.foundWord}</span>
        </div>
        <div className="museum-progress-time">
          <ClockIcon size={14} />
          {MUSEUM_DETAIL.minutes(museum.estimated_minutes)}
        </div>
      </div>

      <div
        className="museum-progress-track"
        role="progressbar"
        aria-label={MUSEUM_DETAIL.progressAriaLabel}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="museum-progress-fill" style={{width: `${percent}%`}} />
      </div>

      <div className="museum-progress-hint">
        {allFound ? MUSEUM_DETAIL.allFound : MUSEUM_DETAIL.remaining(left, percent)}
      </div>
    </div>
  );
}
