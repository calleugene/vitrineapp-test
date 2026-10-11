import React, {useState} from 'react';
import {MUSEUM_HEADING} from './config';
import {useMuseumLogo} from './hooks/useMuseumLogo';
import {MuseumMainInfoCard} from './components/MuseumMainInfoCard';
import {MuseumLogoCard} from './components/MuseumLogoCard';
import {MuseumPageActions} from './components/MuseumPageActions';
import {MuseumEmptyState} from './components/MuseumEmptyState';
import {CreateMuseumDialog} from './components/CreateMuseumDialog';

/* Профиль музея: два экрана — пустое состояние до создания и форма после.

   Правки уходят в состояние родителя (setMuseumProfile), а «Отмена»
   возвращает его к последнему сохранённому значению через onReset.
   Логотип живёт отдельно — в useMuseumLogo. */
export function MuseumProfileView({museumProfile, setMuseumProfile, onReset, onSave, saving, error}) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const logo = useMuseumLogo();

  const updateField = (key, value) => {
    setMuseumProfile((prev) => ({...prev, [key]: value}));
  };

  const saveProfile = async (creating = false) => {
    const saved = await onSave(museumProfile, creating);
    if (saved) setCreateDialogOpen(false);
  };

  const handleRemoveLogo = () => {
    logo.clear();
    if (museumProfile.logoUrl) updateField('logoUrl', '');
  };

  const handleCancel = () => {
    logo.clear();
    onReset();
  };

  if (!museumProfile.code) {
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
        </div>
      </div>

      <MuseumPageActions
        profile={museumProfile}
        saving={saving}
        error={error}
        onCancel={handleCancel}
        onSave={() => saveProfile(false)}
      />
    </section>
  );
}
