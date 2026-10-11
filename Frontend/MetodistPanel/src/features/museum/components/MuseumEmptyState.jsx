import React from 'react';
import {Button, Card} from '@gravity-ui/uikit';
import {MUSEUM_EMPTY} from '../config';

/* Пустое состояние: музей ещё не создан. Отсюда стартует диалог создания. */
export function MuseumEmptyState({onCreate}) {
  return (
    <Card className="panel museum-empty-profile" view="filled">
      <h2>{MUSEUM_EMPTY.title}</h2>
      <p>{MUSEUM_EMPTY.text}</p>
      <Button view="action" size="xl" onClick={onCreate}>
        {MUSEUM_EMPTY.action}
      </Button>
    </Card>
  );
}
