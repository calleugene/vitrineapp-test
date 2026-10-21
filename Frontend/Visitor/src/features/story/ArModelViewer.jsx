import {useEffect, useRef, useState} from 'react';

/* Mounts the <model-viewer> web component declared in index.html. */
export function ArModelViewer({modelUrl, onInteraction}) {
  const mvRef = useRef(null);
  const onInteractionRef = useRef(onInteraction);
  const [status, setStatus] = useState('loading');

  useEffect(() => { onInteractionRef.current = onInteraction; }, [onInteraction]);

  useEffect(() => {
    const container = mvRef.current;
    if (!container || !modelUrl) return;
    container.innerHTML = '';

    const mv = document.createElement('model-viewer');
    mv.setAttribute('src', modelUrl);
    mv.setAttribute('ar', '');
    mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('alt', 'Интерактивная 3D-модель экспоната');
    mv.setAttribute('auto-rotate', '');
    mv.setAttribute('shadow-intensity', '0.8');
    mv.setAttribute('exposure', '0.9');
    mv.setAttribute('tone-mapping', 'commerce');
    mv.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;background:transparent;--poster-color:transparent;';

    const handleInteract = () => onInteractionRef.current?.();
    const handleLoad = () => setStatus('ready');
    const handleError = () => setStatus('error');
    mv.addEventListener('load', handleLoad);
    mv.addEventListener('error', handleError);
    mv.addEventListener('camera-change', (event) => {
      if (event.detail?.source === 'user-interaction') handleInteract();
    });
    mv.addEventListener('touchstart', handleInteract, {passive: true});

    container.appendChild(mv);
    const timer = window.setTimeout(() => {if (!customElements.get('model-viewer')) setStatus('error');},15000);
    return () => { window.clearTimeout(timer); container.innerHTML = ''; };
  }, [modelUrl]);

  return (
    <div className="story-media story-media--3d">
      <div ref={mvRef} className="story-3d-inner" />
      {status !== 'ready' && <p className="story-model-status" role="status">{status === 'error' ? 'Не удалось загрузить 3D-модель. Проверьте подключение к интернету.' : 'Загружаем 3D-модель…'}</p>}
    </div>
  );
}
