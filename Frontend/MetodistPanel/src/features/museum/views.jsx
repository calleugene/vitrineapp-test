import React, {useState} from 'react';
import {Button} from '@gravity-ui/uikit';
import {MUSEUM_HEADING, MUSEUM_PROFILE_LOAD} from './config';
import {useMuseumLogo} from './hooks/useMuseumLogo';
import {MuseumMainInfoCard} from './components/MuseumMainInfoCard';
import {MuseumLogoCard} from './components/MuseumLogoCard';
import {MuseumPageActions} from './components/MuseumPageActions';
import {MuseumEmptyState} from './components/MuseumEmptyState';
import {MuseumJoinCodeCard} from './components/MuseumJoinCodeCard';
import {CreateMuseumDialog} from './components/CreateMuseumDialog';

/* Профиль музея: два экрана — пустое состояние до создания и форма после.

   Правки уходят в состояние родителя (setMuseumProfile), а «Отмена»
   возвращает его к последнему сохранённому значению через onReset.
   Логотип живёт отдельно — в useMuseumLogo. */
export function MuseumProfileView({museumProfile, setMuseumProfile, onReset, onSave, saving, error, loadState, onRetryLoad, currentUser}) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [savedProfile, setSavedProfile] = useState(null);
  const logo = useMuseumLogo();

  const updateField = (key, value) => {
    setSavedProfile(null);
    setMuseumProfile((prev) => ({...prev, [key]: value}));
  };

  const saveProfile = async (creating = false) => {
    setSavedProfile(null);
    const saved = await onSave(museumProfile, creating);
    if (saved) {
      setCreateDialogOpen(false);
      setSavedProfile(museumProfile);
    }
  };

  const handleRemoveLogo = () => {
    logo.clear();
    if (museumProfile.logoUrl) updateField('logoUrl', '');
  };

  const handleCancel = () => {
    logo.clear();
    onReset();
  };

  if (loadState.status === 'loading') {
    return <section className="page"><p role="status">{MUSEUM_PROFILE_LOAD.loading}</p></section>;
  }

  if (loadState.status === 'error') {
    return (
      <section className="page">
        <div className="page-heading"><div><h1>{MUSEUM_HEADING.title}</h1></div></div>
        <p role="alert">{loadState.error}</p>
        <Button view="action" onClick={onRetryLoad}>{MUSEUM_PROFILE_LOAD.retry}</Button>
      </section>
    );
  }

  if (loadState.status === 'missing') {
    return (
      <section className="page">
        <div className="page-heading">
          <div>
            <h1>{MUSEUM_HEADING.title}</h1>
            <p>{MUSEUM_HEADING.createHint}</p>
          </div>
        </div>

        <MuseumEmptyState onCreate={() => setCreateDialogOpen(true)} />

        <CreateMuseumDialog
          open={createDialogOpen}
          profile={museumProfile}
          error={error}
          saving={saving}
          onChange={updateField}
          onClose={() => setCreateDialogOpen(false)}
          onSave={() => saveProfile(true)}
        />
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>{MUSEUM_HEADING.title}</h1>
          <p>{MUSEUM_HEADING.description}</p>
        </div>
      </div>

      <div className="museum-profile-layout">
        <MuseumMainInfoCard profile={museumProfile} onChange={updateField} />

        <div className="stack">
          <MuseumLogoCard logo={logo} savedLogoUrl={museumProfile.logoUrl} onRemove={handleRemoveLogo} />
          <MuseumJoinCodeCard currentUser={currentUser} />
        </div>
      </div>

      <MuseumPageActions
        profile={museumProfile}
        saving={saving}
        error={error}
        onCancel={handleCancel}
        onSave={() => saveProfile(false)}
      />
      {savedProfile && !error && !saving && (
        <p role="status">Профиль музея сохранён. Обновите страницу Visitor, чтобы увидеть изменения.</p>
      )}
    </section>
  );
}
