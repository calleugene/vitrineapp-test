import React, {useEffect, useRef, useState} from 'react';
import {normalizePublication} from './publication-screens.js';
import {StoryExperienceView} from '../story/views.jsx';
import {stripHtmlTags} from '../story/html.js';
import {appConfig} from '../../app/config.js';
import '../story/story.css';
import './embed-artifact.css';
import brandMark from '../../../../shared/brand-mark.svg';

function EmbedPlayer({story, code}) {
  const counted = useRef(false);
  const preview = new URLSearchParams(window.location.search).get('preview') === '1';
  useEffect(() => {
    if (preview || counted.current || window.parent === window) return;
    counted.current = true;
    void fetch(`${appConfig.artifactsApiUrl}/public/artifacts/${encodeURIComponent(code)}/embed-opens`, {
      method:'POST', credentials:'omit', referrerPolicy:'no-referrer', keepalive:true,
    }).catch(() => {});
  }, [code, preview]);
  return <StoryExperienceView publicStory={story} embedded exitLabel="Открыть экспонат отдельно" onExit={() => window.open(`/exhibits/${encodeURIComponent(code)}`, '_blank', 'noopener,noreferrer')} />;
}

export function EmbedArtifact({code}) {
  const [result, setResult] = useState({code:'', state:'loading'});
  const [attempt, setAttempt] = useState(0);
  const current = result.code === code ? result : {state:'loading'};
  useEffect(() => {
    const controller = new AbortController();
    if (!code) return undefined;
    fetch(`${appConfig.artifactsApiUrl}/public/artifacts/${encodeURIComponent(code)}`, {
      signal: controller.signal, credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer',
    }).then(async (response) => {
      if (!response.ok) throw new Error([404,410].includes(response.status) ? 'unavailable' : 'error');
      const story = normalizePublication(await response.json());
      if (!story.artifactId || story.screens.length < 3) throw new Error('unavailable');
      story.screens = story.screens.map((screen) => ({...screen, title:stripHtmlTags(screen.title), text:screen.type === 'final' ? 'Спасибо за интерес к экспонату.' : stripHtmlTags(screen.text), note:stripHtmlTags(screen.note)}));
      if (!controller.signal.aborted) setResult({code, state:'ready', story});
    }).catch((error) => {
      if (!controller.signal.aborted) setResult({code, state:error.message === 'unavailable' ? 'unavailable' : 'error'});
    });
    return () => controller.abort();
  }, [code, attempt]);
  return <div className="embed-artifact">
    {current.state === 'ready' ? <EmbedPlayer key={code} story={current.story} code={code} /> : <main className="embed-status" role="status">
      {!code || current.state === 'unavailable' ? 'Экспонат недоступен.' : current.state === 'error' ? <>Не удалось загрузить экспонат. <button type="button" onClick={() => setAttempt(attempt + 1)}>Повторить</button></> : 'Загружаем экспонат…'}
    </main>}
    <footer className="embed-brand"><span className="embed-brand-name"><img src={brandMark} width="16" height="20" alt="" />Витрина</span><a href={window.location.origin + '/'} target="_blank" rel="noopener noreferrer">Перейти на сайт Витрины <span aria-hidden="true">↗</span></a></footer>
  </div>;
}
