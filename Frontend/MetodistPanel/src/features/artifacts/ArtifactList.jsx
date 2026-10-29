import React, {useRef, useState} from 'react';
import {Button, Card, Dialog, DropdownMenu, Icon, Label} from '@gravity-ui/uikit';
import {artifactPublicUrl} from '../../components/publication-utils.js';
import {Archive, ArrowRotateLeft, Copy, EllipsisVertical, Link, Pencil, Plus, TrashBin} from '@gravity-ui/icons';

function ArtifactActions({artifact, flow, onDelete}) {
  const disabled = flow.listBusy || flow.loading;
  const items = [
    ...(artifactPublicUrl(artifact, null, window.location.origin) ? [{text:'Встроить на сайт', icon:<Icon data={Link} size={16} />, action:() => flow.select(artifact.id, 'artifact-publish'), disabled}] : []),
    {text: 'Редактировать', icon: <Icon data={Pencil} size={16} />, action: () => flow.select(artifact.id), disabled},
    {text: 'Дублировать', icon: <Icon data={Copy} size={16} />, action: () => flow.duplicateArtifact(artifact.id), disabled},
    {text: 'Удалить', icon: <Icon data={TrashBin} size={16} />, theme: 'danger', action: () => onDelete(artifact), disabled},
    artifact.status === 'archived'
      ? {text: 'Восстановить', icon: <Icon data={ArrowRotateLeft} size={16} />, action: () => flow.restoreArtifact(artifact.id), disabled}
      : {text: 'В архив', icon: <Icon data={Archive} size={16} />, action: () => flow.archiveArtifact(artifact.id), disabled},
  ];
  return <div className="server-artifact-actions"><DropdownMenu items={items} size="m" popupProps={{placement: 'bottom-end'}} renderSwitcher={(props) => <Button {...props} disabled={disabled} className="artifact-row-menu artifact-action-button" view="flat-secondary" size="l" aria-label={`Действия с экспонатом «${artifact.title}»`}><Icon data={EllipsisVertical} size={20} /></Button>} /></div>;
}

function artifactStatus(artifact) {
  if (artifact.status === 'published') return {label: artifact.has_unpublished_changes ? 'Есть изменения' : 'Опубликован', theme: 'success'};
  if (artifact.status === 'archived') return {label: 'В архиве', theme: 'utility'};
  return {label: 'Черновик', theme: 'warning'};
}

const updatedAtFormatter = new Intl.DateTimeFormat('ru-RU', {day: '2-digit', month: 'short', year: 'numeric'});

function formatUpdatedAt(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? updatedAtFormatter.format(date) : '—';
}

function ArtifactTable({artifacts, flow, onDelete}) {
  return <div className="table-shell server-artifact-table">
    <div className="table-head"><span>Название</span><span>Статус</span><span>Обновлён</span><span>Действия</span></div>
    {artifacts.map((artifact) => {const status = artifactStatus(artifact); return <div className="table-row server-artifact-row" key={artifact.id}>
      <button type="button" className="server-artifact-select" disabled={flow.listBusy || flow.loading} onClick={() => flow.select(artifact.id)}><span className="server-artifact-cover">{artifact.cover_url ? <img src={artifact.cover_url} alt="" /> : <span>{artifact.title.slice(0, 1).toUpperCase()}</span>}</span><span className="table-cell-stack"><strong>{artifact.title}</strong><small>{artifact.short_description || 'Описание пока не добавлено'}</small></span></button>
      <span><Label theme={status.theme}>{status.label}</Label></span><span>{formatUpdatedAt(artifact.updated_at || artifact.created_at)}</span>
      <ArtifactActions artifact={artifact} flow={flow} onDelete={onDelete} />
    </div>;})}
  </div>;
}

