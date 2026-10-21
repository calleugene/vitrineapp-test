import React, {useEffect, useRef, useState} from 'react';
import {Button, Card, Dialog, DropdownMenu, Icon, TextArea, TextInput} from '@gravity-ui/uikit';
import {ArrowDown, ArrowUp, Copy, EllipsisVertical, Plus, TrashBin, Picture, CircleCheck, Cube} from '@gravity-ui/icons';
import {artifactsApi} from '../../api';
import {SCREEN_TYPES, contentError, screenExtra, screenValues} from './screen-content.js';
import './content-workspace.css';

const TYPE_ICONS = {text: Picture, model: Cube, quiz: CircleCheck};

export function ContentWorkspace({flow, onNavigate}) {
  const [editing, setEditing] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const pending = flow.loading || busy;
  useEffect(() => {
    const warn = (event) => {if (dirty || busy) {event.preventDefault(); event.returnValue = '';}};
    const guardSidebar = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('.sidebar .nav-item, .sidebar-brand-footer button, .museum-switcher')) return;
      if (busy || flow.loading || (dirty && !window.confirm('В экране есть несохранённые изменения. Продолжить без сохранения?'))) {event.preventDefault();event.stopPropagation();}
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click',guardSidebar,true);
    return () => {window.removeEventListener('beforeunload', warn);document.removeEventListener('click',guardSidebar,true);};
  }, [dirty, busy, flow.loading]);
  const canLeave = () => !pending && (!dirty || window.confirm('В экране есть несохранённые изменения. Продолжить без сохранения?'));
  const select = (screen) => {if (editing?.id === screen.id || !canLeave()) return; setDirty(false); setEditing(screen);};
  const navigate = (view) => {if (canLeave()) {setDirty(false); if (flow.dirty && view !== 'artifacts') flow.saveAndGo(view); else onNavigate(view, {artifactId: flow.artifact?.id});}};
  const add = async (type) => {
    if (pending) return;
    const screen = await flow.addTextScreen(type);
    if (screen) {setAdding(false); setDirty(false); setEditing(screen);}
  };
  const reorder = (from, to) => {
    if (pending || from < 0 || from === to || to < 0 || to >= flow.screens.length) return;
    const items = [...flow.screens]; const [item] = items.splice(from, 1); items.splice(to, 0, item); flow.reorder(items);
  };
  const remove = async (screen) => {
    if (!canLeave() || !window.confirm(`Удалить экран «${screen.title}»?`)) return;
    await flow.removeScreen(screen.id);
    if (editing?.id === screen.id) {setEditing(null); setDirty(false);}
  };
  return <section className="page server-artifact-flow content-workspace">
    <div className="content-page-heading"><div><p className="content-eyebrow">{flow.artifact?.title || 'Новый экспонат'}</p><h1>Контент экспоната</h1><p>Соберите историю, которую посетители будут листать сверху вниз.</p></div><Button view="outlined" size="l" disabled={pending} onClick={() => navigate('artifacts')}>К экспонатам</Button></div>
    <nav className="server-flow-tabs" aria-label="Разделы экспоната">{[['artifact-basic', 'Основная информация'], ['artifact-content', 'Контент'], ['artifact-publish', 'Публикация']].map(([view, title]) => <button type="button" key={view} className={view === 'artifact-content' ? 'is-active' : ''} aria-current={view === 'artifact-content' ? 'page' : undefined} disabled={pending} onClick={() => {if (view !== 'artifact-content') navigate(view);}}>{title}</button>)}</nav>
    <div className="content-workspace-grid">
      <Card className="panel content-outline" view="filled"><div className="content-outline-heading"><h2>Экраны <span>{flow.screens.length}</span></h2><Button view="action" size="l" aria-label="Добавить экран" disabled={pending} onClick={() => {if (canLeave()) {setDirty(false); setEditing(null); setAdding(true);}}}><Icon data={Plus} size={18} /></Button></div><p className="content-muted">Порядок показа посетителям</p>
        {flow.screens.length ? <ol className="content-screen-list">{flow.screens.map((screen, index) => {
          const value = screenValues(screen);
          const items = [{text: 'Выше', icon: <ArrowUp />, disabled: index === 0, action: () => reorder(index, index - 1)}, {text: 'Ниже', icon: <ArrowDown />, disabled: index === flow.screens.length - 1, action: () => reorder(index, index + 1)}, {text: 'Дублировать', icon: <Copy />, action: () => flow.duplicateScreen(screen)}, {text: 'Удалить', icon: <TrashBin />, action: () => remove(screen)}];
          return <li key={screen.id} className={editing?.id === screen.id ? 'is-selected' : ''} draggable={!pending} onDragStart={(event) => event.dataTransfer.setData('text/plain', screen.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {event.preventDefault();reorder(flow.screens.findIndex((item) => item.id === event.dataTransfer.getData('text/plain')), index);}}>
            <button type="button" className="content-screen-select" disabled={pending} aria-current={editing?.id === screen.id ? 'true' : undefined} onClick={() => select(screen)}><span className="content-screen-thumb">{value.imageURL ? <img src={value.imageURL} alt="" /> : <Icon data={TYPE_ICONS[screen.type] || Picture} size={20} />}</span><span><strong>{screen.title || 'Без названия'}</strong><small>{index + 1} · {SCREEN_TYPES[screen.type]?.label || screen.type}</small></span></button>
            <DropdownMenu items={items} disabled={pending} popupProps={{placement:'bottom-end'}} renderSwitcher={(props) => <Button {...props} view="flat-secondary" size="l" disabled={pending} aria-label={`Действия с экраном ${index + 1}`}><Icon data={EllipsisVertical} size={18} /></Button>} />
          </li>;
        })}</ol> : <div className="content-empty"><Icon data={Picture} size={28} /><strong>История начинается здесь</strong><p>Добавьте текст, модель или вопрос.</p></div>}
        <Button view="outlined" size="l" width="max" disabled={pending} onClick={() => {if (canLeave()) {setDirty(false);setEditing(null);setAdding(true);}}}><Icon data={Plus} size={16} />Добавить экран</Button>
      </Card>
      {editing ? <ScreenEditor key={editing.id} screen={editing} flow={flow} onDirty={setDirty} onBusy={setBusy} onClose={() => {if (canLeave()) {setDirty(false);setEditing(null);}}} /> : <Card className="panel content-editor-empty" view="filled"><Icon data={Picture} size={36} /><h2>{flow.screens.length ? 'Выберите экран' : 'Создайте первый экран'}</h2><p>Редактируйте контент и сразу проверяйте, как его увидит посетитель.</p><Button view="action" size="l" disabled={pending} onClick={() => setAdding(true)}>Добавить экран</Button></Card>}
    </div>
    {(flow.error || flow.notice) && <p className={`server-flow-message${flow.error ? ' is-error' : ''}`} role={flow.error ? 'alert' : 'status'}>{flow.error || flow.notice}</p>}
    <footer className="content-page-footer"><span className="content-muted" role="status">{pending ? 'Сохраняем…' : dirty ? 'Есть несохранённые изменения экрана' : 'Экраны сохраняются в черновик. Публикация — отдельным шагом.'}</span><Button view="action" size="l" disabled={pending || !flow.screens.length} onClick={() => navigate('artifact-publish')}>К публикации</Button></footer>
    <Dialog open={adding} onClose={() => {if (!pending) setAdding(false);}} size="s" className="content-type-dialog"><Dialog.Header caption="Добавить экран" /><Dialog.Body><p className="content-type-intro">Выберите формат истории</p><div className="content-type-options">{Object.entries(SCREEN_TYPES).map(([type, info]) => <button type="button" disabled={pending} key={type} onClick={() => add(type)}><span className="content-type-icon"><Icon data={TYPE_ICONS[type]} size={24} /></span><span><strong>{info.label}</strong><small>{info.hint}</small></span><span aria-hidden="true">›</span></button>)}</div>{flow.error && <p role="alert" className="content-error">{flow.error}</p>}{pending && <p role="status">Создаём экран…</p>}</Dialog.Body></Dialog>
  </section>;
}

