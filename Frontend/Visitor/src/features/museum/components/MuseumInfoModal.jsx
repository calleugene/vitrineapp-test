import React, {useState} from 'react';
import {Icon} from '@gravity-ui/uikit';
import {Xmark} from '@gravity-ui/icons';
import {MUSEUM_INFO} from '../config.js';
import {normalizeExternalUrl} from '../utils.js';
import {useModalDismiss} from '../hooks/useModalDismiss.js';
import {ClockIcon, GlobeIcon, PinIcon} from './icons.jsx';
import {museumDirections} from '../directions.js';

/* Модалка «О музее»: обложка с названием, описание, адрес, часы и сайт.

   Закрытие по Escape и первый фокус — в useModalDismiss; адрес сайта
   нормализуется, чтобы небезопасная или относительная ссылка не показывалась. */
export function MuseumInfoModal({museum, onClose}) {
  const closeRef = useModalDismiss(onClose);
  const [failedPhoto, setFailedPhoto] = useState('');
  const hasPhoto = Boolean(museum.cover_image_url) && failedPhoto !== museum.cover_image_url;
  const websiteUrl = normalizeExternalUrl(museum.website);
  const directions = museumDirections(museum.address);

  return (
    <div className="museum-modal-overlay" role="dialog" aria-modal="true" aria-label={MUSEUM_INFO.ariaLabel} onClick={onClose}>
      <div className="museum-modal" onClick={(event) => event.stopPropagation()}>

        {/* Обложка с названием поверх фото — в стиле Meta/Maps */}
        {hasPhoto ? (
          <div className="museum-modal-cover">
            <div className="museum-modal-handle" aria-hidden="true" />
            <img className="museum-modal-cover-img" src={museum.cover_image_url} onError={() => setFailedPhoto(museum.cover_image_url)} alt={museum.name} />
            <div className="museum-modal-cover-scrim" aria-hidden="true" />
            <div className="museum-modal-cover-text">
              <h2 className="museum-modal-cover-name">{museum.name}</h2>
              {museum.category && <span className="museum-modal-cover-cat">{museum.category}</span>}
            </div>
            <button ref={closeRef} className="museum-modal-close museum-modal-close--on-photo" type="button" onClick={onClose} aria-label={MUSEUM_INFO.close}>
              <Icon data={Xmark} size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="museum-modal-handle" aria-hidden="true" />
            <div className="museum-modal-header">
              <h2 className="museum-modal-title">{museum.name}</h2>
              <button ref={closeRef} className="museum-modal-close" type="button" onClick={onClose} aria-label={MUSEUM_INFO.close}>
                <Icon data={Xmark} size={18} />
              </button>
            </div>
          </>
        )}

        <div className="museum-modal-body">
          {!hasPhoto && museum.category && (
            <span className="museum-modal-category-pill">{museum.category}</span>
          )}

          {museum.about && <p className="museum-modal-about">{museum.about}</p>}

          {(directions.length > 0 || museum.hours) && (
            <div className="museum-modal-rows">
              {directions.length > 0 && (
                <details className="museum-address">
                  <summary className="museum-modal-row">
                    <span className="museum-modal-row-icon"><PinIcon /></span>
                    <span className="museum-address-label">
                      <span>{museum.address}</span>
                      <small>Открыть в картах</small>
                    </span>
                    <span className="museum-address-chevron" aria-hidden="true">⌄</span>
                  </summary>
                  <nav className="museum-map-picker" aria-label="Выберите карты для маршрута">
                    <p>Выберите карты. Начальную точку можно указать в них.</p>
                    {directions.map(({name, href}) => (
                      <a key={name} href={href} target="_blank" rel="noopener noreferrer"
                        aria-label={`Построить маршрут — ${name} (откроется в новом окне)`}>
                        {name}<span aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </nav>
                </details>
              )}
              {museum.hours && (
                <div className="museum-modal-row">
                  <span className="museum-modal-row-icon"><ClockIcon /></span>
                  <span className="museum-modal-row-text">{museum.hours}</span>
                </div>
              )}
            </div>
          )}

          {websiteUrl && (
            <a className="museum-modal-cta" href={websiteUrl} target="_blank" rel="noopener noreferrer">
              <GlobeIcon />
              {MUSEUM_INFO.website}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
