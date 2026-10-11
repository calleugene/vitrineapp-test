import React from 'react';
import {safeHtml} from '../html';

/* Экран факта: текст и заметка, которые готовит методист. */
export function FactScreen({title, text, note}) {
  return (
    <>
      <h1 className="story-title" dangerouslySetInnerHTML={{__html: safeHtml(title)}} />
      {text && <p className="story-text">{text}</p>}
      {note && <blockquote className="story-note">{note}</blockquote>}
    </>
  );
}