function ScreenEditor({screen, flow, onDirty, onBusy, onClose}) {
  const [values, setValues] = useState(() => screenValues(screen));
  const original = useRef(JSON.stringify(values));
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const input = useRef(null);
  const modelInput = useRef(null);
  const type = screen.type;
  const disabled = pending || flow.loading;
  const change = (patch) => {const next = {...values, ...patch};setValues(next);onDirty(JSON.stringify(next) !== original.current);setSaved(false);setError('');};
  const run = async (action) => {
    if (pendingRef.current) return;
    pendingRef.current = true;setPending(true);onBusy(true);setError('');
    try {await action();} catch {setError('Не удалось выполнить действие. Введённые данные сохранены в форме. Попробуйте ещё раз.');}
    finally {pendingRef.current = false;setPending(false);onBusy(false);}
  };
  const save = () => {
    const validation = contentError(type, values);
    if (validation) {setError(validation);return;}
    void run(async () => {
      const ok = await flow.updateScreen(screen.id, values.title, values.body, values.imageURL, screenExtra(type, values));
      if (ok) {original.current = JSON.stringify(values);onDirty(false);setSaved(true);}
    });
  };
  const upload = (file, model = false) => {
    if (!file) return;
    if (model && (!file.name.toLowerCase().endsWith('.glb') || file.size > 50 * 1024 * 1024)) {setError('Выберите GLB до 50 МБ со встроенными текстурами.');return;}
    void run(async () => {
      if (model) {
        try {const response = await artifactsApi.uploadScreenModel(flow.artifact.id, screen.id, file);change({modelURL:response.model_url});}
        catch (cause) {setError(cause.code === 'invalid_glb' ? 'Нужен корректный GLB 2.0 со встроенными текстурами и ресурсами.' : 'Не удалось загрузить 3D-модель. Попробуйте ещё раз.');}
      } else {const url = await flow.uploadScreenImage(screen.id, file);if (url) change({imageURL:url});}
    });
  };
  const updateOption = (index, value) => {const options = [...values.options];options[index] = value;change({options});};
  return <div className="content-editor-layout"><Card className="panel content-editor" view="filled"><div className="content-editor-heading"><div><span className="content-kind"><Icon data={TYPE_ICONS[type] || Picture} size={16} />{SCREEN_TYPES[type]?.label}</span><h2>{type === 'quiz' ? 'Вопрос посетителю' : type === 'model' ? 'Экспонат в объёме' : 'Текстовый экран'}</h2></div><Button view="flat-secondary" size="l" disabled={disabled} onClick={onClose}>Закрыть</Button></div>
    <label className="content-field">{type === 'quiz' ? 'Вопрос' : 'Заголовок'}<TextInput size="l" value={values.title} disabled={disabled} controlProps={{'aria-label':type === 'quiz' ? 'Вопрос' : 'Заголовок',maxLength:180}} onUpdate={(title) => change({title})} /><small>{values.title.length}/180</small></label>
    <label className="content-field">{type === 'quiz' ? 'Описание · необязательно' : 'Описание'}<TextArea size="l" rows={4} value={values.body} disabled={disabled} controlProps={{'aria-label':'Описание',maxLength:5000}} onUpdate={(body) => change({body})} /><small>{values.body.length}/5000</small></label>
    {type === 'quiz' && <fieldset className="content-quiz-fields" disabled={disabled}><legend>Варианты ответа</legend>{values.legacyQuestions.length > 0 && <p className="content-muted">Редактируется первый вопрос старого теста. Остальные {values.legacyQuestions.length} вопроса сохранятся и будут показаны посетителю.</p>}<p className="content-muted">Отметьте один правильный ответ</p>{values.options.map((option, index) => <div className="content-answer-row" key={index}><input type="radio" name={`correct-${screen.id}`} aria-label={`Правильный ответ: вариант ${index + 1}`} checked={values.correct === index} onChange={() => change({correct:index})} /><TextInput size="l" value={option} controlProps={{'aria-label':`Вариант ${index + 1}`,maxLength:300}} placeholder={`Вариант ${index + 1}`} onUpdate={(value) => updateOption(index, value)} /><Button view="flat-secondary" size="l" aria-label={`Удалить вариант ${index + 1}`} disabled={disabled || values.options.length <= 2} onClick={() => change({options:values.options.filter((_, i) => i !== index),correct:values.correct === index ? -1 : values.correct > index ? values.correct - 1 : values.correct})}><Icon data={TrashBin} size={16} /></Button></div>)}<Button view="outlined" size="l" disabled={disabled || values.options.length >= 6} onClick={() => change({options:[...values.options, '']})}><Icon data={Plus} size={16} />Добавить вариант</Button><label className="content-field">Пояснение после ответа<TextArea size="l" rows={3} value={values.explanation} controlProps={{'aria-label':'Пояснение после ответа',maxLength:2000}} onUpdate={(explanation) => change({explanation})} /></label></fieldset>}
    {type === 'model' ? <div className="content-asset-field"><strong>Файл 3D-модели</strong><p className="content-muted">GLB до 50 МБ. Текстуры и ресурсы должны быть внутри файла.</p><input ref={modelInput} type="file" hidden accept=".glb,model/gltf-binary" disabled={disabled} onChange={(event) => {upload(event.target.files?.[0], true);event.currentTarget.value = '';}} /><div className="content-model-upload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {event.preventDefault();if (!disabled) upload(event.dataTransfer.files?.[0], true);}}><Icon data={Cube} size={32} /><strong>{values.modelURL ? 'Модель добавлена' : 'Добавьте 3D-модель'}</strong><Button view="outlined" size="l" disabled={disabled} loading={pending} onClick={() => modelInput.current?.click()}>{values.modelURL ? 'Заменить GLB' : 'Выбрать GLB'}</Button><small>Или перетащите файл сюда</small></div>{values.modelURL && <Button view="flat-danger" size="l" disabled={disabled} onClick={() => change({modelURL:''})}>Убрать модель</Button>}</div> : <div className="content-asset-field"><strong>Фотография · необязательно</strong><p className="content-muted">JPG, PNG или WebP · до 10 МБ</p><input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={(event) => {upload(event.target.files?.[0]);event.currentTarget.value = '';}} /><button type="button" className="content-photo-picker" disabled={disabled} onClick={() => input.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {event.preventDefault();if (!disabled) upload(event.dataTransfer.files?.[0]);}}>{values.imageURL ? <img src={values.imageURL} alt="Фотография экрана" /> : <><Icon data={Picture} size={28} /><span>Выберите или перетащите фотографию</span></>}</button><div className="content-asset-actions"><Button view="outlined" size="l" disabled={disabled} loading={pending} onClick={() => input.current?.click()}>{values.imageURL ? 'Заменить фото' : 'Загрузить фото'}</Button>{values.imageURL && <Button view="flat-danger" size="l" disabled={disabled} onClick={() => change({imageURL:''})}>Убрать фото</Button>}</div></div>}
    {error && <p role="alert" className="content-error">{error}</p>}{saved && <p role="status" className="content-saved">Экран сохранён в черновик</p>}
    <Button view="action" size="xl" width="max" disabled={disabled} loading={pending} onClick={save}>Сохранить экран</Button>
  </Card><aside className="content-preview-panel"><h3>Предпросмотр</h3><p className="content-muted">Так выглядит отдельный экран</p><ScreenPreview key={screen.id} type={type} values={values} /></aside></div>;
}

function ModelPreview({url}) {
  const ref = useRef(null);
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    const model = document.createElement('model-viewer');
    model.setAttribute('src', url);model.setAttribute('camera-controls','');model.setAttribute('auto-rotate','');model.setAttribute('alt','Интерактивная 3D-модель экспоната');model.setAttribute('touch-action','pan-y');
    const loaded = () => setStatus('ready');const failed = () => setStatus('error');
    model.addEventListener('load', loaded);model.addEventListener('error', failed);
    ref.current?.appendChild(model);
    const timer = window.setTimeout(() => {if (!customElements.get('model-viewer')) setStatus('error');},15000);
    return () => {window.clearTimeout(timer);model.removeEventListener('load',loaded);model.removeEventListener('error',failed);model.remove();};
  }, [url]);
  return <div className="content-model-preview"><div ref={ref} />{status !== 'ready' && <p role="status">{status === 'error' ? 'Не удалось открыть модель. Проверьте файл и подключение.' : 'Загружаем модель…'}</p>}</div>;
}

