import React, {useState} from 'react';
import {PageHeader, EmptyState, SkeletonTiles} from '../../components/ui.jsx';
import {formatFoundAt} from '../../app/utils.js';
import {Button} from '@gravity-ui/uikit';
import '../profile/profile.css';

const CARD_PALETTES = [
  {from: '#ede9fe', to: '#ddd6fe', icon: '#7c3aed'},
  {from: '#e0f2fe', to: '#bae6fd', icon: '#0284c7'},
  {from: '#fef9c3', to: '#fde68a', icon: '#ca8a04'},
  {from: '#dcfce7', to: '#bbf7d0', icon: '#16a34a'},
  {from: '#ffe4e6', to: '#fecdd3', icon: '#e11d48'},
];

function getPalette(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
  return CARD_PALETTES[h % CARD_PALETTES.length];
}

export function CollectionCard({item, onOpen}) {
  const p = getPalette(item.id);
  return (
    <div
      className="coll-card"
      onClick={() => onOpen(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen(item.id)}
      aria-label={item.title}
    >
      <div
        className="coll-card-media"
        style={{background: `linear-gradient(135deg, ${p.from} 0%, ${p.to} 100%)`}}
        aria-hidden="true"
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" style={{color: p.icon}}>
          <path d="M4 9.5 12 4l8 5.5M6 10v8m4-8v8m4-8v8m4-8v8M3 20h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="coll-card-body">
        <p className="coll-card-title">{item.title}</p>
        <p className="coll-card-meta">
          {item.found_at ? formatFoundAt(item.found_at) : item.museum_name || ''}
        </p>
      </div>
    </div>
  );
}

function groupByMuseum(items) {
  const order = [];
  const groups = {};
  items.forEach((item) => {
    const key = item.museum_name || 'Другой музей';
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(item);
  });
  return order.map((key) => [key, groups[key]]);
}

function GuestCollectionLock({navigate}) {
  return (
    <div className="guest-collection-lock">
      <div className="guest-collection-lock-cta">
        <div className="guest-collection-lock-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="guest-collection-lock-title">Коллекция заблокирована</h2>
        <p className="guest-collection-lock-text">
          Зарегистрируйтесь, чтобы сохранять артефакты и строить свою коллекцию
        </p>
        <div className="guest-collection-lock-actions">
          <Button view="action" size="l" width="max" onClick={() => navigate('auth')}>
            Зарегистрироваться
          </Button>
          <Button view="outlined" size="l" width="max" onClick={() => navigate('auth')}>
            Войти
          </Button>
        </div>
      </div>
      <div className="guest-ghost-grid" aria-hidden="true">
        <div className="guest-ghost-tile" />
        <div className="guest-ghost-tile" />
      </div>
    </div>
  );
}

export function CollectionView({data, navigate, actions}) {
  const [tab, setTab] = useState('all');
  const collection = data.collection || [];

  const favorites = collection.filter((item) => item.is_favorite);
  const filtered = tab === 'favorites' ? favorites : collection;
  const byMuseum = tab === 'museums' ? groupByMuseum(collection) : null;

  let grid;
  if (data.loading && !collection.length) {
    grid = <SkeletonTiles count={4} />;
  } else if (!collection.length) {
    grid = (
      <EmptyState
        title="Коллекция пока пуста"
        text="Пройдите маршрут и отсканируйте первый экспонат — он появится здесь."
        ctaLabel="Выбрать музей"
        onCta={() => navigate('museumSelect')}
      />
    );
  } else if (byMuseum) {
    grid = byMuseum.length ? (
      byMuseum.map(([museumName, items]) => (
        <div key={museumName} className="collection-group">
          <h3 className="collection-group-heading">{museumName}</h3>
          <div className="collection-grid">
            {items.map((item) => (
              <CollectionCard key={item.id} item={item} onOpen={actions.openArtifactFromCollection} />
            ))}
          </div>
        </div>
      ))
    ) : (
      <EmptyState title="Коллекция пуста" text="Отсканируйте первый экспонат, чтобы он появился здесь." />
    );
  } else if (!filtered.length) {
    grid = (
      <EmptyState
        title={tab === 'favorites' ? 'Избранных нет' : 'Коллекция пуста'}
        text={tab === 'favorites' ? 'Откройте карточку артефакта и нажмите ♡, чтобы добавить в избранное.' : 'Отсканируйте первый экспонат.'}
      />
    );
  } else {
    grid = (
      <div className="collection-grid">
        {filtered.map((item) => (
          <CollectionCard key={item.id} item={item} onOpen={actions.openArtifactFromCollection} />
        ))}
      </div>
    );
  }

  if (!data.isAuthenticated) {
    return (
      <section className="app-view app-shell is-active" aria-label="Моя коллекция">
        <div className="app-screen">
          <PageHeader title="Моя коллекция" onBack={() => navigate('profileHome')} />
          <GuestCollectionLock navigate={navigate} />
        </div>
      </section>
    );
  }

  return (
    <section className="app-view app-shell is-active" aria-label="Моя коллекция">
      <div className="app-screen">
        <PageHeader title="Моя коллекция" onBack={() => navigate('profileHome')} />
        <p className="app-subtitle">{collection.length} артефактов в коллекции</p>
        <div className="pill-tabs">
          <button className={`seg-button ${tab === 'all' ? 'is-active' : ''}`} type="button" onClick={() => setTab('all')}>Все</button>
          <button className={`seg-button ${tab === 'favorites' ? 'is-active' : ''}`} type="button" onClick={() => setTab('favorites')}>
            Избранные {favorites.length > 0 && <span className="tab-badge">{favorites.length}</span>}
          </button>
          <button className={`seg-button ${tab === 'museums' ? 'is-active' : ''}`} type="button" onClick={() => setTab('museums')}>По музеям</button>
        </div>
        {grid}
      </div>
    </section>
  );
}
