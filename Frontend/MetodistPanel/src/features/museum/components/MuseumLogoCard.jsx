import React, {useRef, useState} from 'react';
import {CloudArrowUpIn, TrashBin, Picture} from '@gravity-ui/icons';
import {Button, Card} from '@gravity-ui/uikit';
import {MUSEUM_LOGO} from '../config';
import {LOGO_ACCEPT_ATTRIBUTE} from '../utils';

// The API's legacy logo_url stores a full museum photograph.
export function MuseumLogoCard({logo, savedLogoUrl, onRemove, disabled}) {
  const previewUrl = logo.previewUrl || savedLogoUrl;
  const [failedUrl, setFailedUrl] = useState(null);
  const inputRef = useRef(null);
  const hasImage = Boolean(previewUrl) && failedUrl !== previewUrl;
  const openPicker = () => {if (!disabled) inputRef.current?.click();};
  return <Card className="panel museum-photo-card" view="filled">
    <div><h3>{MUSEUM_LOGO.title}</h3><p className="museum-photo-caption">Обложка карточки и страницы музея в Visitor</p></div>
    <div className={'museum-photo-dropzone'+(logo.dragActive ? ' is-drag-active' : '')}
      onDragEnter={disabled ? undefined : logo.onDragEnter} onDragOver={(event) => {event.preventDefault();if (!disabled) logo.onDragOver(event);}}
      onDragLeave={logo.onDragLeave} onDrop={(event) => {event.preventDefault();if (!disabled) logo.onDrop(event);}}>
      <input ref={inputRef} type="file" accept={LOGO_ACCEPT_ATTRIBUTE} disabled={disabled} onChange={logo.handleInputChange} hidden />
      <button type="button" className="museum-photo-preview" onClick={openPicker} disabled={disabled} aria-label={hasImage ? 'Заменить изображение музея' : MUSEUM_LOGO.pickLabel}>
        {hasImage ? <img src={previewUrl} alt="Изображение музея для посетителей" onError={() => setFailedUrl(previewUrl)} /> : <span className="museum-photo-empty"><Picture width="32" height="32" /><strong>{previewUrl ? 'Не удалось показать изображение' : 'Добавьте фотографию музея'}</strong><span>Выберите файл или перетащите его сюда</span></span>}
      </button>
      {logo.file && <span className="museum-photo-state">Новое фото · ещё не сохранено</span>}
    </div>
    <p className="museum-photo-caption">{logo.file ? logo.file.file.name : hasImage ? 'Так изображение увидят посетители' : 'Подойдёт фото здания, экспозиции или территории'}</p>
    {logo.error && <p className="museum-save-error" role="alert">{logo.error}</p>}
    <div className="museum-photo-actions">
      <Button view="outlined" size="l" onClick={openPicker} disabled={disabled}><CloudArrowUpIn />{previewUrl ? 'Заменить фото' : 'Загрузить фото'}</Button>
      <Button view="flat-secondary" size="l" onClick={() => {if (inputRef.current) inputRef.current.value='';onRemove();}} disabled={disabled || !previewUrl}><TrashBin />Удалить</Button>
    </div>
    <p className="museum-side-note">{MUSEUM_LOGO.note}</p>
  </Card>;
}
