import React from 'react';
import {safeHtml} from '../html';

/* Экран открывания: обложка живёт в медиа-слоте, здесь — только контент. */
export function CoverScreen({artifactNumber, title, text}) {
  return (
    <>
      <span className="story-kicker">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><circle cx="5" cy="5" r="5" /></svg>
        {artifactNumber != null ? `Артефакт №${artifactNumber}` : 'Артефакт'}
      </span>
      <h1 className="story-title" dangerouslySetInnerHTML={{__html: safeHtml(title)}} />
      {text && <p className="story-text">{text}</p>}
    </>
  );
}
