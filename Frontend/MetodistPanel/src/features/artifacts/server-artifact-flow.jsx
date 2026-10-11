import React, {useEffect, useState} from 'react';
import {Button, Card, Dialog, DropdownMenu, Label, TextArea, TextInput} from '@gravity-ui/uikit';
import {ArrowUpRight, Copy, EllipsisVertical, Plus, TrashBin} from '@gravity-ui/icons';
import {artifactsApi} from '../../api';
import './server-artifact-flow.css';

function screenBody(screen) {
  try { const payload = JSON.parse(screen.payload || '{}'); return payload?.content?.body || payload?.body || ''; } catch { return ''; }
}

function screenImage(screen) {
  try { const payload = JSON.parse(screen.payload || '{}'); return payload?.content?.image_url || payload?.content?.imageUrl || payload?.image_url || payload?.imageUrl || ''; } catch { return ''; }
}

function FlowMessage({flow}) {
  if (!flow.error && !flow.notice) return null;
  return <div className={flow.error ? 'server-flow-message is-error' : 'server-flow-message'} role={flow.error ? 'alert' : 'status'}>{flow.error || flow.notice}</div>;
}

function ArtifactActions({artifact, onDuplicate, onArchive, onRestore, onOpen}) {
  const items = [
    {text: 'Дублировать', icon: <Copy />, action: () => onDuplicate(artifact.id)},
    artifact.status === 'archived'
      ? {text: 'Восстановить', action: () => onRestore(artifact.id)}
      : [{text: 'В архив', icon: <TrashBin />, action: () => { if (window.confirm(`Перенести «${artifact.title}» в архив?`)) onArchive(artifact.id); }, className: 'artifact-menu-danger'}],
  ];
  return <div className="server-artifact-actions">
    <Button view="flat" size="m" aria-label="Открыть просмотр экспоната" disabled={artifact.status !== 'published'} onClick={() => onOpen(artifact)}><ArrowUpRight /></Button>
    <DropdownMenu items={items} size="m" popupProps={{placement: 'bottom-end'}} renderSwitcher={(props) => <button className="artifact-row-menu" type="button" aria-label={`Действия с экспонатом «${artifact.title}»`} {...props}><EllipsisVertical /></button>} />
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
        <div className="panel-header"><div><h3>Все экспонаты</h3><p className="panel-subtitle">Выберите экспонат, чтобы продолжить редактирование.</p></div></div>
        {!artifacts.length ? <div className="server-empty"><p>Экспонатов пока нет</p><span>Добавьте первый, чтобы собрать его экраны.</span><Button view="action" onClick={flow.start}><Plus />Добавить экспонат</Button></div> : <div className="table-shell server-artifact-table">
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
        <Card className="panel" view="filled"><h3>Публикация</h3><p>Посетитель видит только опубликованную версию. Черновики доступны только в кабинете.</p></Card>
      </div> : null}
    </div>
    <div className="page-action-bar"><Button view="action" size="xl" onClick={flow.start}><Plus />Добавить экспонат</Button></div>
  </section>;
}

function Header({step, flow, onNavigate}) {
  const label = flow.dirty ? 'Сохранить изменения' : 'Все изменения сохранены';
  const leave = () => {
    if (flow.dirty && !window.confirm('Есть несохранённые изменения. Выйти без сохранения?')) return;
    onNavigate('artifacts');
  };
	return <><div className="server-flow-header"><h1>Сведения об экспонате</h1><div><span className={flow.dirty ? 'is-dirty' : ''}>{label}</span><Button view="outlined" onClick={leave}>К экспонатам</Button><Button view="action" disabled={!flow.dirty} loading={flow.loading} onClick={flow.save}>Сохранить изменения</Button></div></div><nav className="server-flow-tabs" aria-label="Разделы экспоната">{[['artifact-basic', 'Основная информация'], ['artifact-content', 'Контент'], ['artifact-publish', 'Публикация']].map(([view, title], index) => <button type="button" key={view} className={step === index ? 'is-active' : ''} onClick={() => flow.saveAndGo(view)}>{title}</button>)}</nav></>;
}

