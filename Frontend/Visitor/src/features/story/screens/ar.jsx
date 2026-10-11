import React from 'react';
import {UI} from '../config';
import {safeHtml} from '../html';

/* Экран 3D/AR: модель рисует медиа-слот, здесь — текст и запуск взаимодействия. */
export function ArScreen({title, text, onActivate}) {
  return (
    <>
      <h1 className="story-title" dangerouslySetInnerHTML={{__html: safeHtml(title)}} />
      {text && <p className="story-text">{text}</p>}
      <button
        className="story-ar-play-btn"
        type="button"
        onClick={onActivate}
        aria-label={UI.arActionLabel}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5.14v14l11-7-11-7Z" />
        </svg>
        {UI.arActionButton}
      </button>
    </>
  );
}
