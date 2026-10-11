import React, {useRef} from 'react';
import {CloudArrowUpIn, TrashBin} from '@gravity-ui/icons';
import {Button, Card} from '@gravity-ui/uikit';
import {MUSEUM_LOGO} from '../config';
import {LOGO_ACCEPT_ATTRIBUTE} from '../utils';

/* Карточка «Логотип музея»: dropzone с превью и кнопки загрузки/удаления.

   Состояние (файл, drag, ошибка) живёт в useMuseumLogo — здесь только разметка.
   Бейдж честно различает три случая: логотип на сервере, локально выбранный
   файл и пусто. */
export function MuseumLogoCard({logo, savedLogoUrl, onRemove}) {
  const previewUrl = logo.previewUrl || savedLogoUrl;
  const state = logo.file ? 'selected' : savedLogoUrl ? 'saved' : 'empty';
  const hasLogo = Boolean(previewUrl);

  /* Реф живёт здесь же, где и сам <input>: хук про него не знает,
     поэтому во время рендера ref не читается — только в обработчиках. */
  const inputRef = useRef(null);
  const openPicker = () => inputRef.current?.click();
  const handleRemove = () => {
    if (inputRef.current) inputRef.current.value = '';
    onRemove();
  };

  return (
    <Card className="panel museum-side-card museum-logo-card" view="filled">
      <h3>{MUSEUM_LOGO.title}</h3>

      <div
        className={`museum-logo-dropzone ${logo.dragActive ? 'is-drag-active' : ''} ${hasLogo ? 'has-logo' : ''}`}
        onDragEnter={logo.onDragEnter}
        onDragOver={logo.onDragOver}
        onDragLeave={logo.onDragLeave}
        onDrop={logo.onDrop}
      >
        <input
          ref={inputRef}
          className="museum-logo-input"
          type="file"
          accept={LOGO_ACCEPT_ATTRIBUTE}
          onChange={logo.handleInputChange}
        />

        <div className={`museum-logo-badge ${hasLogo ? 'is-uploaded' : ''}`}>
          {MUSEUM_LOGO.badge[state]}
        </div>

        <button type="button" className="museum-logo-preview" onClick={openPicker} aria-label={MUSEUM_LOGO.pickLabel}>
          {previewUrl ? (
            <img src={previewUrl} alt={MUSEUM_LOGO.previewAlt} />
          ) : (
            <span className="museum-logo-mark">🏛</span>
          )}
        </button>

        <div className="museum-logo-meta">
          <strong>{MUSEUM_LOGO.status[state]}</strong>
          <span>{logo.file?.file.name || MUSEUM_LOGO.placeholder}</span>
        </div>
      </div>

      {logo.error && <p className="museum-save-error" role="alert">{logo.error}</p>}

      <div className="museum-logo-actions">
        <Button view="outlined" size="l" width="max" onClick={openPicker}>
          <CloudArrowUpIn />
          {MUSEUM_LOGO.upload}
        </Button>
        <Button
          view="outlined"
          size="l"
          className="museum-logo-delete-button"
          onClick={handleRemove}
          disabled={!hasLogo}
          aria-label={MUSEUM_LOGO.removeLabel}
        >
          <TrashBin />
        </Button>
      </div>

      <p className="museum-side-note">{MUSEUM_LOGO.note}</p>
    </Card>
  );
}
