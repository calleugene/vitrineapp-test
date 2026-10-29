import React, {useState} from 'react';
import {Button, Card, TextArea, TextInput} from '@gravity-ui/uikit';
import {ArtifactList} from './ArtifactList.jsx';
import {ArtifactPublish, ArtifactSuccess} from './ArtifactPublication.jsx';
import {ContentWorkspace} from './ContentWorkspace.jsx';

import './server-artifact-flow.css';

function FlowMessage({flow}) {
  if (!flow.error && !flow.notice) return null;
  return <div className={flow.error ? 'server-flow-message is-error' : 'server-flow-message'} role={flow.error ? 'alert' : 'status'}>{flow.error || flow.notice}</div>;
}

function Header({step, flow, onNavigate, screenDirty = false, title = 'Сведения об экспонате'}) {
  const dirty = flow.dirty || screenDirty;
  const label = screenDirty ? 'Есть несохранённый экран' : flow.dirty ? 'Сохранить изменения' : 'Все изменения сохранены';
  const leave = () => {
    if (flow.dirty && !window.confirm('Есть несохранённые изменения. Выйти без сохранения?')) return;
    onNavigate('artifacts');
  };
	return <><div className="server-flow-header"><h1>{title}</h1><div><span className={dirty ? 'is-dirty' : ''}>{label}</span><Button view="outlined" disabled={flow.loading} onClick={leave}>К экспонатам</Button><Button view="action" disabled={!flow.dirty || flow.loading || screenDirty} loading={flow.loading} onClick={flow.save}>Сохранить изменения</Button></div></div><nav className="server-flow-tabs" aria-label="Разделы экспоната">{[['artifact-basic', 'Основная информация'], ['artifact-content', 'Контент'], ['artifact-publish', 'Публикация']].map(([view, title], index) => <button type="button" key={view} className={step === index ? 'is-active' : ''} disabled={flow.loading} onClick={() => flow.saveAndGo(view)}>{title}</button>)}</nav></>;
}

function Basic({flow, onNavigate}) {
  return <section className="page server-artifact-flow"><Header step={0} flow={flow} onNavigate={onNavigate} /><Card className="panel server-flow-card" view="filled"><div className="server-basic-grid"><div><h2>Расскажите об экспонате</h2><label>Название<TextInput size="l" value={flow.draft.title} onUpdate={(title) => flow.change({title})} /></label><label>Краткое описание <small>{flow.draft.short_description.length}/250</small><TextArea size="l" rows={6} value={flow.draft.short_description} onUpdate={(short_description) => flow.change({short_description: short_description.slice(0, 250)})} /></label></div><div><h2>Обложка</h2><Cover artifact={flow.artifact} onUpload={flow.uploadCover} /></div></div><FlowMessage flow={flow} /></Card><footer className="page-action-bar server-flow-footer"><Button view="action" size="xl" onClick={() => flow.saveAndGo('artifact-content')}>К контенту</Button></footer></section>;
}

function Cover({artifact, onUpload}) {
  const [inputId] = useState(() => `cover-${Math.random().toString(36).slice(2)}`);
  return <div className="server-cover"><div className="server-cover-preview">{artifact?.cover_url ? <img src={artifact.cover_url} alt="Обложка экспоната" /> : <span>JPG, PNG или WebP до 10 МБ</span>}</div><input id={inputId} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(event) => { onUpload(event.target.files?.[0]); event.currentTarget.value = ''; }} /><label htmlFor={inputId}><Button view="outlined" component="span">{artifact?.cover_url ? 'Заменить' : 'Загрузить обложку'}</Button></label></div>;
}

export function ServerArtifactFlow({mode, artifacts, artifactsLoading, artifactsError, onReload, flow, onNavigate}) {
  if (mode === 'selector') return <ArtifactList artifacts={artifacts} artifactsLoading={artifactsLoading} artifactsError={artifactsError} onReload={onReload} flow={flow} message={<FlowMessage flow={flow} />} />;
  if (mode === 'basic') return <Basic flow={flow} onNavigate={onNavigate} />;
  if (mode === 'content') return <ContentWorkspace flow={flow} onNavigate={onNavigate} />;
  if (mode === 'publish') return <ArtifactPublish flow={flow} onNavigate={onNavigate} header={<Header title="Публикация экспоната" step={2} flow={flow} onNavigate={onNavigate} />} message={<FlowMessage flow={flow} />} />;
  return <ArtifactSuccess flow={flow} onNavigate={onNavigate} message={<FlowMessage flow={flow} />} />;
}
