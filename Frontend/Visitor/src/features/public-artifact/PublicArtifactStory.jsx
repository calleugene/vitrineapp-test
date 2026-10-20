import React, {Suspense, lazy, useEffect, useMemo, useState} from 'react';
import './public-artifact-story.css';
import {analyticsEvents, analyticsVisitorKey} from '../../app/analytics-events.js';
import {appConfig} from '../../app/config.js';
import {StoryFeedback} from './PublicServices.jsx';

const apiBase = appConfig.artifactsApiUrl.replace(/\/$/, '');
const StoryExperienceView = lazy(() => import('../story/views.jsx').then((module) => ({default: module.StoryExperienceView})));
const PUBLIC_STORY_RETURN_URL_KEY = 'viralabs.public.story.return-url';
const PUBLIC_COLLECTED_ARTIFACTS_KEY = 'viralabs.public.collected-artifacts';

function parsePayload(value) {
  if (typeof value !== 'string') return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizePublication(payload) {
  const snapshot = payload?.snapshot || payload?.publication?.snapshot || payload;
  const artifact = snapshot?.artifact || snapshot?.exhibit || snapshot || {};
  const rawScreens = snapshot?.screens || artifact?.screens || [];
  const cover = {
    id: 'cover',
    type: 'cover',
    media: 'image',
    mediaLabel: 'Обложка экспоната',
    imageUrl: artifact.cover_url || artifact.coverUrl || '',
    title: artifact.title || 'Экспонат',
    text: artifact.short_description || artifact.description || '',
  };
  const screens = rawScreens.map((screen, index) => {
    const payloadValue = parsePayload(screen.payload);
    const content = screen.content || payloadValue.content || payloadValue || {};
    return {
      id: screen.id || `screen-${index}`,
      type: 'fact',
      media: 'image',
      mediaLabel: 'Изображение экрана',
      imageUrl: screen.image_url || content.image_url || content.imageUrl || '',
      title: screen.title || content.title || 'Экран экспоната',
      text: screen.text || content.body || content.text || '',
      note: screen.subtitle || content.subtitle || '',
    };
  });
  const final = {
    id: 'system-final',
    type: 'final',
    media: 'none',
    badge: 'star',
    title: 'История пройдена',
    text: 'Добавьте экспонат в свою коллекцию, чтобы вернуться к нему позже.',
  };
  return {artifactId: artifact.id || '', museumId: artifact.museum_id || '', screens: [cover, ...screens, final]};
}

function museumReturnUrl() {
  try {
    const stored = window.sessionStorage.getItem(PUBLIC_STORY_RETURN_URL_KEY);
    if (/^\/m\d+(?:\/r\d+)?$/.test(stored || '')) return stored;
  } catch {
    // Fall through to the list when storage is unavailable.
  }
  return '/museums';
}

function rememberCollectedArtifact(artifactId) {
  if (!artifactId) return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(PUBLIC_COLLECTED_ARTIFACTS_KEY) || '[]');
    const ids = new Set(Array.isArray(stored) ? stored : []);
    ids.add(artifactId);
    window.localStorage.setItem(PUBLIC_COLLECTED_ARTIFACTS_KEY, JSON.stringify([...ids]));
  } catch {
    // Database persistence has already succeeded; local UI progress is optional.
  }
}

async function collectPublicArtifact(code, artifactId) {
  const visitorId = analyticsVisitorKey();
  const response = await fetch(`${apiBase}/public/artifacts/${encodeURIComponent(code)}/collect`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({visitor_id: visitorId}),
  });
  if (!response.ok) throw new Error('collect_failed');
  const routeId = new URLSearchParams(window.location.search).get('route_id');
  if (/^rte_[a-f0-9]{32}$/.test(routeId || '')) {
    const progress = await fetch(`/api/route/api/v1/public/routes/${encodeURIComponent(routeId)}/progress`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitor_key:visitorId,session_id:analyticsEvents.sessionId(),artifact_id:artifactId})});
    if (!progress.ok) throw new Error('Экспонат сохранён, но прогресс маршрута не обновлён. Повторите попытку.');
  }
  analyticsEvents.trackOnce(`collect:${artifactId}`, 'artifact_collected', {public_code: code, artifact_id: artifactId});
  rememberCollectedArtifact(artifactId);
  window.dispatchEvent(new CustomEvent('viralabs:artifact-collected', {
    detail: {artifactId, publicCode: code, visitorId},
  }));
}

function LoadingOrError({children}) {
  return <main className="public-artifact-status" role="status">{children}</main>;
}

export function PublicArtifactStory({code}) {
  const query = new URLSearchParams(window.location.search);
  const source = query.get('source') === 'qr' ? 'qr' : /^rte_[a-f0-9]{32}$/.test(query.get('route_id') || '') ? 'route' : 'direct';
  const [status, setStatus] = useState('loading');
  const [publication, setPublication] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/public/artifacts/${encodeURIComponent(code)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 || response.status === 410 ? 'not_found' : 'load_failed');
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) {
          setPublication(normalizePublication(payload));
          setStatus('ready');
        }
      })
      .catch((error) => {
        if (!cancelled) setStatus(error.message);
      });
    return () => { cancelled = true; };
  }, [code]);

  const publicStory = useMemo(() => publication, [publication]);

  useEffect(() => {
    if (!publicStory?.artifactId) return;
    analyticsEvents.trackOnce(`visit:${publicStory.museumId || code}`, 'visit_start', {
      public_code: code,
      artifact_id: publicStory.artifactId,
      source,
    });
    if (source === 'qr') analyticsEvents.trackOnce(`scan:${code}`, 'scan', {public_code: code, artifact_id: publicStory.artifactId, source});
  }, [code, publicStory, source]);

  if (status === 'loading') return <LoadingOrError>Загружаем экспонат…</LoadingOrError>;
  if (status !== 'ready' || !publicStory?.screens.length) return <LoadingOrError>Экспонат недоступен или был архивирован.</LoadingOrError>;

  return (
    <>
    <Suspense fallback={<LoadingOrError>Открываем историю…</LoadingOrError>}>
      <StoryExperienceView
        key={code}
        publicStory={publicStory}
        feedback={<StoryFeedback publicCode={code} />}
        exitLabel={/^rte_[a-f0-9]{32}$/.test(query.get('route_id') || '') ? 'Вернуться к маршруту' : 'Вернуться к музею'}
        onTrackEvent={(type, data) => analyticsEvents.track(type, {public_code: code, artifact_id: publicStory.artifactId, source, ...data})}
        onTrackEventOnce={(key, type, data) => analyticsEvents.trackOnce(`${code}:${key}`, type, {public_code: code, artifact_id: publicStory.artifactId, source, ...data})}
        onCollect={() => collectPublicArtifact(code, publicStory.artifactId)}
        onExit={() => {const routeId = new URLSearchParams(window.location.search).get('route_id');window.location.assign(/^rte_[a-f0-9]{32}$/.test(routeId || '') ? `/routes/${routeId}` : museumReturnUrl());}}
      />
    </Suspense>
    </>
  );
}
