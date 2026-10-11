import React, {useState} from 'react';
import {Text} from '@gravity-ui/uikit';
import {BrandHeader, PageHeader, RetryState, SkeletonCards} from '../../components/ui.jsx';
import {MUSEUM_DETAIL, MUSEUM_LIST} from './config.js';
import {readArtifacts, readMuseumProgress} from './utils.js';
import {useMuseumSearch} from './hooks/useMuseumSearch.js';
import {MuseumCard} from './components/MuseumCard.jsx';
import {MuseumSearchBar} from './components/MuseumSearchBar.jsx';
import {MuseumHero} from './components/MuseumHero.jsx';
import {MuseumProgressCard} from './components/MuseumProgressCard.jsx';
import {ArtifactListItem} from './components/ArtifactListItem.jsx';
import {MuseumInfoModal} from './components/MuseumInfoModal.jsx';
import {MuseumErrorState, MuseumLoadingState} from './components/MuseumDetailState.jsx';
import {LockIcon, StarIcon} from './components/icons.jsx';
import './museum.css';

/* Баннер-миссия музея: декоративная звезда + текст описания. */
function MissionBanner({text}) {
  return (
    <div className="museum-mission-banner">
      <span className="museum-mission-icon" aria-hidden="true"><StarIcon /></span>
      <span className="museum-mission-text">{text}</span>
    </div>
  );
}

/* Липкая кнопка ввода кода экспоната. Скрывается, когда всё найдено. */
function StickyCodeCta({onClick}) {
  return (
    <div className="museum-sticky-scan">
      <button className="museum-scan-cta" type="button" onClick={onClick}>
        <LockIcon />
        {MUSEUM_DETAIL.enterCode}
      </button>
    </div>
  );
}

export function MuseumSelectView({data, actions}) {
  const {museums, loading, loadError} = data;
  const {query, setQuery, clear, filtered} = useMuseumSearch(museums);

  let list;
  if (loadError && !museums.length) {
    list = <RetryState onRetry={actions.bootstrap} />;
  } else if (loading && !museums.length) {
    list = <SkeletonCards count={3} />;
  } else if (!filtered.length) {
    list = (
      <div className="museum-empty-search">
        <Text as="p" variant="body-1" color="secondary">
          {MUSEUM_LIST.emptySearch(query)}
        </Text>
      </div>
    );
  } else {
    list = (
      <div className="museum-list">
        {filtered.map((museum) => (
          <MuseumCard key={museum.id} museum={museum} onSelect={actions.selectMuseum} />
        ))}
      </div>
    );
  }

  return (
    <section className="app-view app-shell is-active" aria-label={MUSEUM_LIST.ariaLabel}>
      <div className="app-screen">
        <BrandHeader />
        <Text as="h1" variant="display-1" className="app-title" style={{marginTop: 20}}>
          {MUSEUM_LIST.title}
        </Text>
        <Text as="p" variant="body-1" color="secondary" className="app-subtitle">
          {MUSEUM_LIST.subtitle}
        </Text>

        <MuseumSearchBar value={query} onChange={setQuery} onClear={clear} />

        {list}
      </div>
    </section>
  );
}

export function MuseumDetailView({data, navigate, actions}) {
  const museum = data.museumDetail;
  const [showInfo, setShowInfo] = useState(false);

  if (!museum) {
    return (
      <section className="app-view app-shell is-active" aria-label={MUSEUM_DETAIL.loadingAriaLabel}>
        <div className="app-screen museum-detail-screen">
          {data.loading ? (
            <MuseumLoadingState />
          ) : (
            <MuseumErrorState onRetry={actions.bootstrap} onBack={() => navigate('museumSelect')} />
          )}
        </div>
      </section>
    );
  }

  const artifacts = readArtifacts(museum);
  const {allFound} = readMuseumProgress(museum);

  return (
    <section className="app-view app-shell is-active" aria-label={MUSEUM_DETAIL.ariaLabel}>
      <div className="app-screen museum-detail-screen">
        <PageHeader title={museum.name} onBack={() => navigate('museumSelect')} />

        <MuseumHero museum={museum} onOpenInfo={() => setShowInfo(true)} />

        {museum.description && <MissionBanner text={museum.description} />}

        <MuseumProgressCard museum={museum} />

        {data.loading && !artifacts.length ? (
          <SkeletonCards count={3} />
        ) : (
          <div className="artifact-list-new">
            {artifacts.map((artifact) => (
              <ArtifactListItem key={artifact.id} artifact={artifact} onSelect={actions.selectArtifact} />
            ))}
          </div>
        )}
      </div>

      {!allFound && <StickyCodeCta onClick={() => navigate('secretCode')} />}

      {showInfo && <MuseumInfoModal museum={museum} onClose={() => setShowInfo(false)} />}
    </section>
  );
}
