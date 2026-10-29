import React, {useCallback, useRef, useState} from 'react';
import QRCode from 'qrcode';
import {Button, Card, Checkbox, Dialog, Label, RadioGroup, Select, Switch, TextArea, TextInput} from '@gravity-ui/uikit';
import {Grip, Pencil, Plus, TrashBin} from '@gravity-ui/icons';
import {ROUTE_TABS} from './demo-data';
import {Breadcrumbs, Field, InlineTabs, WizardSteps} from '../../components/ui';
import {PublicationChecks, PublicationDelivery, PublicationIdentity} from '../../components/PublicationDelivery';
import {routePublicUrl} from '../../components/publication-utils';
import './publication.css';

const ROUTE_STATUS_OPTIONS = [
  {value: 'draft', content: 'Черновик'},
  {value: 'archived', content: 'Архив'},
  {value: 'published', content: 'Опубликован'},
];

const ROUTE_DIFFICULTY_OPTIONS = [
  {value: 'basic', content: 'Базовый'},
  {value: 'medium', content: 'Средний'},
  {value: 'advanced', content: 'Продвинутый'},
];

const ROUTE_LANGUAGE_OPTIONS = [
  {value: 'ru', content: 'Русский'},
  {value: 'en', content: 'English'},
];



export function RoutesView({routeTab, setRouteTab, routeRows, routeSummary, routeActivities, onStartRouteFlow, onEditRoute, onDeleteRoute}) {
  const [routeToDelete, setRouteToDelete] = useState(null);
  const filteredRoutes = routeRows.filter((route) => {
    if (routeTab === 'all-routes') return true;
    if (routeTab === 'published-routes') return route.status === 'Опубликован';
    if (routeTab === 'draft-routes') return route.status === 'Черновик';
    if (routeTab === 'archive-routes') return route.status === 'Архив';
    return true;
  });

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>Маршруты</h1>
          <p>Создавайте и редактируйте маршруты, объединяйте артефакты и точки музея.</p>
        </div>
      </div>

      <InlineTabs
        className="section-tabs-wide"
        value={routeTab}
        items={ROUTE_TABS.map((item) => ({id: item.id, title: item.title}))}
        onChange={setRouteTab}
      />

      <div className="stats-grid compact">
        <Card className="stat-card" view="filled"><div className="stat-value">{routeSummary.total}</div><div className="stat-title">Всего маршрутов</div></Card>
        <Card className="stat-card" view="filled"><div className="stat-value">{routeSummary.published}</div><div className="stat-title">Опубликовано</div></Card>
        <Card className="stat-card" view="filled"><div className="stat-value">{routeSummary.draft}</div><div className="stat-title">Черновиков</div></Card>
        <Card className="stat-card" view="filled"><div className="stat-value">{routeSummary.totalViews}</div><div className="stat-title">Суммарные просмотры</div></Card>
      </div>

      <div className="two-column">
        <Card className="panel panel-large" view="filled">
          <div className="panel-header">
            <h3>Маршруты</h3>
          </div>
          <div className="table-shell">
            <div className="table-head">
              <span>Название</span>
              <span>Статус</span>
              <span>Артефакты</span>
              <span>Обновлён</span>
              <span>Просмотры</span>
              <span>Действия</span>
            </div>
            {filteredRoutes.map((row) => (
              <div className="table-row" key={row.id || row.title}>
                <div className="table-cell-stack">
                  <strong>{row.title}</strong>
                </div>
                <span><Label theme={row.status === 'Опубликован' ? 'success' : row.status === 'Черновик' ? 'warning' : 'utility'}>{row.status}</Label></span>
                <span>{row.artifacts}</span>
                <span>{row.updated}</span>
                <span>{row.views}</span>
                <span className="route-row-actions">
                  <Button view="flat" size="m" title="Редактировать маршрут" onClick={() => onEditRoute(row)}>
                    <Pencil />
                  </Button>
                  <Button view="flat-danger" size="m" title="Удалить маршрут" onClick={() => setRouteToDelete(row)}>
                    <TrashBin />
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </Card>

        <div className="stack">
          <Card className="panel" view="filled">
            <div className="panel-header">
              <h3>Последняя активность</h3>
              <Button view="flat" size="m">Смотреть все</Button>
            </div>
            <ul className="activity-feed">
              {routeActivities.map((item) => (
                <li className="activity-feed-item" key={`${item.title}-${item.meta}`}>
                  <div className="activity-feed-copy">
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="panel" view="filled">
            <h3>Советы методиста</h3>
            <p>Создавайте короткие маршруты: маршруты до 10 артефактов проходят на 23% чаще.</p>
          </Card>
        </div>
      </div>

      <div className="page-action-bar">
        <Button view="action" size="xl" onClick={onStartRouteFlow}>
          <Plus />
          Создать маршрут
        </Button>
      </div>

      <Dialog open={Boolean(routeToDelete)} onClose={() => setRouteToDelete(null)} size="s">
        <Dialog.Header caption="Удаление маршрута">Удалить маршрут?</Dialog.Header>
        <Dialog.Body>
          <p>Маршрут «{routeToDelete?.title}» будет скрыт из списка на этом рабочем месте.</p>
        </Dialog.Body>
        <Dialog.Footer
          textButtonCancel="Отменить"
          textButtonApply="Удалить"
          onClickButtonCancel={() => setRouteToDelete(null)}
          onClickButtonApply={() => {
            onDeleteRoute(routeToDelete);
            setRouteToDelete(null);
          }}
          propsButtonApply={{view: 'flat-danger'}}
        />
      </Dialog>
    </section>
  );
}

export function RouteBasicView({routeDraft, setRouteDraft, setView, goToRouteStep}) {
  return (
    <section className="page">
      <Breadcrumbs path="Маршруты / Создание маршрута" />
      <div className="page-heading">
        <div>
          <h1>Создание маршрута</h1>
          <p>Заполните основную информацию. Черновик сохраняется автоматически в этом браузере.</p>
        </div>
      </div>

      <WizardSteps current={1} onStepSelect={goToRouteStep} />

      <div className="three-column">
        <Card className="panel panel-form" view="filled">
          <h3>Основная информация</h3>
          <Field label="Название маршрута *">
            <TextInput size="xl" value={routeDraft.title} onUpdate={(value) => setRouteDraft((prev) => ({...prev, title: value}))} />
          </Field>
          <Field label="Краткое описание *">
            <TextInput size="xl" value={routeDraft.subtitle} onUpdate={(value) => setRouteDraft((prev) => ({...prev, subtitle: value}))} />
          </Field>
          <Field label="Описание маршрута">
            <TextArea size="xl" rows={6} value={routeDraft.description} onUpdate={(value) => setRouteDraft((prev) => ({...prev, description: value}))} />
          </Field>
          <div className="field-grid">
            <Field label="Длительность">
              <TextInput size="xl" value={routeDraft.duration} onUpdate={(value) => setRouteDraft((prev) => ({...prev, duration: value}))} />
            </Field>
            <Field label="Уровень">
              <Select size="xl" value={[routeDraft.difficulty]} options={ROUTE_DIFFICULTY_OPTIONS} onUpdate={(value) => setRouteDraft((prev) => ({...prev, difficulty: value[0]}))} />
            </Field>
            <Field label="Аудитория">
              <TextInput size="xl" value={routeDraft.audience} onUpdate={(value) => setRouteDraft((prev) => ({...prev, audience: value}))} />
            </Field>
            <Field label="Язык">
              <Select size="xl" value={[routeDraft.language]} options={ROUTE_LANGUAGE_OPTIONS} onUpdate={(value) => setRouteDraft((prev) => ({...prev, language: value[0]}))} />
            </Field>
          </div>
        </Card>

        <div className="stack">
          <Card className="panel" view="filled">
            <h3>Статус</h3>
            <RadioGroup direction="vertical" value={routeDraft.status} onUpdate={(value) => setRouteDraft((prev) => ({...prev, status: value}))} options={ROUTE_STATUS_OPTIONS} />
          </Card>
          <Card className="panel" view="filled">
            <h3>Автосохранение</h3>
            <p>Изменения маршрута сохраняются в localStorage и восстановятся после перезагрузки страницы.</p>
          </Card>
        </div>
      </div>

      <div className="page-action-bar">
        <Button view="outlined" size="xl" onClick={() => setView('routes')}>
          Отменить
        </Button>
        <Button
          view="action"
          size="xl"
          onClick={() => goToRouteStep(2)}
          disabled={!routeDraft.title.trim() || !routeDraft.subtitle.trim()}
        >
          К контенту
        </Button>
      </div>
    </section>
  );
}

export function RouteContentView({routeDraft, artifacts, goToRouteStep, toggleRouteArtifact, reorderRouteArtifact}) {
  const [draggedArtifactId, setDraggedArtifactId] = useState(null);
  const availableArtifacts = artifacts;
  const selectedArtifacts = routeDraft.artifactIds
    .map((artifactId) => availableArtifacts.find((artifact) => artifact.id === artifactId))
    .filter(Boolean);

  return (
    <section className="page">
      <Breadcrumbs path="Маршруты / Создание маршрута" />
      <div className="page-heading">
        <div>
          <h1>Контент маршрута</h1>
          <p>Выберите артефакты, которые посетитель увидит в маршруте.</p>
        </div>
      </div>

      <WizardSteps current={2} onStepSelect={goToRouteStep} />

      <div className="route-builder">
        <Card className="panel route-list" view="filled">
          <h3>Артефакты</h3>
          {artifacts.length === 0 ? <p>Сначала создайте экспонаты в разделе «Артефакты». Для публикации маршрута экспонаты тоже должны быть опубликованы.</p> : null}
          {availableArtifacts.map((artifact) => (
            <Checkbox
              key={artifact.id}
              checked={routeDraft.artifactIds.includes(artifact.id)}
              onUpdate={() => toggleRouteArtifact(artifact.id)}
            >
              <strong>{artifact.title}</strong>
              <span>{artifact.description}</span>
            </Checkbox>
          ))}
        </Card>

        <Card className="panel route-order" view="filled">
          <h3>Порядок маршрута</h3>
          {selectedArtifacts.length === 0 ? <p>Выберите хотя бы один артефакт, чтобы собрать маршрут.</p> : null}
          {selectedArtifacts.map((artifact, index) => (
            <div
              className={`table-row route-order-row ${draggedArtifactId === artifact.id ? 'is-dragging' : ''}`}
              key={artifact.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedArtifactId && draggedArtifactId !== artifact.id) {
                  reorderRouteArtifact(draggedArtifactId, artifact.id);
                }
                setDraggedArtifactId(null);
              }}
            >
              <button
                type="button"
                className="story-drag-handle"
                draggable
                aria-label={`Перетащить артефакт ${index + 1}`}
                onDragStart={() => setDraggedArtifactId(artifact.id)}
                onDragEnd={() => setDraggedArtifactId(null)}
              >
                <Grip />
              </button>
              <span className="order-index">{index + 1}</span>
              <div className="table-cell-stack">
                <strong>{artifact.title}</strong>
                <span>{artifact.description}</span>
              </div>
              <Button view="flat-danger" size="m" onClick={() => toggleRouteArtifact(artifact.id)}>
                <TrashBin />
              </Button>
            </div>
          ))}
        </Card>
      </div>

      <div className="page-action-bar">
        <Button view="outlined" size="xl" onClick={() => goToRouteStep(1)}>
          Назад
        </Button>
        <Button
          view="action"
          size="xl"
          onClick={() => goToRouteStep(3)}
          disabled={!routeDraft.artifactIds.length}
        >
          К публикации
        </Button>
      </div>
    </section>
  );
}

function routePublicationState(routeDraft) {
  const hasTitle = Boolean(routeDraft.title?.trim());
  const hasContent = Boolean(routeDraft.artifactIds?.length);
  const statusLabel = ROUTE_STATUS_OPTIONS.find((item) => item.value === routeDraft.status)?.content || 'Черновик';
  const actionLabel = routeDraft.status === 'published' ? 'Опубликовать маршрут' : routeDraft.status === 'archived' ? 'Сохранить в архиве' : 'Сохранить черновик';
  const checks = [
    {label: 'Название маршрута', description: hasTitle ? 'Посетитель увидит его перед началом прохождения.' : 'Вернитесь к основной информации и укажите название.', ready: hasTitle},
    {label: 'Экспонаты добавлены', description: hasContent ? `Выбрано: ${routeDraft.artifactIds.length}. Доступность и публикацию экспонатов проверим при сохранении.` : 'Добавьте хотя бы один артефакт на предыдущем шаге.', ready: hasContent},
  ];
  return {
    statusLabel,
    actionLabel,
    checks,
    canSave: hasTitle && (routeDraft.status !== 'published' || hasContent),
    title: routeDraft.title || 'Маршрут без названия',
    description: routeDraft.subtitle || routeDraft.description,
    meta: `Экспонатов: ${routeDraft.artifactIds?.length || 0}${routeDraft.duration ? ` · ${routeDraft.duration}` : ''}`,
    visibilityDescription: routeDraft.visibility === 'public'
      ? 'Публичная ссылка и QR-код появятся только после подтверждённой публикации.'
      : 'Маршрут доступен команде. Публичная ссылка и QR-код не создаются.',
  };
}

export function RoutePublishView({routeDraft, setRouteDraft, goToRouteStep, onPublishRoute, routeSyncError}) {
  const [isSaving, setIsSaving] = useState(false);
  const publication = routePublicationState(routeDraft);
  const save = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try { await onPublishRoute(); }
    finally { setIsSaving(false); }
  };
  return (
    <section className="page route-publication">
      <Breadcrumbs path="Маршруты / Создание маршрута" />
      <div className="page-heading"><div><h1>Публикация маршрута</h1><p>Проверьте содержание и выберите, кому будет доступен маршрут.</p></div></div>
      <WizardSteps current={3} onStepSelect={isSaving ? undefined : goToRouteStep} />
      <PublicationIdentity title={publication.title} description={publication.description} meta={publication.meta} status={`После сохранения: ${publication.statusLabel}`} />
      <div className="route-publication-layout">
        <Card className="panel panel-form" view="filled">
          <h3>Настройки публикации</h3>
          <Field label="Статус маршрута *">
            <RadioGroup aria-label="Статус маршрута" disabled={isSaving} direction="vertical" value={routeDraft.status} onUpdate={(value) => setRouteDraft((prev) => ({...prev, status: value}))} options={ROUTE_STATUS_OPTIONS} />
          </Field>
          <Field label="Видимость *">
            <Select aria-label="Видимость маршрута" disabled={isSaving} size="xl" value={[routeDraft.visibility]} options={[{value: 'public', content: 'Публичный'}, {value: 'team', content: 'Только команда музея'}]} onUpdate={(value) => setRouteDraft((prev) => ({...prev, visibility: value[0]}))} />
            <p className="route-publication-note">{publication.visibilityDescription}</p>
          </Field>
          <Field label="Начало прохождения">
            <div className="switch-list"><div className="switch-row"><span>Требовать QR-старт у первой точки</span><Switch controlProps={{'aria-label':'Требовать QR-старт у первой точки'}} disabled={isSaving} checked={routeDraft.requireQr} onUpdate={(value) => setRouteDraft((prev) => ({...prev, requireQr: value}))} /></div></div>
          </Field>
        </Card>
        <Card className="publication-review" view="filled"><h2>Проверьте перед сохранением</h2><PublicationChecks items={publication.checks} /></Card>
      </div>
      {routeSyncError ? <div role="alert" className="route-publication-error"><strong>Маршрут не сохранён</strong><p>{routeSyncError.message || 'Не удалось получить подтверждение сервера. Проверьте подключение и повторите попытку.'}</p></div> : null}
      <div className="page-action-bar">
        <Button disabled={isSaving} view="outlined" size="xl" onClick={() => goToRouteStep(2)}>Назад к контенту</Button>
        <Button disabled={!publication.canSave || isSaving} loading={isSaving} view="action" size="xl" onClick={save}>{isSaving ? 'Сохраняем на сервере…' : publication.actionLabel}</Button>
      </div>
    </section>
  );
}

export function RouteSuccessView({route, setView, onCreateAnotherRoute}) {
  const headingRef = useRef(null);
  React.useEffect(() => {headingRef.current?.focus();}, []);
  const publicUrl = routePublicUrl(route, window.location.origin);
  const loadQr = useCallback(async () => {
    if (!publicUrl) throw new Error('Сначала опубликуйте маршрут с публичной видимостью.');
    const qrTarget = new URL(publicUrl);
    qrTarget.searchParams.set('source', 'qr');
    return QRCode.toDataURL(qrTarget.href, {width: 480, margin: 2});
  }, [publicUrl]);
  const statusLabel = ROUTE_STATUS_OPTIONS.find((item) => item.value === route?.status)?.content || 'Не подтверждён';
  const heading = publicUrl ? 'Маршрут опубликован' : route?.status === 'archived' ? 'Маршрут сохранён в архиве' : route?.status === 'draft' ? 'Черновик сохранён' : 'Маршрут сохранён для команды';
  return (
    <section className="page route-publication">
      <Breadcrumbs path="Маршруты / Создание маршрута" />
      <div className="page-heading"><div><h1 ref={headingRef} tabIndex={-1}>{heading}</h1><p>{route?.serverSaved === true ? 'Маршрут сохранён. Ниже — доступные способы открыть его для просмотра.' : 'Сохранение не подтверждено. Попробуйте сохранить маршрут ещё раз.'}</p></div></div>
      <PublicationIdentity title={route?.title || 'Маршрут'} description={route?.subtitle || route?.description} meta={`Экспонатов: ${route?.artifactIds?.length || 0}`} status={route?.serverSaved ? statusLabel : 'Не подтверждён'} statusTheme={route?.serverSaved && route.status === 'published' ? 'success' : 'neutral'} />
      <PublicationDelivery publicUrl={publicUrl} loadQr={loadQr} fileName={`vitrina-route-${route?.id || 'route'}-qr.png`} emptyMessage="Публичная ссылка и QR-код появятся после публикации с публичным доступом." linkNote="Откройте маршрут на телефоне и проверьте его перед размещением QR-кода." />
      <div className="page-action-bar">
        <Button view="outlined" size="l" onClick={onCreateAnotherRoute}>Создать ещё маршрут</Button>
        <Button view="action" size="xl" onClick={() => setView('routes')}>К списку маршрутов</Button>
      </div>
    </section>
  );
}