function Basic({flow, onNavigate}) {
  return <section className="page server-artifact-flow"><Header step={0} flow={flow} onNavigate={onNavigate} /><Card className="panel server-flow-card" view="filled"><div className="server-basic-grid"><div><h2>Расскажите об экспонате</h2><label>Название<TextInput size="l" value={flow.draft.title} onUpdate={(title) => flow.change({title})} /></label><label>Краткое описание <small>{flow.draft.short_description.length}/250</small><TextArea size="l" rows={6} value={flow.draft.short_description} onUpdate={(short_description) => flow.change({short_description: short_description.slice(0, 250)})} /></label></div><div><h2>Обложка</h2><Cover artifact={flow.artifact} onUpload={flow.uploadCover} /></div></div><FlowMessage flow={flow} /></Card><footer className="page-action-bar server-flow-footer"><Button view="action" size="xl" onClick={() => flow.saveAndGo('artifact-content')}>К контенту</Button></footer></section>;
}

function Cover({artifact, onUpload}) {
  const [inputId] = useState(() => `cover-${Math.random().toString(36).slice(2)}`);
  return <div className="server-cover"><div className="server-cover-preview">{artifact?.cover_url ? <img src={artifact.cover_url} alt="Обложка экспоната" /> : <span>JPG, PNG или WebP до 10 МБ</span>}</div><input id={inputId} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(event) => { onUpload(event.target.files?.[0]); event.currentTarget.value = ''; }} /><label htmlFor={inputId}><Button view="outlined" component="span">{artifact?.cover_url ? 'Заменить' : 'Загрузить обложку'}</Button></label></div>;
}

function Content({flow, onNavigate}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const onDrop = (fromId, toId) => { const from = flow.screens.findIndex((screen) => screen.id === fromId); const to = flow.screens.findIndex((screen) => screen.id === toId); if (from < 0 || to < 0 || from === to) return; const next = [...flow.screens]; const [item] = next.splice(from, 1); next.splice(to, 0, item); flow.reorder(next); };
  return <section className="page server-artifact-flow"><Header step={1} flow={flow} onNavigate={onNavigate} /><Card className="panel server-flow-card" view="filled"><div className="server-content-heading"><div><h2>Экраны</h2><p>{flow.screens.length ? `Добавлено: ${flow.screens.length}` : 'Сейчас контент отсутствует.'}</p></div><Button view="action" onClick={() => setDialogOpen(true)}><Plus />Добавить</Button></div>{flow.screens.length ? <div className="server-screen-list" role="list">{flow.screens.map((screen, index) => <ScreenRow key={screen.id} index={index} screen={screen} onDrop={onDrop} onEdit={() => setEditing(screen)} onDuplicate={() => flow.duplicateScreen(screen)} onRemove={() => flow.removeScreen(screen.id)} />)}</div> : <div className="server-empty"><p>Хотите создать первый экран?</p><Button view="action" onClick={() => setDialogOpen(true)}>Добавить</Button></div>}{editing ? <InlineTextEditor screen={editing} onCancel={() => setEditing(null)} onUploadImage={flow.uploadScreenImage} onSave={(title, body, imageURL) => { flow.updateScreen(editing.id, title, body, imageURL); setEditing(null); }} /> : null}<FlowMessage flow={flow} /></Card><ScreenTypeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onAdd={async () => { const screen = await flow.addTextScreen(); setDialogOpen(false); if (screen) setEditing(screen); }} /><footer className="page-action-bar page-action-bar-split server-flow-footer"><Button view="outlined" size="xl" onClick={() => onNavigate('artifact-basic')}>Назад</Button><Button view="action" size="xl" disabled={!flow.screens.length} onClick={() => onNavigate('artifact-publish')}>К публикации</Button></footer></section>;
}

function ScreenRow({screen, index, onDrop, onEdit, onDuplicate, onRemove}) {
	const items = [{text: 'Дублировать', icon: <Copy />, action: onDuplicate}, [{text: 'Удалить', icon: <TrashBin />, action: () => { if (window.confirm(`Удалить экран «${screen.title}»?`)) onRemove(); }, className: 'artifact-menu-danger'}]];
  return <div className="server-screen-row" role="listitem" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', screen.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(event.dataTransfer.getData('text/plain'), screen.id); }}><span className="server-drag" aria-label="Перенести экран" title="Перенесите экран">⠿</span><span className="server-screen-number">{index + 1}</span><Label theme="normal" size="s">Текст</Label><button type="button" className="server-screen-title" onClick={onEdit}><strong>{screen.title || 'Без названия'}</strong><small>Нажмите, чтобы отредактировать</small></button><DropdownMenu items={items} size="m" popupProps={{placement: 'bottom-end'}} renderSwitcher={(props) => <button className="artifact-row-menu" type="button" aria-label={`Действия с экраном «${screen.title}»`} {...props}><EllipsisVertical /></button>} /></div>;
}