function ScreenPreview({type, values}) {
  const [answer, setAnswer] = useState(null);
  const selected = answer?.option;
  const correct = values.options[values.correct];
  const validAttempt = answer?.signature === JSON.stringify([values.options,values.correct]);
  return <div className={`content-phone-preview content-phone-preview--${type}`}>
    {values.imageURL && type !== 'model' && <img className="content-preview-photo" src={values.imageURL} alt="" />}
    {type === 'model' && (values.modelURL ? <ModelPreview key={values.modelURL} url={values.modelURL} /> : <div className="content-preview-model-empty"><Icon data={Cube} size={64} /><span>Здесь появится модель</span></div>)}
    <div className="content-preview-copy"><small>{SCREEN_TYPES[type]?.label}</small><h2>{values.title || (type === 'quiz' ? 'Ваш вопрос' : 'Заголовок экрана')}</h2>{values.body && <p>{values.body}</p>}{type === 'model' && <p className="content-preview-hint">Вращайте модель и меняйте масштаб</p>}
    {type === 'quiz' && <div className="content-preview-answers">{values.options.map((option,index) => <button type="button" key={index} disabled={validAttempt} className={validAttempt && option === correct ? 'is-correct' : validAttempt && selected === option ? 'is-wrong' : ''} onClick={() => setAnswer({option,signature:JSON.stringify([values.options,values.correct])})}>{option || `Вариант ${index + 1}`}</button>)}{validAttempt && <div className="content-preview-result" role="status"><strong>{values.correct < 0 ? 'Правильный ответ ещё не выбран' : selected === correct ? 'Верно!' : 'Попробуем разобраться'}</strong><p>{values.explanation}</p><button type="button" onClick={() => setAnswer(null)}>Пройти ещё раз</button></div>}</div>}
    </div>
  </div>;
}
