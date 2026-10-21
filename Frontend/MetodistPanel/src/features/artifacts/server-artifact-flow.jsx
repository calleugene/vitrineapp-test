import React, {useEffect, useState} from 'react';
import {Button, Card, DropdownMenu, Icon, Label, TextArea, TextInput, Tooltip} from '@gravity-ui/uikit';
import {Archive, ArrowRotateLeft, ArrowUpRight, Copy, EllipsisVertical, Eye, Plus} from '@gravity-ui/icons';
import {artifactsApi} from '../../api';
import {ContentWorkspace} from './ContentWorkspace.jsx';

import './server-artifact-flow.css';

function FlowMessage({flow}) {
  if (!flow.error && !flow.notice) return null;
  return <div className={flow.error ? 'server-flow-message is-error' : 'server-flow-message'} role={flow.error ? 'alert' : 'status'}>{flow.error || flow.notice}</div>;
}

function ArtifactActions({artifact, onDuplicate, onArchive, onRestore, onOpen}) {
  const items = [
    {text: 'Дублировать', icon: <Copy />, action: () => onDuplicate(artifact.id)},
    artifact.status === 'archived'
      ? {text: 'Восстановить', icon: <Icon data={ArrowRotateLeft} size={16} />, action: () => onRestore(artifact.id)}
      : [{text: 'В архив', icon: <Icon data={Archive} size={16} />, action: () => { if (window.confirm(`Перенести «${artifact.title}» в архив?`)) onArchive(artifact.id); }}],
  ];
  return <div className="server-artifact-actions">
    <Tooltip content="Открыть просмотр"><Button className="artifact-action-button" view="flat-secondary" size="l" aria-label="Открыть просмотр экспоната" disabled={artifact.status !== 'published'} onClick={() => onOpen(artifact)}><Icon data={Eye} size={20} /></Button></Tooltip>
    <DropdownMenu items={items} size="m" popupProps={{placement: 'bottom-end'}} renderSwitcher={(props) => <Button {...props} className="artifact-row-menu artifact-action-button" view="flat-secondary" size="l" aria-label={`Действия с экспонатом «${artifact.title}»`}><Icon data={EllipsisVertical} size={20} /></Button>} />
  </div>;
}

function artifactStatus(artifact) {
  if (artifact.status === 'published') return {label: 'Опубликован', theme: 'success'};
  if (artifact.status === 'archived') return {label: 'В архиве', theme: 'utility'};
  return {label: 'Черновик', theme: 'warning'};
}

function formatUpdatedAt(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {day: '2-digit', month: 'short', year: 'numeric'}).format(date);
}

