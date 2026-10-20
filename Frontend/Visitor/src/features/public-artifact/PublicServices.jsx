import React, {useEffect, useState} from 'react';
import {analyticsEvents, analyticsVisitorKey} from '../../app/analytics-events.js';
import {appConfig} from '../../app/config.js';
import './public-services.css';

const routeBase = '/api/route/api/v1';

export function PublicRoute({routeId}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const routeResponse = await fetch(`${routeBase}/public/routes/${encodeURIComponent(routeId)}`);
        if (!routeResponse.ok) throw new Error('Маршрут недоступен.');
        const {route} = await routeResponse.json();
        const artifactsResponse = await fetch(`${appConfig.artifactsApiUrl}/public/museums/${encodeURIComponent(route.museum_id)}/artifacts`);
        if (!artifactsResponse.ok) throw new Error('Не удалось загрузить экспонаты.');
        const catalog = await artifactsResponse.json();
        if (!cancelled) setData({route, artifacts: route.artifact_ids.map((id) => catalog.artifacts.find((artifact) => artifact.id === id)).filter(Boolean)});
      } catch (reason) { if (!cancelled) setError(reason.message); }
    }
    void load();
    return () => { cancelled = true; };
  }, [routeId]);
  const openArtifact = async (artifact) => {
    try {
      setError('');
      const response = await fetch(`${routeBase}/public/routes/${encodeURIComponent(routeId)}/start`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitor_key:analyticsVisitorKey(),session_id:analyticsEvents.sessionId(),source:new URLSearchParams(window.location.search).get('source') === 'qr' ? 'qr' : 'direct'})});
      if (!response.ok) {const reason = await response.json().catch(() => ({}));throw new Error(reason.error?.code === 'qr_start_required' ? 'Начните маршрут по QR-коду музея.' : 'Не удалось начать маршрут. Повторите попытку.');}
      window.location.assign(`/exhibits/${encodeURIComponent(artifact.public_code)}?route_id=${encodeURIComponent(routeId)}`);
    } catch (reason) {setError(reason.message);}
  };
  return <main className="public-service-page"><a href="/">Музеи</a><h1>{data?.route.title || 'Маршрут'}</h1>{error ? <p role="alert">{error}</p> : null}{!data && !error ? <p role="status">Загружаем маршрут…</p> : null}{data ? <><p>{data.route.description}</p><p>{data.route.duration}</p><ol>{data.artifacts.map((artifact) => <li key={artifact.id}><button type="button" onClick={() => openArtifact(artifact)}>{artifact.title}</button></li>)}</ol></> : null}</main>;
}

export {StoryFeedback} from './StoryFeedback.jsx';

export function MuseumRoutes({museumId}) {
  const [routes,setRoutes] = useState([]);
  const [error,setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setRoutes([]);setError(false);
    fetch(`${routeBase}/public/museums/${encodeURIComponent(museumId)}/routes`).then(async (response) => {
      if (!response.ok) throw new Error('routes_unavailable');
      return response.json();
    }).then((payload) => {if (!cancelled) setRoutes(payload.routes || []);}).catch(() => {if (!cancelled) setError(true);});
    return () => {cancelled = true;};
  },[museumId]);
  if (error) return <p role="status">Маршруты временно недоступны. Экспонаты можно смотреть отдельно.</p>;
  if (!routes.length) return null;
  return <section aria-label="Маршруты музея"><h2>Маршруты</h2><ul>{routes.map((route) => <li key={route.id}><a href={`/routes/${route.id}`}>{route.title}</a> · {route.artifacts_count} экспонатов</li>)}</ul></section>;
}