export function ArtifactList({artifacts, artifactsLoading, artifactsError, onReload, flow, message}) {
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteLock = useRef(false);
  const active = artifacts.filter((item) => item.status !== 'archived');
  const archived = artifacts.filter((item) => item.status === 'archived');
  const askDelete = (item) => {flow.setError(''); setDeleteError(''); setToDelete(item);};
  const closeDelete = () => {if (!deleteLock.current) setToDelete(null);};
  const confirmDelete = async () => {
    if (!toDelete || deleteLock.current) return;
    deleteLock.current = true; setDeleting(true); setDeleteError('');
    try {
      const success = await flow.deleteArtifact(toDelete.id);
      if (success) setToDelete(null);
      else setDeleteError('Не удалось удалить экспонат. Попробуйте ещё раз.');
    } catch {setDeleteError('Не удалось удалить экспонат. Попробуйте ещё раз.');}
    finally {deleteLock.current = false; setDeleting(false);}
  };
  return <section className="page server-artifact-selector">
    <div className="page-heading"><div><h1>Экспонаты</h1><p>Создавайте истории для музейных предметов и готовьте их к показу посетителям.</p></div></div>
    <div className="stats-grid compact server-artifact-stats" aria-label="Сводка по экспонатам">
      {[['Всего экспонатов', artifacts.length], ['Опубликовано', artifacts.filter((item) => item.status === 'published').length], ['Черновиков', artifacts.filter((item) => item.status === 'draft').length]].map(([title, count]) => <Card key={title} className="stat-card" view="filled"><div className="stat-value">{count}</div><div className="stat-title">{title}</div></Card>)}
    </div>
    {message}
    <div className="two-column server-artifact-layout" aria-busy={artifactsLoading || flow.listBusy}>
      {artifactsLoading ? <Card className="panel" view="filled">Загружаем экспонаты…</Card> : artifactsError ? <Card className="panel" view="filled"><p>{artifactsError}</p><Button view="outlined" onClick={onReload}>Повторить</Button></Card> : <>
        <Card className="panel panel-large server-artifact-panel" view="filled">
          <div className="panel-header server-artifact-list-header"><div><h2>Экспонаты</h2><p className="panel-subtitle">Выберите экспонат, чтобы продолжить редактирование.</p></div><Button view="action" size="l" disabled={flow.listBusy || flow.loading} onClick={flow.start}><Icon data={Plus} size={18} />Добавить экспонат</Button></div>
          {active.length ? <ArtifactTable artifacts={active} flow={flow} onDelete={askDelete} /> : <div className="server-empty"><p>Активных экспонатов пока нет</p><span>Добавьте новый или восстановите экспонат из архива.</span></div>}
        </Card>
        <Card className="panel" view="filled"><div className="panel-header"><h2>Что дальше</h2></div><ol className="server-artifact-guide"><li>Добавьте основные сведения и обложку.</li><li>Соберите историю из экранов.</li><li>Опубликуйте и разместите QR-код рядом с экспонатом.</li><li>Для размещения на другом сайте выберите «Встроить на сайт» в меню опубликованного экспоната.</li></ol></Card>
        <Card className="panel server-artifact-panel server-artifact-archive" view="filled">
          <div className="panel-header"><div><h2>Экспонаты в архиве <span className="panel-subtitle">({archived.length})</span></h2><p className="panel-subtitle">Архивные экспонаты можно восстановить в черновики.</p></div></div>
          {archived.length ? <ArtifactTable artifacts={archived} flow={flow} onDelete={askDelete} /> : <p className="panel-subtitle">В архиве пока нет экспонатов.</p>}
        </Card>
      </>}
    </div>
    <Dialog open={Boolean(toDelete)} onClose={closeDelete} size="s" initialFocus="cancel">
      <Dialog.Header caption="Удалить экспонат?" />
      <Dialog.Body><p>Удалить «{toDelete?.title}»? Экспонат исчезнет из кабинета, а его публичная ссылка перестанет работать. Восстановить его из архива будет нельзя.</p>{deleteError && <p role="alert">{deleteError}</p>}</Dialog.Body>
      <Dialog.Footer textButtonCancel="Отмена" textButtonApply="Да, удалить" onClickButtonCancel={closeDelete} onClickButtonApply={confirmDelete} propsButtonCancel={{disabled: deleting}} propsButtonApply={{view: 'outlined-danger', loading: deleting, disabled: deleting}} />
    </Dialog>
  </section>;
}
