import React from 'react';
import {Card, Icon, Label, Progress, Text} from '@gravity-ui/uikit';
import {Check, ChevronRight, CircleCheckFill} from '@gravity-ui/icons';
import {MuseumThumbIcon} from '../../../components/ui.jsx';
import {MUSEUM_CARD} from '../config.js';
import {formatArtifactsLabel, readMuseumProgress} from '../utils.js';

/* Карточка музея в списке выбора: обложка, название, подпись и,
   если маршрут начат, мини-прогресс. Сама не решает ничего про навигацию. */
export function MuseumCard({museum, onSelect}) {
  const {found, total, percent} = readMuseumProgress(museum);
  const isInProgress = museum.status === 'in_progress';
  const isCompleted = museum.status === 'completed';

  return (
    <Card
      type="action"
      className={`museum-gcard museum-gcard--${museum.status || 'new'}`}
      onClick={() => onSelect(museum.id)}
    >
      <div className="museum-gcard-inner">
        <span className="museum-thumb-wrap">
          {museum.cover_image_url ? (
            <img className="museum-thumb-img" src={museum.cover_image_url} alt={museum.name} loading="lazy" />
          ) : (
            <span className="museum-thumb" aria-hidden="true"><MuseumThumbIcon /></span>
          )}
          {isCompleted && (
            <span className="museum-thumb-check" aria-hidden="true">
              <Icon data={Check} size={10} />
            </span>
          )}
        </span>

        <div className="museum-card-body">
          <Text as="h2" variant="subheader-2">{museum.name}</Text>
          <Text as="p" variant="caption-2" color="secondary" className="museum-card-meta">
            {MUSEUM_CARD.meta({
              artifacts: formatArtifactsLabel(museum.total_artifacts),
              minutes: museum.estimated_minutes,
            })}
          </Text>

          {isInProgress && (
            <div className="museum-card-progress-row">
              <Progress value={percent} size="xs" theme="info" className="museum-card-mini-progress" />
              <Text as="span" variant="caption-2" color="brand" className="museum-card-progress-label">
                {MUSEUM_CARD.progressLabel(found, total)}
              </Text>
            </div>
          )}

          {isCompleted && (
            <Label
              theme="success"
              size="xs"
              icon={<Icon data={CircleCheckFill} size={12} />}
              className="museum-status-label"
            >
              {MUSEUM_CARD.completed}
            </Label>
          )}
        </div>

        <Icon data={ChevronRight} size={18} className="museum-gcard-chevron" />
      </div>
    </Card>
  );
}
