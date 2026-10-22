import React from 'react';
import {safeHtml} from '../html';

/* Экран открывания: обложка живёт в медиа-слоте, здесь — только контент. */
export function CoverScreen({title, text}) {
  return (
    <>
      <h1 className="story-title" dangerouslySetInnerHTML={{__html: safeHtml(title)}} />
      {text && <p className="story-text">{text}</p>}
    </>
  );
}
