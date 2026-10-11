import React from 'react';
import {Button} from '@gravity-ui/uikit';
import {MUSEUM_ACTIONS} from '../config';
import {canSaveProfile} from '../utils';

/* Нижняя панель действий: откат черновика и сохранение + ошибка запроса. */
export function MuseumPageActions({profile, saving, error, onCancel, onSave}) {
  return (
    <>
      <div className="museum-page-actions">
        <Button view="outlined" size="xl" onClick={onCancel}>
          {MUSEUM_ACTIONS.cancel}
        </Button>
        <Button
          view="action"
          size="xl"
          disabled={!canSaveProfile(profile)}
          loading={saving}
          onClick={onSave}
        >
          {MUSEUM_ACTIONS.save}
        </Button>
      </div>
      {error && <p className="museum-save-error" role="alert">{error}</p>}
    </>
  );
}
