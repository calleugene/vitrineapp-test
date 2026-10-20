import React from 'react';
import {CircleInfo, Link, MapPin} from '@gravity-ui/icons';
import {Card, TextArea, TextInput} from '@gravity-ui/uikit';
import {Field} from '../../../components/ui';
import {MUSEUM_INFO_CARD} from '../config';
import {clampDescription, normalizeWebsite} from '../utils';

/* Карточка «Основная информация»: название, код, описание, сайт и адрес.
   Код музея доступен только на чтение — присваивается при регистрации. */
export function MuseumMainInfoCard({profile, onChange}) {
  const website = normalizeWebsite(profile.website);

  return (
    <Card className="panel panel-form museum-main-info-card" view="filled">
      <h3>{MUSEUM_INFO_CARD.title}</h3>

      <div className="field-grid">
        <Field label={MUSEUM_INFO_CARD.nameLabel}>
          <TextInput size="xl" value={profile.name} onUpdate={(value) => onChange('name', value)} />
        </Field>

        <Field label={MUSEUM_INFO_CARD.codeLabel}>
          <TextInput
            size="xl"
            value={profile.code}
            disabled
            className="museum-readonly-input"
          />
          <p className="museum-field-note">{MUSEUM_INFO_CARD.codeNote}</p>
        </Field>
      </div>

      <Field label={MUSEUM_INFO_CARD.descriptionLabel}>
        <div className="museum-textarea-shell">
          <TextArea
            size="xl"
            rows={3}
            value={profile.shortDescription}
            onUpdate={(value) => onChange('shortDescription', clampDescription(value))}
          />
          <span className="museum-counter">
            {MUSEUM_INFO_CARD.descriptionCounter(profile.shortDescription.length, MUSEUM_INFO_CARD.descriptionLimit)}
          </span>
        </div>
      </Field>

      <div className="field-grid">
        <Field label={MUSEUM_INFO_CARD.websiteLabel} error={website.ok ? undefined : MUSEUM_INFO_CARD.websiteError}>
          <div className="museum-input-with-icon">
            <Link />
            <TextInput size="xl" value={profile.website} onUpdate={(value) => onChange('website', value)} />
          </div>
        </Field>

        <Field label={MUSEUM_INFO_CARD.addressLabel}>
          <div className="museum-input-with-icon">
            <MapPin />
            <TextInput size="xl" value={profile.address} onUpdate={(value) => onChange('address', value)} />
          </div>
        </Field>
      </div>

      <div className="museum-info-note">
        <CircleInfo />
        <span>{MUSEUM_INFO_CARD.note}</span>
      </div>
    </Card>
  );
}
