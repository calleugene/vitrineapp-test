import {useCallback, useEffect, useRef} from 'react';
import {Button, Card, Icon} from '@gravity-ui/uikit';
import {CircleInfo} from '@gravity-ui/icons';
import {artifactsApi} from '../../api';
import {PublicationChecks, PublicationDelivery, PublicationIdentity} from '../../components/PublicationDelivery.jsx';
import {artifactPublicUrl} from '../../components/publication-utils.js';
import {artifactReadiness} from './artifact-publication.js';

function Delivery({flow}) {
  const artifactId = flow.artifact?.id;
  const publicUrl = artifactPublicUrl(flow.artifact, flow.publication, window.location.origin);
  const loadQr = useCallback(() => artifactsApi.getQRCode(artifactId), [artifactId]);
  return <PublicationDelivery key={publicUrl} publicUrl={publicUrl} loadQr={loadQr} fileName={`vitrina-exhibit-${artifactId}-qr.png`} emptyMessage="Ссылка и QR-код появятся после успешной публикации экспоната." linkNote="Ссылка и QR-код остаются постоянными. Изменения черновика станут видны посетителям только после публикации." />;
}

export function ArtifactPublish({flow, onNavigate, header, message}) {
  const readiness = artifactReadiness(flow);
  const {artifact} = flow;
  return <section className="page server-artifact-flow publication-page">
    {header}
    <p className="publication-intro">{readiness.published ? 'Проверьте изменения перед обновлением опубликованной истории.' : 'Проверьте материалы и опубликуйте историю, чтобы открыть её посетителям.'}</p>
    <PublicationIdentity title={flow.draft.title} description={flow.draft.short_description} coverUrl={artifact?.cover_url} meta={`Экранов: ${flow.screens.length}`} status={readiness.published ? 'Есть опубликованная версия' : 'Черновик'} statusTheme={readiness.published ? 'success' : 'neutral'} />
    <div className={`publication-review-grid ${readiness.published ? 'has-publication' : ''}`}><Card className="publication-review" view="filled"><h2>Проверьте перед публикацией</h2><PublicationChecks items={readiness.items} /><p className="publication-note"><Icon data={CircleInfo} size={18} />{readiness.published ? 'Посетителям доступна последняя опубликованная версия. Правки черновика пока видны только в кабинете.' : 'До публикации история недоступна посетителям. QR-код будет создан для опубликованной версии.'}</p></Card>{!readiness.published && <PublicationDelivery emptyMessage="Опубликуйте историю — здесь появятся ссылка и QR-код для посетителей." />}</div>
    {readiness.published && <Delivery flow={flow} />}
    {message}
    {readiness.published && !readiness.hasChanges && !flow.dirty && <p className="publication-note" role="status">Если изменения уже опубликованы, повторная публикация не нужна.</p>}
    <footer className="publication-actions"><Button disabled={flow.loading} view="outlined" size="l" onClick={() => onNavigate('artifact-content', {artifactId:artifact?.id})}>К контенту</Button><Button disabled={flow.loading || !readiness.canPublish} loading={flow.loading} view="action" size="l" onClick={flow.publish}>{flow.loading ? 'Публикуем…' : readiness.published ? 'Опубликовать изменения' : 'Опубликовать экспонат'}</Button></footer>
  </section>;
}

export function ArtifactSuccess({flow, onNavigate, message}) {
  const heading = useRef(null);
  useEffect(() => {heading.current?.focus();}, []);
  const publicUrl = artifactPublicUrl(flow.artifact, flow.publication, window.location.origin);
  return <section className="page server-artifact-flow publication-page"><div className="publication-heading"><div><h1 ref={heading} tabIndex={-1}>{publicUrl ? 'Экспонат опубликован' : 'Публикация экспоната'}</h1><p>{publicUrl ? 'Посетители могут открыть историю по ссылке или QR-коду прямо в браузере.' : 'Откройте экспонат и проверьте его статус. Публичная ссылка пока недоступна.'}</p></div></div><PublicationIdentity title={flow.artifact?.title} description={flow.artifact?.short_description} coverUrl={flow.artifact?.cover_url} meta={`Экранов: ${flow.screens.length}`} status={publicUrl ? 'Опубликовано' : undefined} statusTheme="success" /><Delivery flow={flow} />{message}<footer className="publication-actions"><Button view="outlined" size="l" onClick={() => onNavigate('artifacts')}>К экспонатам</Button><Button view="outlined" size="l" disabled={!flow.artifact?.id} onClick={() => onNavigate('artifact-content', {artifactId:flow.artifact?.id})}>Продолжить редактирование</Button></footer></section>;
}
