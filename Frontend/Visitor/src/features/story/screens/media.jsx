import React, {useState} from 'react';
import {UI} from '../config';
import {ArModelViewer} from '../ArModelViewer';
import {MEDIA_ICON} from './icons';

function StoryPhoto({src, isCover}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="story-media" aria-hidden="true">
      {!failed && <img className="story-photo" src={src} alt="" loading={isCover ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />}
    </div>
  );
}

/* Медиа-слот слайда: выбирает фон по screen.media (image / ar / none).
   Живёт отдельно от форм контента, потому что медиа задаётся данными,
   а не тем, что методист написал в текстовом блоке. */
export function SlideMedia({screen, onArInteraction}) {
  if (screen.media === 'none') {
    return <div className={`story-media story-media--plain story-media--${screen.type}`} aria-hidden="true" />;
  }

  const asset = screen.imageUrl || screen.modelUrl;

  if (screen.media === 'ar') {
    if (screen.modelUrl) return <ArModelViewer modelUrl={screen.modelUrl} onInteraction={onArInteraction} />;
    return (
      <div className="story-media story-media--ar" aria-hidden="true">
        <span className="story-ph-shimmer" />
        <span className="story-ar-frame">
          <i /><i /><i /><i />
          <span className="story-ar-scanline" />
          <span className="story-ar-grid" />
          <span className="story-ar-scan-label">{UI.arScanning}</span>
        </span>
        <span className="story-ph-chip">
          <span className="story-ph-icon">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">{MEDIA_ICON.ar}</svg>
          </span>
          <span className="story-ph-label">{screen.mediaLabel}</span>
        </span>
        <span className="story-ar-pill story-ar-pill--placeholder" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <path d="m4 7 8 4 8-4M12 11v10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          AR
        </span>
      </div>
    );
  }

  if (asset && screen.media === 'image') {
    return <StoryPhoto key={asset} src={asset} isCover={screen.type === 'cover'} />;
  }

  if (screen.media === 'image') return <div className="story-media story-media--plain" aria-hidden="true" />;

  return (
    <div className={`story-media story-media--${screen.media} story-media--${screen.type}`} aria-hidden="true">
      <span className="story-ph-shimmer" />
      <span className="story-ph-chip">
        <span className="story-ph-icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            {MEDIA_ICON[screen.media] || MEDIA_ICON.image}
          </svg>
        </span>
        <span className="story-ph-label">{screen.mediaLabel}</span>
      </span>
    </div>
  );
}
