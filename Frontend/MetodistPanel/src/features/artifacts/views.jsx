import React, {useState} from 'react';
import QRCode from 'qrcode';
import {Button, Card, Label, TextInput} from '@gravity-ui/uikit';
import {ArrowRight, Plus} from '@gravity-ui/icons';
import {ARTIFACTS_API_URL} from '../../api';
import {ARTIFACT_CATEGORY_SUMMARY, ARTIFACT_TABS, CATEGORY_OPTIONS} from '../../app/constants';
import {formatArtifactDate, getArtifactStatusLabel, getArtifactStatusTheme} from '../../app/utils';
import {Breadcrumbs, InlineTabs} from '../../components/ui';

const printArtifactCard = () => window.print();

export function ArtifactsView({artifactTab, setArtifactTab, artifactCategory, setArtifactCategory, setView, artifacts, artifactsLoading, artifactsError, onReload, onStartArtifactFlow}) {
  const filteredArtifacts = artifacts.filter((artifact) => {
    if (artifactTab === 'all') return true;
    if (artifactTab === 'published') return artifact.status === 'published';
    if (artifactTab === 'draft') return artifact.status === 'draft';
    if (artifactTab === 'archive') return artifact.status === 'archived';
    return true;
  }).filter((artifact) => {
    if (artifactCategory === 'all') return true;
    return artifact.category === artifactCategory;
  });

  const publishedCount = artifacts.filter((artifact) => artifact.status === 'published').length;
  const draftCount = artifacts.filter((artifact) => artifact.status === 'draft').length;
  const archiveCount = artifacts.filter((artifact) => artifact.status === 'archived').length;

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <h1>Артефакты</h1>
          <p>Управляйте артефактами музея: добавляйте, редактируйте и распределяйте по маршрутам.</p>
        </div>
      </div>

      <div className="toolbar-row">
        <InlineTabs
          value={artifactTab}
          items={ARTIFACT_TABS.map((item) => ({id: item.id, title: item.title}))}
          onChange={setArtifactTab}
        />
        <div className="toolbar-actions">
          <Button view="outlined">По дате создания</Button>
        </div>
      </div>

      <div className="stats-grid compact">
        <Card className="stat-card" view="filled"><div className="stat-value">{artifacts.length}</div><div className="stat-title">Всего артефактов</div></Card>
        <Card className="stat-card" view="filled"><div className="stat-value">{publishedCount}</div><div className="stat-title">Опубликовано</div></Card>
        <Card className="stat-card" view="filled"><div className="stat-value">{draftCount}</div><div className="stat-title">Черновиков</div></Card>
        <Card className="stat-card" view="filled"><div className="stat-value">{archiveCount}</div><div className="stat-title">В архиве</div></Card>
      </div>

      <div className="artifacts-layout">
        <div className="artifact-grid">
          {artifactsLoading ? <Card className="panel" view="filled"><p>Загружаем артефакты...</p></Card> : null}
          {!artifactsLoading && artifactsError ? (
            <Card className="panel" view="filled">
              <p>{artifactsError}</p>
              <Button view="outlined" onClick={onReload}>Повторить</Button>
            </Card>
          ) : null}
          {!artifactsLoading && !artifactsError && filteredArtifacts.length === 0 ? (
            <Card className="panel" view="filled">
              <h3>Артефактов пока нет</h3>
              <p>Создайте первый артефакт и он сразу появится здесь.</p>
            </Card>
          ) : null}
          {!artifactsLoading && !artifactsError && filteredArtifacts.map((artifact) => (
            <Card key={artifact.id} className="artifact-card" view="filled" onClick={() => setView('artifact-basic')}>
              <div className="artifact-cover" />
              <div className="artifact-copy">
                <div className="artifact-copy-top">
                  <Label theme={getArtifactStatusTheme(artifact.status)} size="xs">
                    {getArtifactStatusLabel(artifact.status)}
                  </Label>
                  <span className="artifact-copy-date">{formatArtifactDate(artifact.updated_at || artifact.created_at)}</span>
                </div>
                <h3>{artifact.title}</h3>
                <p>{artifact.description}</p>
                <div className="artifact-copy-footer">
                  <span>{CATEGORY_OPTIONS.find((item) => item.value === artifact.category)?.content || artifact.category}</span>
                  <ArrowRight />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="stack">
          <Card className="panel" view="filled">
            <div className="panel-header">
              <h3>Категории</h3>
              <Button view="flat" size="m">Фильтрация</Button>
            </div>
            <ul className="category-filter-list">
              {ARTIFACT_CATEGORY_SUMMARY.map((category) => (
                <li key={category.value}>
                  <button
                    type="button"
                    className={`category-filter-button ${artifactCategory === category.value ? 'is-active' : ''}`}
                    onClick={() => setArtifactCategory(category.value)}
                  >
                    <span>{category.label}</span>
                    <strong>{category.count}</strong>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="panel" view="filled">
            <h3>Советы методиста</h3>
            <p>Добавляйте подробное описание, контекст и медиаматериалы - это повышает вовлечённость посетителей.</p>
            <Button view="outlined">Узнать больше</Button>
          </Card>
          <Card className="panel" view="filled">
            <h3>Импорт артефактов</h3>
            <p>Загрузите несколько артефактов сразу из Excel-файла.</p>
            <Button view="flat">Импортировать</Button>
          </Card>
        </div>
      </div>

      <div className="page-action-bar">
        <Button view="action" size="xl" onClick={onStartArtifactFlow || (() => setView('artifact-basic'))}>
          <Plus />
          Добавить артефакт
        </Button>
      </div>
    </section>
  );
}

export function ArtifactSuccessView({setView, artifact, onCreateAnother}) {
  const publicUrl = artifact ? `${ARTIFACTS_API_URL}/artifacts/${artifact.id}` : 'https://museum.vira.ai/a/demo';
  const [qrUrl, setQrUrl] = useState('');
  React.useEffect(() => { QRCode.toDataURL(publicUrl, {width: 640, margin: 2, errorCorrectionLevel: 'M'}).then(setQrUrl).catch(() => setQrUrl('')); }, [publicUrl]);
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(publicUrl); }
    catch { window.prompt('Скопируйте ссылку', publicUrl); }
  };
  const shareLink = async () => {
    if (navigator.share) { await navigator.share({title: artifact?.title || 'Экспонат Витрины', url: publicUrl}); return; }
    await copyLink();
  };
  const downloadQr = async () => {
    try {
      const link = document.createElement('a');
      if (!qrUrl) throw new Error('QR is still generating');
      link.href = qrUrl;
      link.download = `vitrina-${artifact?.id || 'artifact'}-qr.png`;
      link.click();
    } catch { window.alert('QR-код ещё генерируется. Повторите попытку через секунду.'); }
  };

  return (
    <section className="page">
      <Breadcrumbs path="Артефакты / Добавление артефакта" />
      <div className="page-heading"><div><h1>Добавление артефакта</h1></div></div>
      <Card className="panel success-hero" view="filled">
        <div className="success-badge">✓</div>
        <h2>Артефакт успешно опубликован!</h2>
        <p>Теперь он сохранён в ArtifactsService и доступен в списке артефактов.</p>
        <div className="success-grid">
          <Card className="mini-panel" view="filled"><h4>QR-код для печати</h4>{qrUrl ? <img className="qr-box" src={qrUrl} alt="QR-код публичной ссылки" /> : <div className="qr-box" aria-label="Генерация QR-кода">…</div>}<Button view="action" onClick={downloadQr}>Скачать QR-код (PNG)</Button></Card>
          <Card className="mini-panel" view="filled"><h4>Короткая ссылка</h4><TextInput size="xl" value={publicUrl} readOnly /><Button view="outlined" onClick={shareLink}>Поделиться ссылкой</Button></Card>
          <Card className="mini-panel" view="filled"><h4>Скачать для печати</h4><div className="download-list"><Button view="flat" onClick={printArtifactCard}>Печать / PDF</Button><Button view="flat" onClick={downloadQr}>Скачать PNG</Button></div></Card>
        </div>
        <div className="success-actions">
          <Button view="outlined" size="l" onClick={onCreateAnother}>Создать ещё один</Button>
          <Button view="action" size="xl" onClick={() => setView('artifacts')}>Завершить</Button>
        </div>
      </Card>
    </section>
  );
}