function ScreenTypeDialog({open, onClose, onAdd}) { return <Dialog open={open} onClose={onClose} size="s"><Dialog.Header caption="Добавить экран">Добавить экран</Dialog.Header><Dialog.Body><Button view="flat" width="max" onClick={onAdd}>Текст<br /><small>Расскажите историю с помощью текста и изображений.</small></Button><div className="server-disabled-option">Тест <small>В следующем обновлении</small></div><div className="server-disabled-option">3D-модель <small>В следующем обновлении</small></div></Dialog.Body><Dialog.Footer textButtonCancel="Отменить" onClickButtonCancel={onClose} /></Dialog>; }

function InlineTextEditor({screen, onCancel, onSave, onUploadImage}) {
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [imageURL, setImageURL] = useState(''); const [uploading, setUploading] = useState(false);
  const [inputId] = useState(() => `screen-image-${Math.random().toString(36).slice(2)}`);
  React.useEffect(() => { if (screen) { setTitle(screen.title || ''); setBody(screenBody(screen)); setImageURL(screenImage(screen)); } }, [screen]);
  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    const nextURL = await onUploadImage(screen.id, file);
    if (nextURL) setImageURL(nextURL);
    setUploading(false);
  };
  const previewStyle = imageURL ? {backgroundImage: `linear-gradient(180deg, rgba(15, 17, 23, 0.08) 20%, rgba(15, 17, 23, 0.92) 100%), url("${imageURL}")`, backgroundSize: 'cover', backgroundPosition: 'center'} : undefined;
  return <section className="server-inline-editor" aria-label="Редактирование текстового экрана"><div className="server-inline-editor__heading"><div><h3>Текстовый экран</h3><p>Добавьте текст и фоновое изображение для посетителя.</p></div><Button view="flat-secondary" onClick={onCancel}>Закрыть</Button></div><div className="server-editor-grid"><div><label>Заголовок<TextInput size="l" value={title} onUpdate={setTitle} /></label><label>Текст<TextArea size="l" rows={9} value={body} onUpdate={setBody} placeholder="Введите текст для посетителя" /></label><div className="server-screen-image-field"><div><strong>Фоновое изображение</strong><p>Необязательно. JPG, PNG или WebP, до 10 МБ.</p></div>{imageURL ? <img src={imageURL} alt="Фоновое изображение экрана" /> : <div className="server-screen-image-placeholder">Изображение не выбрано</div>}<input id={inputId} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(event) => { uploadImage(event.target.files?.[0]); event.currentTarget.value = ''; }} /><label htmlFor={inputId}><Button view="outlined" component="span" loading={uploading}>{imageURL ? 'Заменить изображение' : 'Загрузить изображение'}</Button></label>{imageURL ? <Button view="flat-danger" size="s" onClick={() => setImageURL('')}>Убрать изображение</Button> : null}</div><div className="server-inline-editor__actions"><Button view="outlined" onClick={onCancel}>Отменить</Button><Button view="action" onClick={() => onSave(title, body, imageURL)}>Сохранить экран</Button></div></div><div className="server-device"><span className="server-device__speaker" /><div className="server-story-preview" style={{aspectRatio: '9 / 19.5', minHeight: 'auto', ...previewStyle}}><span>Как увидит посетитель</span><strong>{title || 'Заголовок'}</strong><p>{body || 'Текст'}</p></div></div></div></section>;
}

function Publish({flow, onNavigate}) { const ready = Boolean(flow.artifact && flow.screens.length); return <section className="page server-artifact-flow"><Header step={2} flow={flow} onNavigate={onNavigate} /><Card className="panel server-flow-card" view="filled"><h2>Публикация</h2>{ready ? <p>Экспонат готов к публикации. Ссылка и QR-код останутся постоянными.</p> : <p className="server-flow-message is-error">Сохраните сведения и добавьте хотя бы один экран.</p>}<FlowMessage flow={flow} /></Card><footer className="page-action-bar page-action-bar-split server-flow-footer"><Button view="outlined" size="xl" onClick={() => onNavigate('artifact-content')}>Назад</Button><Button view="action" size="xl" disabled={!ready} loading={flow.loading} onClick={flow.publish}>Опубликовать</Button></footer></section>; }

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
  if (mode === 'content') return <Content flow={flow} onNavigate={onNavigate} />;
  if (mode === 'publish') return <Publish flow={flow} onNavigate={onNavigate} />;
  return <Success flow={flow} onNavigate={onNavigate} />;
}
