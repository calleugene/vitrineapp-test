import {useCallback, useEffect, useId, useRef} from 'react';
import {Button, Card, Icon} from '@gravity-ui/uikit';
import {ArrowLeft, CircleCheck, CircleExclamation, Globe} from '@gravity-ui/icons';
import {artifactsApi} from '../../api';
import {PublicationChecks, PublicationDelivery, PublicationIdentity} from '../../components/PublicationDelivery.jsx';
import {artifactPublicUrl} from '../../components/publication-utils.js';
import {ExhibitEmbed} from '../../components/ExhibitEmbed.jsx';
import {artifactReadiness} from './artifact-publication.js';

function Delivery({flow}) {
  const artifactId = flow.artifact?.id;
  const publicUrl = artifactPublicUrl(flow.artifact, flow.publication, window.location.origin);
  const loadQr = useCallback(() => artifactsApi.getQRCode(artifactId), [artifactId]);
  return <PublicationDelivery key={publicUrl} publicUrl={publicUrl} loadQr={loadQr} fileName={`vitrina-exhibit-${artifactId}-qr.png`} emptyMessage="Ссылка и QR-код появятся после успешной публикации экспоната." linkNote="Ссылка и QR-код остаются постоянными. Изменения черновика станут видны посетителям только после публикации." />;
}

export function ArtifactPublish({flow, header}) {
  const readiness = artifactReadiness(flow);
  const {artifact} = flow;
  const publicUrl = artifactPublicUrl(artifact, flow.publication, window.location.origin);
  const statusId = useId();
  const applied = readiness.published && !readiness.hasChanges && !flow.dirty;
  const status = flow.isPublishing ? 'Публикуем экспонат…'
    : readiness.blocker ? 'Требуется подготовка'
    : applied ? 'Все изменения опубликованы'
    : readiness.published ? 'Изменения готовы к публикации' : 'Готов к публикации';
  const description = readiness.blocker || (applied ? 'Ссылка и QR-код для посетителей доступны ниже.'
    : readiness.published ? 'Новая версия появится по той же ссылке и QR-коду.'
    : 'После публикации посетители смогут открыть экспонат по ссылке или QR-коду.');
  const statusIcon = flow.isPublishing ? Globe : readiness.blocker ? CircleExclamation : applied ? CircleCheck : Globe;
  const publishLabel = readiness.published ? 'Опубликовать изменения' : 'Опубликовать экспонат';

  return <section className="page server-artifact-flow publication-page">
    {header}
    <PublicationIdentity title={flow.draft.title} description={flow.draft.short_description} coverUrl={artifact.cover_url} meta={`Экранов: ${flow.screens.length}`} status={artifact.status === 'archived' ? 'В архиве' : readiness.published ? 'Есть опубликованная версия' : 'Черновик'} statusTheme={readiness.published ? 'success' : 'neutral'} />
    <div className="exhibit-publication-grid">
      <Card className="publication-review exhibit-publication-checks" view="filled">
        <h2>Проверка перед публикацией</h2>
        <PublicationChecks items={readiness.items} />
      </Card>
      <section className="exhibit-publication-action" aria-labelledby={statusId}>
        <span className="exhibit-publication-icon"><Icon data={statusIcon} size={22} aria-hidden="true" /></span>
        <div className="exhibit-publication-status" role="status">
          <h2 id={statusId}>{status}</h2>
          <p>{description}</p>
        </div>
        {flow.error && <p className="exhibit-publication-error" role="alert">{flow.error}</p>}
        <div className="exhibit-publication-buttons">
          <Button disabled={flow.loading} view="outlined" size="l" onClick={() => flow.saveAndGo('artifact-content')}>
            <Icon data={ArrowLeft} size={16} aria-hidden="true" />К контенту
          </Button>
          {(!applied || readiness.blocker) && <Button disabled={flow.loading || !readiness.canPublish} loading={flow.isPublishing} view="action" size="l" onClick={flow.publish}>
            {flow.isPublishing ? 'Публикуем…' : publishLabel}
          </Button>}
        </div>
      </section>
    </div>
    {publicUrl && <>
      <Delivery flow={flow} />
      <ExhibitEmbed key={`${artifact.id}:${artifact.published_revision}`} artifactId={artifact.id} publicUrl={publicUrl} />
    </>}
  </section>;
}

export function ArtifactSuccess({flow, onNavigate, message}) {
  const heading = useRef(null);
  useEffect(() => {heading.current?.focus();}, []);
  const publicUrl = artifactPublicUrl(flow.artifact, flow.publication, window.location.origin);
  return <section className="page server-artifact-flow publication-page"><div className="publication-heading"><div><h1 ref={heading} tabIndex={-1}>{publicUrl ? 'Экспонат опубликован' : 'Публикация экспоната'}</h1><p>{publicUrl ? 'Посетители могут открыть историю по ссылке или QR-коду прямо в браузере.' : 'Откройте экспонат и проверьте его статус. Публичная ссылка пока недоступна.'}</p></div></div><PublicationIdentity title={flow.artifact?.title} description={flow.artifact?.short_description} coverUrl={flow.artifact?.cover_url} meta={`Экранов: ${flow.screens.length}`} status={publicUrl ? 'Опубликовано' : undefined} statusTheme="success" /><Delivery flow={flow} /><ExhibitEmbed key={`${flow.artifact?.id}:${flow.artifact?.published_revision}`} artifactId={flow.artifact?.id} publicUrl={publicUrl} />{message}<footer className="publication-actions"><Button view="outlined" size="l" onClick={() => onNavigate('artifacts')}>К экспонатам</Button><Button view="outlined" size="l" disabled={!flow.artifact?.id} onClick={() => onNavigate('artifact-content', {artifactId:flow.artifact?.id})}>Продолжить редактирование</Button></footer></section>;
}