function Selector({artifacts, artifactsLoading, artifactsError, onReload, flow}) {
  const totals = artifacts.reduce((result, artifact) => {
    result.total += 1;
    if (artifact.status === 'published') result.published += 1;
    if (artifact.status === 'draft') result.draft += 1;
    return result;
  }, {total: 0, published: 0, draft: 0});
  const openPublic = (artifact) => {
    const url = artifact.public_url || artifact.publicUrl || (artifact.public_code ? `/exhibits/${artifact.public_code}` : '');
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };
  return <section className="page server-artifact-selector">
    <div className="page-heading"><div><h1>Экспонаты</h1><p>Создавайте истории для музейных предметов и готовьте их к показу посетителям.</p></div></div>
    <div className="stats-grid compact server-artifact-stats" aria-label="Сводка по экспонатам">
      <Card className="stat-card" view="filled"><div className="stat-value">{totals.total}</div><div className="stat-title">Всего экспонатов</div></Card>
      <Card className="stat-card" view="filled"><div className="stat-value">{totals.published}</div><div className="stat-title">Опубликовано</div></Card>
      <Card className="stat-card" view="filled"><div className="stat-value">{totals.draft}</div><div className="stat-title">Черновиков</div></Card>
    </div>
    <FlowMessage flow={flow} />
    <div className="two-column server-artifact-layout" aria-busy={artifactsLoading}>
      {artifactsLoading ? <Card className="panel" view="filled">Загружаем экспонаты…</Card> : null}
      {!artifactsLoading && artifactsError ? <Card className="panel" view="filled"><p>{artifactsError}</p><Button view="outlined" onClick={onReload}>Повторить</Button></Card> : null}
      {!artifactsLoading && !artifactsError ? <Card className="panel panel-large server-artifact-panel" view="filled">
        <div className="panel-header server-artifact-list-header"><div><h3>Экспонаты</h3><p className="panel-subtitle">Выберите экспонат, чтобы продолжить редактирование.</p></div><Button view="action" size="l" onClick={flow.start}><Icon data={Plus} size={18} />Добавить экспонат</Button></div>
        {!artifacts.length ? <div className="server-empty"><p>Экспонатов пока нет</p><span>Добавьте первый, чтобы собрать его экраны.</span></div> : <div className="table-shell server-artifact-table">
          <div className="table-head"><span>Название</span><span>Статус</span><span>Обновлён</span><span>Действия</span></div>
          {artifacts.map((artifact) => { const status = artifactStatus(artifact); return <div className="table-row server-artifact-row" key={artifact.id}>
            <button type="button" className="server-artifact-select" onClick={() => flow.select(artifact.id)}><span className="server-artifact-cover">{artifact.cover_url ? <img src={artifact.cover_url} alt="" /> : <span>{artifact.title.slice(0, 1).toUpperCase()}</span>}</span><span className="table-cell-stack"><strong>{artifact.title}</strong><small>{artifact.short_description || 'Описание пока не добавлено'}</small></span></button>
            <span><Label theme={status.theme}>{artifact.has_unpublished_changes && artifact.status === 'published' ? 'Есть изменения' : status.label}</Label></span><span>{formatUpdatedAt(artifact.updated_at || artifact.created_at)}</span>
            <ArtifactActions artifact={artifact} onDuplicate={flow.duplicateArtifact} onArchive={flow.archiveArtifact} onRestore={flow.restoreArtifact} onOpen={openPublic} />
          </div>; })}
        </div>}
      </Card> : null}
      {!artifactsLoading && !artifactsError ? <div className="stack">
        <Card className="panel" view="filled"><div className="panel-header"><h3>Что дальше</h3></div><ol className="server-artifact-guide"><li>Добавьте основные сведения и обложку.</li><li>Соберите историю из текстовых экранов.</li><li>Опубликуйте и разместите QR-код рядом с экспонатом.</li></ol></Card>
      </div> : null}
    </div>
  </section>;
}

function Header({step, flow, onNavigate, screenDirty = false}) {
  const dirty = flow.dirty || screenDirty;
  const label = screenDirty ? 'Есть несохранённый экран' : flow.dirty ? 'Сохранить изменения' : 'Все изменения сохранены';
  const leave = () => {
    if (flow.dirty && !window.confirm('Есть несохранённые изменения. Выйти без сохранения?')) return;
    onNavigate('artifacts');
  };
	return <><div className="server-flow-header"><h1>Сведения об экспонате</h1><div><span className={dirty ? 'is-dirty' : ''}>{label}</span><Button view="outlined" disabled={flow.loading} onClick={leave}>К экспонатам</Button><Button view="action" disabled={!flow.dirty || flow.loading || screenDirty} loading={flow.loading} onClick={flow.save}>Сохранить изменения</Button></div></div><nav className="server-flow-tabs" aria-label="Разделы экспоната">{[['artifact-basic', 'Основная информация'], ['artifact-content', 'Контент'], ['artifact-publish', 'Публикация']].map(([view, title], index) => <button type="button" key={view} className={step === index ? 'is-active' : ''} disabled={flow.loading} onClick={() => flow.saveAndGo(view)}>{title}</button>)}</nav></>;
}

function Basic({flow, onNavigate}) {
  return <section className="page server-artifact-flow"><Header step={0} flow={flow} onNavigate={onNavigate} /><Card className="panel server-flow-card" view="filled"><div className="server-basic-grid"><div><h2>Расскажите об экспонате</h2><label>Название<TextInput size="l" value={flow.draft.title} onUpdate={(title) => flow.change({title})} /></label><label>Краткое описание <small>{flow.draft.short_description.length}/250</small><TextArea size="l" rows={6} value={flow.draft.short_description} onUpdate={(short_description) => flow.change({short_description: short_description.slice(0, 250)})} /></label></div><div><h2>Обложка</h2><Cover artifact={flow.artifact} onUpload={flow.uploadCover} /></div></div><FlowMessage flow={flow} /></Card><footer className="page-action-bar server-flow-footer"><Button view="action" size="xl" onClick={() => flow.saveAndGo('artifact-content')}>К контенту</Button></footer></section>;
}

