import React from 'react';
import {Card, Icon, Label, Text} from '@gravity-ui/uikit';
import {Check, ChevronRight} from '@gravity-ui/icons';
import {ARTIFACT_ITEM} from '../config.js';
import {GalleryIcon} from './icons.jsx';

/* Строка экспоната в экране музея: нашли / не нашли. */
export function ArtifactListItem({artifact, onSelect}) {
  const found = Boolean(artifact.found);

  return (
    <Card
      type="action"
      className={`artifact-gcard ${found ? 'is-found' : 'is-missing'}`}
      onClick={() => onSelect(artifact.id)}
    >
      <div className="artifact-gcard-inner">
        <span className={`artifact-item-thumb ${found ? 'is-found' : 'is-missing'}`} aria-hidden="true">
          {found ? <Icon data={Check} size={22} /> : <GalleryIcon />}
        </span>

        <div className="artifact-item-body">
          <Text as="p" variant="subheader-1" className="artifact-item-title">{artifact.title}</Text>
          {(artifact.subtitle || artifact.description) && (
            <Text as="p" variant="caption-2" color="secondary" className="artifact-item-desc">
              {artifact.subtitle || artifact.description}
            </Text>
          )}
          <Label
            theme={found ? 'success' : 'unknown'}
            size="xxs"
            icon={found ? <Icon data={Check} size={8} /> : undefined}
            className="artifact-status-label"
          >
            {found ? ARTIFACT_ITEM.found : ARTIFACT_ITEM.missing}
          </Label>
        </div>

        <Icon data={ChevronRight} size={18} className="artifact-gcard-chevron" />
      </div>
    </Card>
  );
}
