import React from 'react';
import {Icon} from '@gravity-ui/uikit';
import {Magnifier, Xmark} from '@gravity-ui/icons';
import {MUSEUM_LIST} from '../config.js';

/* Строка поиска музеев: лупа, поле и кнопка очистки.
   Кнопка вынесена в класс — инлайн-стили здесь не нужны. */
export function MuseumSearchBar({value, onChange, onClear}) {
  return (
    <div className="museum-search" role="search">
      <Icon data={Magnifier} size={16} />
      <input
        className="museum-search-input"
        type="search"
        placeholder={MUSEUM_LIST.searchPlaceholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={MUSEUM_LIST.searchLabel}
      />
      {value && (
        <button className="museum-search-clear" type="button" onClick={onClear} aria-label={MUSEUM_LIST.clearSearch}>
          <Icon data={Xmark} size={16} />
        </button>
      )}
    </div>
  );
}
