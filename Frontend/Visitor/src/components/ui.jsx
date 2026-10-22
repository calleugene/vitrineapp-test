import React from 'react';
import {Skeleton, Button, Icon, Text} from '@gravity-ui/uikit';
import {ArrowLeft} from '@gravity-ui/icons';
import brandMark from '../../../shared/brand-mark.svg';

export function MuseumThumbIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 21h18M4 21V10l8-7 8 7v11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 10h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BackButton({onClick, label = 'Назад'}) {
  return (
    <button type="button" className="page-header-back" onClick={onClick} aria-label={label}>
      <Icon data={ArrowLeft} size={22} aria-hidden="true" />
    </button>
  );
}

export function PageHeader({title, onBack, action = null}) {
  return (
    <header className="page-header">
      <button
        className="page-header-back"
        type="button"
        onClick={onBack}
        aria-label="Назад"
      >
        <Icon data={ArrowLeft} size={22} aria-hidden="true" />
      </button>
      <h1 className="page-header-title">{title}</h1>
      <div className="page-header-right">{action}</div>
    </header>
  );
}

export function BrandHeader({action = null}) {
  return (
    <header className="page-header">
      <img className="page-header-logo" src={brandMark} alt="Витрина" />
      <div className="page-header-right">{action}</div>
    </header>
  );
}

export function SkeletonCards({count = 3}) {
  return (
    <div className="museum-list" aria-busy="true">
      {Array.from({length: count}).map((_, index) => (
        <div className="vl-skeleton-card" key={index} aria-hidden="true">
          <Skeleton className="vl-skeleton-thumb" style={{width: 68, height: 68, borderRadius: 14}} />
          <div className="vl-skeleton-lines">
            <Skeleton style={{height: 16, width: '65%', borderRadius: 6}} />
            <Skeleton style={{height: 12, width: '100%', borderRadius: 6}} />
            <Skeleton style={{height: 12, width: '42%', borderRadius: 6}} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTiles({count = 4}) {
  return (
    <div className="vl-skeleton-grid" aria-busy="true">
      {Array.from({length: count}).map((_, index) => (
        <Skeleton key={index} style={{minHeight: 170, borderRadius: 16}} aria-hidden="true" />
      ))}
    </div>
  );
}

export function RetryState({onRetry, message}) {
  return (
    <div className="vl-retry" role="alert">
      <div className="vl-retry-icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <Text as="h3" variant="subheader-2">Не удалось загрузить</Text>
      <Text as="p" variant="body-1" color="secondary">
        {message || 'Проверьте подключение к интернету и попробуйте снова.'}
      </Text>
      <Button view="action" size="l" pin="round-round" onClick={onRetry}>Повторить</Button>
    </div>
  );
}

export function EmptyState({title, text, ctaLabel, onCta}) {
  return (
    <div className="vl-empty">
      <div className="vl-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M4 7h16M4 7l1.5 12.5a2 2 0 0 0 2 1.5h9a2 2 0 0 0 2-1.5L20 7M9 7V5a3 3 0 0 1 6 0v2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <Text as="h3" variant="subheader-2">{title}</Text>
      <Text as="p" variant="body-1" color="secondary">{text}</Text>
      {ctaLabel ? (
        <Button view="action" size="l" pin="round-round" onClick={onCta}>{ctaLabel}</Button>
      ) : null}
    </div>
  );
}