function Cover({artifact, onUpload}) {
  const [inputId] = useState(() => `cover-${Math.random().toString(36).slice(2)}`);
  return <div className="server-cover"><div className="server-cover-preview">{artifact?.cover_url ? <img src={artifact.cover_url} alt="Обложка экспоната" /> : <span>JPG, PNG или WebP до 10 МБ</span>}</div><input id={inputId} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(event) => { onUpload(event.target.files?.[0]); event.currentTarget.value = ''; }} /><label htmlFor={inputId}><Button view="outlined" component="span">{artifact?.cover_url ? 'Заменить' : 'Загрузить обложку'}</Button></label></div>;
}

function Publish({flow, onNavigate}) { const ready = Boolean(flow.artifact && flow.screens.length); return <section className="page server-artifact-flow"><Header step={2} flow={flow} onNavigate={onNavigate} /><Card className="panel server-flow-card" view="filled"><h2>Публикация</h2>{ready ? <p>Экспонат готов к публикации. Ссылка и QR-код останутся постоянными.</p> : <p className="server-flow-message is-error">Сохраните сведения и добавьте хотя бы один экран.</p>}<FlowMessage flow={flow} /></Card><footer className="page-action-bar page-action-bar-split server-flow-footer"><Button view="outlined" size="xl" onClick={() => onNavigate('artifact-content')}>Назад</Button><Button view="action" size="xl" disabled={flow.loading || !ready} loading={flow.loading} onClick={flow.publish}>Опубликовать</Button></footer></section>; }

function Success({flow, onNavigate}) {
  const url = flow.publication?.public_url || flow.publication?.publicUrl;
  const [qrURL, setQrURL] = useState('');
  const [qrError, setQrError] = useState(false);
  useEffect(() => {
    let objectURL = '';
    const artifactId = flow.artifact?.id;
    if (!artifactId) return undefined;
    artifactsApi.getQRCode(artifactId).then((blob) => {
      objectURL = URL.createObjectURL(blob);
      setQrURL(objectURL);
      setQrError(false);
    }).catch(() => setQrError(true));
    return () => { if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [flow.artifact?.id]);
  const copyLink = async () => { if (url) await navigator.clipboard?.writeText(url); };
  return <section className="server-artifact-flow"><Card className="server-flow-card server-success-card" view="filled"><div className="server-success-grid"><div><h1>Экспонат опубликован</h1><p>Ссылка и QR-код останутся постоянными. Их можно разместить рядом с экспонатом.</p><label className="server-public-link">Ссылка на экспонат<TextInput value={url || 'Ссылка будет доступна после настройки публичного сервиса.'} readOnly endContent={<Button view="flat-secondary" size="s" disabled={!url} onClick={copyLink} aria-label="Скопировать ссылку"><Copy /></Button>} /></label><div className="server-success-actions"><Button view="outlined" onClick={() => onNavigate('artifacts')}>К экспонатам</Button>{url ? <Button view="action" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}><ArrowUpRight />Открыть просмотр</Button> : null}</div></div><aside className="server-qr-card"><h2>QR-код</h2>{qrURL ? <img src={qrURL} alt="QR-код ссылки на экспонат" /> : <p>{qrError ? 'Не удалось загрузить QR-код.' : 'Генерируем QR-код…'}</p>}<small>Наведите камеру телефона, чтобы открыть историю.</small></aside></div><FlowMessage flow={flow} /></Card></section>;
}

export function ServerArtifactFlow({mode, artifacts, artifactsLoading, artifactsError, onReload, flow, onNavigate}) {
  if (mode === 'selector') return <Selector artifacts={artifacts} artifactsLoading={artifactsLoading} artifactsError={artifactsError} onReload={onReload} flow={flow} />;
  if (mode === 'basic') return <Basic flow={flow} onNavigate={onNavigate} />;
  if (mode === 'content') return <ContentWorkspace flow={flow} onNavigate={onNavigate} />;
  if (mode === 'publish') return <Publish flow={flow} onNavigate={onNavigate} />;
  return <Success flow={flow} onNavigate={onNavigate} />;
}
