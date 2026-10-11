import React from 'react';
import {UI} from '../config';
import {safeHtml} from '../html';
import {RESULT_BADGE} from './icons';

/* Экран сбора артефакта: появляется независимо от контента методиста,
   поэтому сам не решает ничего про навигацию — только показывает состояние сбора. */
export function CollectScreen({badge, title, text, isCollected, isCollecting, collectError, onCollect, onExit}) {
  return (
    <>
      {badge && (
        <span className="story-result-badge" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            {RESULT_BADGE[badge]}
          </svg>
        </span>
      )}
      <span className="story-kicker story-kicker--gold">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="m12 4 2.5 5.1 5.6.8-4 3.9 1 5.6L12 22l-5-2.6 1-5.6-4-3.9 5.6-.8L12 4Z" />
        </svg>
        {UI.finalKicker}
      </span>
      <h1 className="story-title" dangerouslySetInnerHTML={{__html: safeHtml(title)}} />
      {text && <p className="story-text">{text}</p>}
      <div className="story-final-actions">
        <button className="story-cta-btn" type="button" onClick={onCollect} disabled={isCollected || isCollecting}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m12 4 2.5 5.1 5.6.8-4 3.9 1 5.6L12 22l-5-2.6 1-5.6-4-3.9 5.6-.8L12 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          {isCollected ? UI.collectBtnDone : isCollecting ? UI.collectBtnInProgress : UI.collectBtnDefault}
        </button>
        <button className="story-cta-ghost" type="button" onClick={onExit}>
          {isCollected ? UI.collectGhostDone : UI.collectGhostDefault}
        </button>
        {collectError && <p className="story-collect-error" role="alert">{collectError}</p>}
      </div>
    </>
  );
}
