import React, {useState} from 'react';
import {Icon} from '@gravity-ui/uikit';
import {CircleInfo} from '@gravity-ui/icons';
import {MUSEUM_DETAIL} from '../config.js';
import {MuseumGlyph, PinIcon} from './icons.jsx';

/* Шапка экрана музея: обложка (или эмблема) и кнопка «О музее».

   Раньше весь блок был aria-hidden — из-за этого кнопка «О музее»
   была недоступна скринридеру. Сейчас скрыты только декоративные
   узлы: иконка, фото (имя музея уже есть в заголовке страницы) и
   дублирующее название поверх фото. */
export function MuseumHero({museum, onOpenInfo}) {
  const [failedPhoto, setFailedPhoto] = useState('');
  const hasPhoto = Boolean(museum.cover_image_url) && failedPhoto !== museum.cover_image_url;

  return (
    <div className={`museum-hero-large${hasPhoto ? ' museum-hero-large--photo' : ''}`}>
      {hasPhoto ? (
        <img className="museum-hero-photo" src={museum.cover_image_url} onError={() => setFailedPhoto(museum.cover_image_url)} alt="" />
      ) : (
        <div className="museum-hero-large-icon" aria-hidden="true">
          <MuseumGlyph />
        </div>
      )}

      <button className="museum-info-btn" type="button" onClick={onOpenInfo}>
        <Icon data={CircleInfo} size={13} />
        {MUSEUM_DETAIL.infoButton}
      </button>

      {hasPhoto ? (
        <div className="museum-hero-overlay">
          <h2 className="museum-hero-overlay-name" aria-hidden="true">{museum.name}</h2>
          {museum.city && (
            <p className="museum-hero-overlay-city">
              <PinIcon size={11} strokeWidth={2.2} />
              {museum.city}
            </p>
          )}
        </div>
      ) : (
        museum.city && (
          <div className="museum-hero-large-caption">
            {museum.city}{museum.route_title ? ` · ${museum.route_title}` : ''}
          </div>
        )
      )}
    </div>
  );
}
