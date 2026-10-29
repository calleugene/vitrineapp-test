import {useEffect, useId, useState} from 'react';
import {Button, Card, Icon} from '@gravity-ui/uikit';
import {ArrowDownToLine, ArrowUpRight, CircleCheck, CircleExclamation, CircleInfo, Copy, Picture, QrCode} from '@gravity-ui/icons';
import './publication.css';

function qrImageResource(image) {
  if (image instanceof Blob && image.size > 0 && image.type.toLowerCase().startsWith('image/png')) {
    const url = URL.createObjectURL(image);
    return {url, release: () => URL.revokeObjectURL(url)};
  }
  if (typeof image === 'string' && image.startsWith('data:image/png;base64,')) return {url:image,release:() => {}};
  throw new Error('invalid_qr_image');
}

export function PublicationIdentity({title, description, coverUrl, meta, status, statusTheme = 'neutral'}) {
  return <Card className="publication-identity" view="filled">
    <div className="publication-cover">{coverUrl ? <img src={coverUrl} alt="" /> : <Icon data={Picture} size={28} />}</div>
    <div className="publication-identity-copy"><h2>{title || 'Без названия'}</h2>{description && <p>{description}</p>}{meta && <small>{meta}</small>}</div>
    {status && <span className={`publication-status ${statusTheme === 'success' ? 'is-published' : ''}`}><Icon data={statusTheme === 'success' ? CircleCheck : CircleInfo} size={16} />{status}</span>}
  </Card>;
}

export function PublicationChecks({items}) {
  return <ul className="publication-checks">{items.map(({label, description, ready}) => <li key={label} className={ready ? 'is-ready' : 'is-incomplete'}><Icon data={ready ? CircleCheck : CircleExclamation} size={20} /><div><strong>{label}</strong>{description && <p>{description}</p>}</div></li>)}</ul>;
}

export function PublicationDelivery({publicUrl = '', loadQr, fileName = 'vitrina-qr.png', emptyMessage = 'Ссылка и QR-код появятся после публикации.', linkNote = '',}) {
  const inputId = useId();
  const [qr, setQr] = useState({url:'',state:'loading'});
  const [attempt, setAttempt] = useState(0);
  const [copyResult, setCopyResult] = useState({url:'',state:''});
  const copyState = copyResult.url === publicUrl ? copyResult.state : '';
  const currentQr = qr.source === publicUrl ? qr : {url:'',state:'loading'};
  useEffect(() => {
    if (!publicUrl || !loadQr) return undefined;
    let cancelled = false;
    let resource;
    setQr({url:'',state:'loading',source:publicUrl});
    Promise.resolve().then(loadQr).then((result) => {
      if (cancelled) return;
      resource = qrImageResource(result);
      setQr({url:resource.url,state:'ready',source:publicUrl});
    }).catch(() => {if (!cancelled) setQr({url:'',state:'error',source:publicUrl});});
    return () => {cancelled = true; resource?.release();};
  }, [publicUrl, loadQr, attempt]);
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(publicUrl);
      setCopyResult({url:publicUrl,state:'success'});
    } catch {setCopyResult({url:publicUrl,state:'error'});}
  };
  if (!publicUrl) return <Card className="publication-empty" view="filled"><div className="publication-empty-icon"><Icon data={QrCode} size={42} /></div><h2>Ссылка и QR-код</h2><p>{emptyMessage}</p></Card>;
  return <Card className="publication-delivery" view="filled">
    <div className="publication-link-block"><h2>Публичная ссылка</h2><p>Скопируйте ссылку или откройте просмотр, чтобы проверить историю на телефоне.</p><label className="publication-input-label" htmlFor={inputId}>Ссылка для посетителей</label><div className="publication-link-row"><input id={inputId} value={publicUrl} readOnly onFocus={(event) => event.currentTarget.select()} /><Button size="l" view="outlined" onClick={copy}><Icon data={Copy} size={16} />{copyState === 'success' ? 'Скопировано' : 'Скопировать'}</Button></div><p className={`publication-copy-status ${copyState === 'error' ? 'is-error' : ''}`} role="status">{copyState === 'success' ? 'Ссылка скопирована.' : copyState === 'error' ? 'Не удалось скопировать. Выделите ссылку в поле и скопируйте вручную.' : '\u00a0'}</p><Button component="a" href={publicUrl} target="_blank" rel="noopener noreferrer" view="outlined" size="l"><Icon data={ArrowUpRight} size={16} />Открыть просмотр</Button>{linkNote && <p className="publication-note"><Icon data={CircleInfo} size={16} />{linkNote}</p>}</div>
    <div className="publication-qr-block"><h2>QR-код для посетителей</h2><div className="publication-qr-frame" aria-busy={currentQr.state === 'loading'}>{currentQr.state === 'ready' ? <img src={currentQr.url} alt="QR-код для открытия опубликованной истории" width={240} height={240} onError={() => setQr({url:'',state:'error',source:publicUrl})} /> : <div className="publication-qr-placeholder" role="status"><Icon data={QrCode} size={44} /><span>{currentQr.state === 'error' ? 'Не удалось загрузить QR-код' : 'Готовим QR-код…'}</span>{currentQr.state === 'error' && <Button view="outlined" size="l" onClick={() => setAttempt((value) => value + 1)}>Попробовать снова</Button>}</div>}</div>{currentQr.state === 'ready' ? <Button component="a" href={currentQr.url} download={fileName} view="action" size="l" width="max"><Icon data={ArrowDownToLine} size={16} />Скачать PNG</Button> : <Button view="action" size="l" width="max" disabled>Скачать PNG</Button>}<p>Разместите код рядом с экспонатом или у начала маршрута. Проверьте его камерой телефона.</p></div>
  </Card>;
}
