import React, {useState} from 'react';
import QRCode from 'qrcode';
import {Button, Card, Checkbox, Dialog, Label, RadioGroup, Select, Switch, TextArea, TextInput} from '@gravity-ui/uikit';
import {Grip, Pencil, Plus, TrashBin} from '@gravity-ui/icons';
import {ROUTE_TABS} from '../../app/constants';
import {Breadcrumbs, Field, InlineTabs, WizardSteps} from '../../components/ui';

const ROUTE_STATUS_OPTIONS = [
  {value: 'draft', content: 'Черновик'},
  {value: 'moderation', content: 'На модерации'},
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

const MOCK_ROUTE_ARTIFACTS = [
  {
    id: 'mock-artifact-letter',
    title: 'Письмо фронтовика 1943 года',
    description: 'Личное письмо с фронта с историческим контекстом.',
    category: 'letters',
    status: 'published',
  },
  {
    id: 'mock-artifact-photo',
    title: 'Фотография полевой почты',
    description: 'Фото экспедиционной почтовой станции.',
    category: 'photo',
    status: 'published',
  },
  {
    id: 'mock-artifact-medal',
    title: 'Медаль За отвагу',
    description: 'Предметный артефакт для финального шага маршрута.',
    category: 'items',
    status: 'draft',
  },
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
  const availableArtifacts = artifacts.length > 0 ? artifacts : MOCK_ROUTE_ARTIFACTS;
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
          {artifacts.length === 0 ? <p>Показаны тестовые артефакты для сборки маршрута.</p> : null}
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

export function RoutePublishView({routeDraft, setRouteDraft, goToRouteStep, onPublishRoute, routeSyncError}) {
  return (
    <section className="page">
      <Breadcrumbs path="Маршруты / Создание маршрута" />
      <div className="page-heading"><div><h1>Публикация маршрута</h1><p>Проверьте настройки доступности перед публикацией.</p></div></div>
      <WizardSteps current={3} onStepSelect={goToRouteStep} />
      <div className="content-layout">
        <Card className="panel panel-form" view="filled">
          <h3>Настройки публикации</h3>
          <Field label="Статус маршрута *">
            <RadioGroup direction="vertical" value={routeDraft.status} onUpdate={(value) => setRouteDraft((prev) => ({...prev, status: value}))} options={ROUTE_STATUS_OPTIONS} />
          </Field>
          <Field label="Видимость *">
            <Select size="xl" value={[routeDraft.visibility]} options={[{value: 'public', content: 'Публичный'}, {value: 'team', content: 'Только команда музея'}]} onUpdate={(value) => setRouteDraft((prev) => ({...prev, visibility: value[0]}))} />
          </Field>
          <Field label="Дополнительные настройки">
            <div className="switch-list">
              <div className="switch-row"><span>Показывать маршрут на карте музея</span><Switch checked={routeDraft.showOnMap} onUpdate={(value) => setRouteDraft((prev) => ({...prev, showOnMap: value}))} /></div>
              <div className="switch-row"><span>Требовать QR-старт у первой точки</span><Switch checked={routeDraft.requireQr} onUpdate={(value) => setRouteDraft((prev) => ({...prev, requireQr: value}))} /></div>
            </div>
          </Field>
        </Card>

        <div className="stack">
          <Card className="panel" view="filled">
            <h3>Превью маршрута</h3>
            <div className="artifact-preview-card"><div className="preview-thumb" /><div><Label theme="info" size="xs">{routeDraft.artifactIds.length} артефактов</Label><h4>{routeDraft.title}</h4><p>{routeDraft.subtitle}</p></div></div>
          </Card>
          <Card className="panel" view="filled"><h3>Проверка</h3><ul className="activity-list compact"><li>Название заполнено</li><li>Контент можно менять позже</li><li>Перед публикацией проверяется синхронизация с RouteService</li></ul></Card>
        </div>
      </div>
      <div className="page-action-bar">
        <Button view="outlined" size="xl" onClick={() => goToRouteStep(2)}>Назад к контенту</Button>
        {routeSyncError ? <span role="alert" className="form-error">Не удалось синхронизировать маршрут с сервером. Проверьте подключение и повторите попытку.</span> : null}
        <Button view="action" size="xl" onClick={onPublishRoute}>Сохранить маршрут</Button>
      </div>
    </section>
  );
}

export function RouteSuccessView({route, setView, onCreateAnotherRoute}) {
  const publicUrl = `https://museum.vira.ai/routes/${route?.id || 'demo'}`;
  const [qrUrl, setQrUrl] = useState('');
  React.useEffect(() => { QRCode.toDataURL(publicUrl, {width: 480, margin: 2}).then(setQrUrl).catch(() => setQrUrl('')); }, [publicUrl]);
  const copyLink = async () => {
    if (navigator.share) { await navigator.share({title: route?.title || 'Маршрут Витрины', url: publicUrl}); return; }
    try { await navigator.clipboard.writeText(publicUrl); }
    catch { window.prompt('Скопируйте ссылку', publicUrl); }
  };
  const downloadQr = () => {
    if (!qrUrl) return;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `vitrina-route-${route?.id || 'demo'}-qr.png`;
    link.click();
  };
  return (
    <section className="page">
      <Breadcrumbs path="Маршруты / Создание маршрута" />
      <div className="page-heading"><div><h1>Создание маршрута</h1></div></div>
      <WizardSteps current={3} accent />
      <Card className="panel success-hero" view="filled">
        <div className="success-badge">✓</div>
        <h2>Маршрут готов</h2>
        <p>Маршрут «{route?.title || 'Новый маршрут'}» опубликован и доступен в списке маршрутов.</p>
        <div className="success-grid">
          <Card className="mini-panel" view="filled"><h4>QR-код маршрута</h4>{qrUrl ? <img className="qr-box" src={qrUrl} alt="QR-код маршрута" /> : <div className="qr-box">…</div>}<Button view="action" onClick={downloadQr}>Скачать QR-код</Button></Card>
          <Card className="mini-panel" view="filled"><h4>Публичная ссылка</h4><TextInput size="xl" value={publicUrl} readOnly /><Button view="outlined" onClick={copyLink}>Скопировать ссылку</Button></Card>
        </div>
        <div className="success-actions">
          <Button view="outlined" size="l" onClick={onCreateAnotherRoute}>Создать ещё маршрут</Button>
          <Button view="action" size="xl" onClick={() => setView('routes')}>К списку маршрутов</Button>
        </div>
      </Card>
    </section>
  );
}
