import React from 'react';
import {Calendar} from '@gravity-ui/icons';
import {Button} from '@gravity-ui/uikit';

export function HeaderActions({view}) {
  if (view === 'museum') {
    return null;
  }

  if (view === 'stats') {
    return (
      <div className="topbar-actions">
        <Button view="outlined" size="l">
          <Calendar />
          12 мая — 11 июня 2024
        </Button>
        <Button view="outlined" size="l">
          Скачать отчёт
        </Button>
      </div>
    );
  }

  if (view === 'feedback') {
    return (
      <Button view="outlined" size="l">
        Скачать отчёт
      </Button>
    );
  }

  if (
    view === 'user-profile' ||
    view === 'artifacts' ||
    view === 'routes' ||
    view === 'route-basic' ||
    view === 'route-content' ||
    view === 'route-publish' ||
    view === 'artifact-basic' ||
    view === 'artifact-content' ||
    view === 'artifact-publish' ||
    view.startsWith('editor-')
  ) {
    return null;
  }

  return (
    <Button view="outlined" size="l">
      Скачать отчёт
    </Button>
  );
}
