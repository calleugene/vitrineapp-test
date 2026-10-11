import React from 'react';
import {RetryState} from '../../../components/ui.jsx';
import {MUSEUM_DETAIL} from '../config.js';

/* Состояния экрана музея до появления данных: спиннер при загрузке
   и RetryState с повтором и возвратом к списку при ошибке. */
export function MuseumLoadingState() {
  return (
    <div className="museum-detail-state" role="status" aria-live="polite">
      <div className="museum-spinner" aria-hidden="true" />
      <p className="museum-detail-loading-text">{MUSEUM_DETAIL.loading}</p>
    </div>
  );
}

export function MuseumErrorState({onRetry, onBack}) {
  return (
    <div className="museum-detail-state">
      <RetryState onRetry={onRetry} message={MUSEUM_DETAIL.loadError} />
      <button className="text-button" type="button" onClick={onBack}>
        {MUSEUM_DETAIL.backToList}
      </button>
    </div>
  );
}
