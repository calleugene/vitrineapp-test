import React, {useEffect, useRef, useState} from 'react';
import {UI} from '../config';
import {safeHtml} from '../html';

/* Экран сбора артефакта: появляется независимо от контента методиста,
   поэтому сам не решает ничего про навигацию — только показывает состояние сбора. */
export function CollectScreen({title, text, artifactTitle, imageUrl, exitLabel, feedback, isCollected, isCollecting, collectError, onCollect, onExit}) {
  const returnRef = useRef(null);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    if (isCollected) returnRef.current?.focus({preventScroll: true});
  }, [isCollected]);
  return (
    <div className={`story-completion${isCollected ? ' is-saved' : ''}`}>
      <div className="story-completion-object">
        {imageUrl && !imageFailed && <img src={imageUrl} alt="" className="story-completion-photo" onError={() => setImageFailed(true)} />}
        {artifactTitle && <span>{artifactTitle}</span>}
      </div>
      <div className="story-completion-heading" aria-live="polite">
        <span className="story-completion-mark" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h1 className="story-title" dangerouslySetInnerHTML={{__html: safeHtml(isCollected ? 'В вашей коллекции' : title)}} />
        <p className="story-text">{isCollected ? 'Экспонат сохранён. Вы сможете вернуться к его истории в своей коллекции.' : text || 'Сохраните экспонат, чтобы вернуться к его истории.'}</p>
      </div>
      <div className="story-final-actions">
        {!isCollected && <button className="story-cta-btn" type="button" onClick={onCollect} disabled={isCollecting} aria-busy={isCollecting}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 4h12v17l-6-4-6 4V4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
          {isCollecting ? UI.collectBtnInProgress : UI.collectBtnDefault}
        </button>}
        <button ref={returnRef} className={isCollected ? 'story-cta-btn' : 'story-cta-ghost'} type="button" onClick={onExit}>
          {exitLabel || UI.collectGhostDefault}
        </button>
        {collectError && <p className="story-collect-error" role="alert">{collectError}</p>}
      </div>
      {feedback && <div className="story-completion-feedback">{feedback}</div>}
    </div>
  );
}
