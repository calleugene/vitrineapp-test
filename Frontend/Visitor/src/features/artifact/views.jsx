import React from 'react';
import {Button, Label, Icon} from '@gravity-ui/uikit';
import {ArrowLeft, House, CircleCheckFill} from '@gravity-ui/icons';

function getActiveArtifact(data) {
  const detail = data.museumDetail;
  if (!detail) return null;
  return detail.artifacts.find((a) => a.id === data.activeArtifactId) || null;
}

export function ArtifactFoundView({data, navigate, actions}) {
  const artifact = getActiveArtifact(data);
  const description = artifact
    ? `${artifact.title}. ${artifact.description || artifact.subtitle || 'Откройте мини-историю, чтобы узнать больше.'}`
    : '';

  return (
    <section className="app-view app-shell is-active" aria-label="Артефакт найден">
      <div className="found-layout">
        <div className="status-screen-nav">
          <button type="button" className="page-header-back" onClick={() => navigate('museumDetail')} aria-label="Назад в музей">
            <Icon data={ArrowLeft} size={22} aria-hidden="true" />
          </button>
          <button type="button" className="page-header-back" onClick={() => navigate('museumSelect')} aria-label="Перейти в меню музеев">
            <Icon data={House} size={22} aria-hidden="true" />
          </button>
        </div>

        <Label theme="success" size="m" icon={<Icon data={CircleCheckFill} size={14} />} className="status-chip-gu">
          Артефакт найден
        </Label>

        <div className="artifact-celebration" aria-hidden="true">
          <svg className="artifact-found-icon" width="60" height="60" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 9.5 12 4l8 5.5M6 10v8m4-8v8m4-8v8m4-8v8M3 20h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1>Артефакт найден!</h1>
        <p>{description}</p>

        <div className="sticky-actions">
          <Button view="action" size="xl" width="max" pin="round-round" onClick={actions.openStory}>
            Открыть историю
          </Button>
          <Button view="outlined" size="l" width="max" pin="round-round" onClick={actions.collectActiveArtifact}>
            Получить артефакт
          </Button>
          <Button view="flat" size="l" onClick={() => navigate('museumSelect')}>
            В меню музеев
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ArtifactReceivedView({data, navigate}) {
  const artifact = getActiveArtifact(data);
  const museum = data.museumDetail;
  const found = museum ? museum.found_artifacts : 0;
  const total = museum ? museum.total_artifacts : 0;
  const remaining = Math.max(total - found, 0);

  return (
    <section className="app-view app-shell received-view is-active" aria-label="Артефакт получен">
      <div className="received-layout">
        <div className="status-screen-nav">
          <button type="button" className="page-header-back" onClick={() => navigate('museumDetail')} aria-label="Назад в музей">
            <Icon data={ArrowLeft} size={22} aria-hidden="true" />
          </button>
          <button type="button" className="page-header-back" onClick={() => navigate('museumSelect')} aria-label="Перейти в меню музеев">
            <Icon data={House} size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="success-mark" aria-hidden="true">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
            <path d="m5 12 4.2 4.2L19 6.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1>Артефакт получен!</h1>
        {artifact && <p className="received-artifact-name">«{artifact.title}»</p>}
        {remaining > 0 ? (
          <p className="received-desc">Добавлено в коллекцию. Осталось найти ещё {remaining}.</p>
        ) : (
          <p className="received-desc">Все артефакты музея найдены. Отличная работа!</p>
        )}

        {total > 0 && (
          <div className="received-progress" aria-label={`Найдено ${found} из ${total}`}>
            <div className="received-progress-dots" aria-hidden="true">
              {Array.from({length: total}, (_, i) => (
                <span key={i} className={`received-dot${i < found ? ' received-dot--filled' : ''}`} />
              ))}
            </div>
            <span className="received-progress-label">{found} из {total} найдено</span>
          </div>
        )}

        <div className="sticky-actions">
          <Button view="action" size="xl" width="max" pin="round-round" onClick={() => navigate('museumDetail')}>
            Продолжить поиск
          </Button>
          <Button view="outlined" size="l" width="max" pin="round-round" onClick={() => navigate('museumSelect')}>
            В меню музеев
          </Button>
        </div>
      </div>
    </section>
  );
}


export function ArtifactCardView({data, navigate, actions}) {
  const detail = data.artifactDetail;
  if (!detail) {
    return (
      <section className="app-view app-shell is-active" aria-label="Загрузка артефакта">
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#1a1a1a'}}>
          {data.loading ? (
            <div style={{textAlign: 'center', color: '#aaa'}}>
              <div style={{width: 32, height: 32, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#fff', borderRadius: '50%', animation: 'vl-spin 0.7s linear infinite', margin: '0 auto 12px'}} />
              <p>Загружаем артефакт…</p>
            </div>
          ) : (
            <div style={{textAlign: 'center', color: '#aaa'}}>
              <p>Артефакт не найден</p>
              <button type="button" onClick={() => navigate('profileCollection')} style={{marginTop: 8, color: '#695bff', background: 'none', border: 'none', cursor: 'pointer'}}>Вернуться в коллекцию</button>
            </div>
          )}
        </div>
      </section>
    );
  }
  const fav = Boolean(detail.is_favorite);

  return (
    <section className="app-view app-shell is-active artifact-immersive" aria-label="Карточка артефакта">
      <div className="art-imm-topbar">
        <button className="art-imm-ghost-btn" type="button" onClick={() => navigate('profileCollection')} aria-label="Назад">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className={`art-imm-ghost-btn art-imm-fav ${fav ? 'is-active' : ''}`}
          type="button"
          onClick={actions.toggleFavorite}
          aria-pressed={fav}
          aria-label={fav ? 'Убрать из избранного' : 'Добавить в избранное'}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} aria-hidden="true">
            <path d="m12 20-1.45-1.32C5.4 14.02 2 10.92 2 7.12 2 4.02 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09C13.09 2.81 14.76 2 16.5 2 19.58 2 22 4.02 22 7.12c0 3.8-3.4 6.9-8.55 11.58L12 20Z"
              stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="art-imm-media" aria-hidden="true">
        {detail.image_url ? (
          <img className="art-imm-img" src={detail.image_url} alt={detail.title} loading="eager" />
        ) : (
          <div className="art-imm-placeholder">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
              <path d="M4 9.5 12 4l8 5.5M6 10v8m4-8v8m4-8v8m4-8v8M3 20h18" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      <div className="art-imm-overlay">
        {detail.museum_name && (
          <span className="art-imm-kicker">{detail.museum_name}</span>
        )}
        <h1 className="art-imm-title">{detail.title}</h1>
        {(detail.description || detail.subtitle) && (
          <p className="art-imm-sub">{detail.description || detail.subtitle}</p>
        )}
        <button className="art-imm-cta" type="button" onClick={() => navigate('storyExperience')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M10 8.5l6 3.5-6 3.5V8.5Z" fill="currentColor" />
          </svg>
          Смотреть историю ещё раз
        </button>
      </div>
    </section>
  );
}
