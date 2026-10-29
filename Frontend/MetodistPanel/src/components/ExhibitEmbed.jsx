import {useEffect, useId, useState} from 'react';
import {Button, Card} from '@gravity-ui/uikit';
import {artifactsApi} from '../api';
import {embedDetails} from './embed-utils.js';
import './exhibit-embed.css';

export function ExhibitEmbed({publicUrl, artifactId}) {
  const id = useId();
  const [height, setHeight] = useState(640);
  const [width, setWidth] = useState('wide');
  const [copy, setCopy] = useState({html:'', state:''});
  const [stats, setStats] = useState({artifactId:'', state:'loading'});
  const details = embedDetails(publicUrl, height);
  useEffect(() => {
    if (!publicUrl || !artifactId) return undefined;
    let cancelled = false;
    artifactsApi.getEmbedOpens(artifactId).then((data) => {
      if (!cancelled) setStats({artifactId, state:'ready', ...data});
    }).catch(() => {if (!cancelled) setStats({artifactId, state:'error'});});
    return () => {cancelled = true;};
  }, [artifactId, publicUrl]);
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(details.html);
      setCopy({html:details.html, state:'success'});
    } catch {setCopy({html:details.html, state:'error'});}
  };
  const state = copy.html === details?.html ? copy.state : '';
  return <Card className="exhibit-embed" view="filled">
    <h2>Встроить на сайт</h2>
    {!details ? <p>Сначала опубликуйте экспонат. После подтверждённой публикации здесь появится код встраивания.</p> : <>
      <p>История экспоната внутри вашего сайта — без переноса контента. Показывается последняя опубликованная версия; изменения черновика появятся после публикации.</p>
      <div className="exhibit-embed-settings"><label htmlFor={`${id}-height`}>Высота, px <input id={`${id}-height`} type="number" min="320" max="1200" value={height} onChange={(event) => setHeight(event.target.value)} onBlur={() => setHeight(details.height)} /></label><label htmlFor={`${id}-width`}>Предпросмотр <select id={`${id}-width`} value={width} onChange={(event) => setWidth(event.target.value)}><option value="wide">По ширине блока</option><option value="narrow">Узкий — 320 px</option></select></label></div>
      <div className={`exhibit-embed-preview ${width === 'narrow' ? 'is-narrow' : ''}`}><iframe key={details.src} src={`${details.src}?preview=1`} title="Предпросмотр опубликованного экспоната" height={details.height} width="100%" loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" /></div>
      <label htmlFor={`${id}-code`}>HTML-код для вашего сайта</label>
      <textarea id={`${id}-code`} rows={5} readOnly value={details.html} onFocus={(event) => event.currentTarget.select()} spellCheck={false} />
      <div className="exhibit-embed-actions"><Button view="outlined" onClick={copyCode}>Скопировать код</Button><Button component="a" href={details.standalone} target="_blank" rel="noopener noreferrer" view="flat">Открыть экспонат отдельно</Button></div>
      <p role="status">{state === 'success' ? 'Код скопирован.' : state === 'error' ? 'Не удалось скопировать. Выделите код в поле и скопируйте вручную.' : 'Вставьте код в блок «Произвольный HTML» WordPress или в HTML страницы. Сайт должен разрешать iframe.'}</p>
      <p className="publication-note">Архивирование или удаление сделает экспонат недоступным во вставке. Внизу просмотра есть небольшое лого и ссылка на сайт Витрины. Отзывов и отслеживания действий нет.</p>
      <p className="publication-note">{stats.artifactId !== artifactId ? 'Загружаем счётчик…' : stats.state === 'error' ? 'Счётчик открытий временно недоступен.' : !stats.enabled ? 'Счётчик открытий пока отключён.' : `Открытия на внешних сайтах: ${stats.opens}. Повторные открытия учитываются; это не число уникальных посетителей.`}</p>
    </>}
  </Card>;
}
