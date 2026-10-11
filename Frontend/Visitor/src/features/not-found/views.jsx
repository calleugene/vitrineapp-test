import React from 'react';
import {Button} from '@gravity-ui/uikit';
import './not-found.css';

export function NotFoundView({navigate}) {
  return (
    <section className="not-found-screen" aria-label="Страница не найдена">
      <div className="not-found-dust" aria-hidden="true" />
      <div className="not-found-dust" aria-hidden="true" />
      <div className="not-found-dust" aria-hidden="true" />
      <div className="not-found-dust" aria-hidden="true" />

      <div className="not-found-exhibit">
        <div className="not-found-rope" aria-hidden="true" />
        <div className="not-found-case">
          <div className="not-found-number" aria-label="404">404</div>
          <div className="not-found-tag">
            <span className="not-found-tag-dot" />
            Экспонат не найден
          </div>
        </div>
      </div>

      <h1 className="not-found-title">Этот зал закрыт</h1>
      <p className="not-found-subtitle">
        Экспонат был перемещён, или такого маршрута не существует.
        Попробуйте вернуться к главному входу.
      </p>

      <div className="not-found-actions">
        <Button view="action" size="xl" width="max" onClick={() => navigate('museumSelect')}>
          Вернуться в музей
        </Button>
        <Button view="outlined" size="xl" width="max" onClick={() => navigate('profileHome')}>
          Профиль
        </Button>
      </div>
    </section>
  );
}
