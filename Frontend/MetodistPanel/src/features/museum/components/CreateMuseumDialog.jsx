import React from 'react';
import {Dialog, TextArea, TextInput} from '@gravity-ui/uikit';
import {Field} from '../../../components/ui';
import {MUSEUM_CREATE, MUSEUM_INFO_CARD} from '../config';
import {canSaveProfile, clampDescription} from '../utils';

/* Диалог создания музея: минимальный набор полей, остальное — после создания.

   Заголовок задаётся только caption: у Dialog.Header нет children,
   лишний текст внутри просто не отрендерился бы. */
export function CreateMuseumDialog({open, profile, error, saving, onChange, onClose, onSave}) {
  return (
    <Dialog open={open} onClose={onClose} size="m">
      <Dialog.Header caption={MUSEUM_CREATE.title} />

      <Dialog.Body>
        <p>{MUSEUM_CREATE.intro}</p>

        <Field label={MUSEUM_INFO_CARD.nameLabel}>
          <TextInput size="l" value={profile.name} onUpdate={(value) => onChange('name', value)} />
        </Field>

        <Field label={MUSEUM_INFO_CARD.descriptionLabel}>
          <TextArea
            size="l"
            rows={4}
            value={profile.shortDescription}
            onUpdate={(value) => onChange('shortDescription', clampDescription(value))}
          />
        </Field>

        <Field label={MUSEUM_INFO_CARD.addressLabel}>
          <TextInput size="l" value={profile.address} onUpdate={(value) => onChange('address', value)} />
        </Field>

        {error && <p className="museum-save-error" role="alert">{error}</p>}
      </Dialog.Body>

      <Dialog.Footer
        textButtonCancel={MUSEUM_CREATE.cancel}
        textButtonApply={MUSEUM_CREATE.apply}
        onClickButtonCancel={onClose}
        onClickButtonApply={onSave}
        propsButtonApply={{view: 'action', loading: saving, disabled: !canSaveProfile(profile)}}
      />
    </Dialog>
  );
}
