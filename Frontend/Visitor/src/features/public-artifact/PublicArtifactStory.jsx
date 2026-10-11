import React, {Suspense, lazy, useEffect, useMemo, useState} from 'react';
import './public-artifact-story.css';

const apiBase = (import.meta.env.VITE_ARTIFACTS_API_URL || window.__VIRALABS_CONFIG__?.artifactsApiUrl || 'http://127.0.0.1:8081/api/v1').replace(/\/$/, '');
const StoryExperienceView = lazy(() => import('../story/views.jsx').then((module) => ({default: module.StoryExperienceView})));
const PUBLIC_VISITOR_KEY = 'viralabs.public.visitor.id';
const PUBLIC_STORY_RETURN_URL_KEY = 'viralabs.public.story.return-url';
const PUBLIC_COLLECTED_ARTIFACTS_KEY = 'viralabs.public.collected-artifacts';

function publicVisitorId() {
  try {
    const stored = window.localStorage.getItem(PUBLIC_VISITOR_KEY);
    if (stored) return stored;
    const generated = window.crypto?.randomUUID?.() || `public-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(PUBLIC_VISITOR_KEY, generated);
    return generated;
  } catch {
    return `public-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

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
  return {artifactId: artifact.id || '', screens: [cover, ...screens, final]};
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
  const visitorId = publicVisitorId();
  const response = await fetch(`${apiBase}/public/artifacts/${encodeURIComponent(code)}/collect`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({visitor_id: visitorId}),
  });
  if (!response.ok) throw new Error('collect_failed');
  rememberCollectedArtifact(artifactId);
  window.dispatchEvent(new CustomEvent('viralabs:artifact-collected', {
    detail: {artifactId, publicCode: code, visitorId},
  }));
}

function LoadingOrError({children}) {
  return <main className="public-artifact-status" role="status">{children}</main>;
}

export function PublicArtifactStory({code}) {
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

  if (status === 'loading') return <LoadingOrError>Загружаем экспонат…</LoadingOrError>;
  if (status !== 'ready' || !publicStory?.screens.length) return <LoadingOrError>Экспонат недоступен или был архивирован.</LoadingOrError>;

  return (
    <Suspense fallback={<LoadingOrError>Открываем историю…</LoadingOrError>}>
      <StoryExperienceView
        publicStory={publicStory}
        onCollect={() => collectPublicArtifact(code, publicStory.artifactId)}
        onExit={() => window.location.assign(museumReturnUrl())}
      />
    </Suspense>
  );
}
