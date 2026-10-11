import React, {useEffect, useId, useMemo, useRef, useState} from 'react';
import {Button, Dialog, DropdownMenu, Label, Select, TextArea, TextInput} from '@gravity-ui/uikit';
import {Copy, EllipsisVertical, Pencil, Plus, TrashBin} from '@gravity-ui/icons';
import {CATEGORY_OPTIONS, SCREEN_TYPES} from '../../app/constants';
import {getScreenKindMeta} from '../../app/utils';
import {Breadcrumbs, Field} from '../../components/ui';
import './artifact-wizard.css';

const FLOW_STEPS = ['Основное', 'Контент', 'Публикация'];

function ArtifactFlowHeader({current, title = 'Добавление артефакта', children}) {
  return (
    <>
      <Breadcrumbs path="Артефакты / Добавление артефакта" />
      <header className="artifact-flow-header">
        <h1>{title}</h1>
        {children}
      </header>
      <nav className="artifact-flow-steps" aria-label="Шаги создания артефакта">
        {FLOW_STEPS.map((step, index) => {
          const number = index + 1;
          return <span className={number === current ? 'is-current' : number < current ? 'is-complete' : ''} key={step}>{number}. {step}</span>;
        })}
      </nav>
    </>
  );
}

function ArtifactFlowFooter({backLabel, onBack, nextLabel, onNext, nextDisabled, loading}) {
  return (
    <footer className="artifact-flow-footer">
      <Button view="outlined" size="l" onClick={onBack}>{backLabel}</Button>
      <Button view="action" size="l" onClick={onNext} disabled={nextDisabled} loading={loading}>{nextLabel}</Button>
    </footer>
  );
}

function CoverInput({preview, error, onChange}) {
  const inputId = useId();
  return (
    <Field label="Обложка">
      <div className="artifact-cover-input">
        {preview ? <img src={preview} alt="Выбранная обложка" /> : <div className="artifact-cover-placeholder" aria-hidden="true" />}
        <div>
          <strong>{preview ? 'Обложка добавлена' : 'Добавьте обложку'}</strong>
          <span>JPG, PNG или WebP до 10 МБ</span>
        </div>
        <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { onChange(event.target.files?.[0] || null); event.currentTarget.value = ''; }} />
        <Button view="outlined" onClick={() => document.getElementById(inputId)?.click()}>{preview ? 'Заменить' : 'Выбрать файл'}</Button>
        {preview ? <Button view="flat" onClick={() => onChange(null)}>Удалить</Button> : null}
      </div>
      {error ? <div className="artifact-form-error" role="alert">{error}</div> : null}
    </Field>
  );
}

export function ArtifactBasicView({form, setForm, setView, goToArtifactStep, coverPreview, coverError, setCoverFile}) {
  const [errors, setErrors] = useState({});
  const update = (key, value) => {
    setForm((previous) => ({...previous, [key]: value}));
    setErrors((previous) => ({...previous, [key]: ''}));
  };
  const continueToContent = () => {
    const nextErrors = {
      title: form.title?.trim() ? '' : 'Укажите название артефакта.',
      category: form.category ? '' : 'Выберите категорию.',
      shortDescription: form.shortDescription?.trim() ? '' : 'Добавьте краткое описание.',
      longDescription: form.longDescription?.trim() ? '' : 'Добавьте описание артефакта.',
    };
    setErrors(nextErrors);
    if (!Object.values(nextErrors).some(Boolean)) goToArtifactStep(2);
  };

  return (
    <section className="artifact-flow">
      <ArtifactFlowHeader current={1} />
      <main className="artifact-form-layout">
        <div className="artifact-form-copy"><h2>Расскажите об артефакте</h2><p>Эти данные увидят посетители музея.</p></div>
        <div className="artifact-form-fields">
          <Field label="Название" error={errors.title}><TextInput size="l" value={form.title || ''} onUpdate={(value) => update('title', value)} /></Field>
          <Field label="Категория" error={errors.category}><Select size="l" value={form.category ? [form.category] : []} options={CATEGORY_OPTIONS} onUpdate={(value) => update('category', value[0] || '')} /></Field>
          <Field label="Краткое описание" error={errors.shortDescription}><TextArea size="l" rows={3} value={form.shortDescription || ''} onUpdate={(value) => update('shortDescription', value)} /></Field>
          <Field label="Описание" error={errors.longDescription}><TextArea size="l" rows={6} value={form.longDescription || ''} onUpdate={(value) => update('longDescription', value)} /></Field>
          <CoverInput preview={coverPreview} error={coverError} onChange={setCoverFile} />
        </div>
      </main>
      <ArtifactFlowFooter backLabel="Отменить" onBack={() => setView('artifacts')} nextLabel="К экранам" onNext={continueToContent} />
    </section>
  );
}

function ScreenTypeDialog({open, onClose, onSelect}) {
  return (
    <Dialog open={open} onClose={onClose} size="m">
      <Dialog.Header caption="Добавить экран">Выберите тип экрана</Dialog.Header>
      <Dialog.Body>
        <div className="screen-type-grid">
          {SCREEN_TYPES.map((type) => <button className="screen-type-option" key={type.id} type="button" onClick={() => onSelect(type.id)}><strong>{type.title}</strong><span>{type.description}</span></button>)}
        </div>
      </Dialog.Body>
      <Dialog.Footer textButtonCancel="Отменить" onClickButtonCancel={onClose} />
    </Dialog>
  );
}

export function ArtifactContentView({goToArtifactStep, artifactScreens, onAddScreen, onDuplicateScreen, onDeleteScreen, onEditScreen}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [screenToDelete, setScreenToDelete] = useState(null);
  const [message, setMessage] = useState('');
  const addScreen = (typeId) => {
    setDialogOpen(false);
    onAddScreen(typeId);
  };
  const menuItems = (screen) => [
    {text: 'Дублировать', icon: <Copy />, action: () => { onDuplicateScreen(screen.id); setMessage('Копия экрана добавлена в список.'); }},
    [{text: 'Удалить', icon: <TrashBin />, action: () => setScreenToDelete(screen), className: 'artifact-menu-danger'}],
  ];
  const continueToPublish = () => {
    if (artifactScreens.length === 0) {
      setMessage('Добавьте хотя бы один экран, чтобы перейти к публикации.');
      return;
    }
    goToArtifactStep(3);
  };

  return (
    <section className="artifact-flow">
      <ArtifactFlowHeader current={2} />
      <main className="artifact-content-layout">
        <div className="artifact-content-heading">
          <div><h2>Экраны</h2><p>{artifactScreens.length ? `Добавлено: ${artifactScreens.length}` : 'Соберите историю из экранов.'}</p></div>
          <Button view="action" size="l" onClick={() => setDialogOpen(true)}><Plus />Добавить экран</Button>
        </div>
        <div className="artifact-live-message" role="status" aria-live="polite">{message}</div>
        {artifactScreens.length ? <div className="artifact-screen-list" role="list">
          {artifactScreens.map((screen, index) => <div className="artifact-screen-row" role="listitem" key={screen.id}>
            <span className="artifact-screen-number">{index + 1}</span>
            <Label theme="normal" size="s">{getScreenKindMeta(screen).label}</Label>
            <strong>{screen.title || 'Без названия'}</strong>
            <Button view="outlined" size="m" disabled={!screen.editor} onClick={() => onEditScreen(screen.id)}><Pencil />Изменить</Button>
            <DropdownMenu items={menuItems(screen)} size="m" popupProps={{placement: 'bottom-end'}} renderSwitcher={(props) => <button className="artifact-row-menu" type="button" aria-label={`Действия для экрана ${index + 1}`} onClick={props.onClick} onKeyDown={props.onKeyDown}><EllipsisVertical /></button>} />
          </div>)}
        </div> : <div className="artifact-empty-state" role="status"><h3>Пока нет экранов</h3><p>Добавьте первый экран, чтобы собрать историю артефакта.</p><Button view="action" size="l" onClick={() => setDialogOpen(true)}><Plus />Добавить экран</Button></div>}
      </main>
      <ArtifactFlowFooter backLabel="Назад" onBack={() => goToArtifactStep(1)} nextLabel="Далее" onNext={continueToPublish} />
      <ScreenTypeDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSelect={addScreen} />
      <Dialog open={Boolean(screenToDelete)} onClose={() => setScreenToDelete(null)} size="s">
        <Dialog.Header caption="Удалить экран">Удалить «{screenToDelete?.title}»?</Dialog.Header>
        <Dialog.Body>Это действие нельзя отменить.</Dialog.Body>
        <Dialog.Footer textButtonCancel="Отменить" textButtonApply="Удалить" onClickButtonCancel={() => setScreenToDelete(null)} onClickButtonApply={() => { onDeleteScreen(screenToDelete.id); setScreenToDelete(null); setMessage('Экран удалён.'); }} propsButtonApply={{view: 'flat-danger'}} />
      </Dialog>
    </section>
  );
}

export function ArtifactPublishView({goToArtifactStep, publishLoading, publishError, onPublish, publishValidation}) {
  const messages = publishValidation?.errors || [];
  return (
    <section className="artifact-flow">
      <ArtifactFlowHeader current={3} />
      <main className="artifact-publish-layout">
        <h2>Проверьте перед публикацией</h2>
        {messages.length ? <div className="artifact-publish-errors" role="alert"><strong>Нужно исправить:</strong><ul>{messages.map((message) => <li key={message}>{message}</li>)}</ul><Button view="flat" onClick={() => goToArtifactStep(2)}>Вернуться к экранам</Button></div> : <div className="artifact-publish-ready"><strong>Артефакт готов к публикации</strong><span>После публикации он станет доступен посетителям.</span></div>}
        {publishError ? <div className="artifact-form-error" role="alert">{publishError}</div> : null}
      </main>
      <ArtifactFlowFooter backLabel="Назад" onBack={() => goToArtifactStep(2)} nextLabel="Опубликовать" onNext={onPublish} nextDisabled={!publishValidation?.valid} loading={publishLoading} />
    </section>
  );
}

let modelViewerLoader;

function loadModelViewer() {
  if (window.customElements?.get('model-viewer')) return Promise.resolve();
  if (modelViewerLoader) return modelViewerLoader;

  modelViewerLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('model-viewer failed to load'));
    document.head.appendChild(script);
  });
  return modelViewerLoader;
}

function ModelViewer({src}) {
  const viewerRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = viewerRef.current;
    if (!container || !src) return undefined;
    let cancelled = false;
    setFailed(false);
    loadModelViewer().then(() => {
      if (cancelled) return;
      const viewer = document.createElement('model-viewer');
      viewer.setAttribute('src', src);
      viewer.setAttribute('camera-controls', '');
      viewer.setAttribute('auto-rotate', '');
      viewer.setAttribute('shadow-intensity', '0.8');
      viewer.setAttribute('exposure', '0.9');
      viewer.setAttribute('tone-mapping', 'commerce');
      viewer.setAttribute('alt', 'Предпросмотр 3D-модели');
      viewer.style.cssText = 'width:100%;height:100%;background:transparent;--poster-color:transparent;';
      viewer.addEventListener('error', () => setFailed(true));
      container.replaceChildren(viewer);
    }).catch(() => setFailed(true));
    return () => { cancelled = true; container.replaceChildren(); };
  }, [src]);

  if (!src) return <div className="artifact-preview-placeholder">Выберите .glb или .gltf, чтобы открыть модель</div>;
  return <div className="artifact-model-viewer" ref={viewerRef}>{failed ? <div className="artifact-preview-placeholder">Не удалось открыть эту 3D-модель</div> : null}</div>;
}

function QuizPreview({question, options, correctAnswer}) {
  const [answer, setAnswer] = useState('');
  const selectedCorrect = answer && answer === correctAnswer;
  const optionsKey = options.join('|');
  useEffect(() => setAnswer(''), [question, optionsKey, correctAnswer]);
  return <div className="artifact-visitor-preview artifact-visitor-preview--quiz"><strong>{question || 'Вопрос появится здесь.'}</strong><div>{options.map((option) => <Button key={option} view={answer === option ? 'action' : 'outlined'} size="m" onClick={() => setAnswer(option)}>{option}</Button>)}</div>{answer ? <small className={selectedCorrect ? 'is-correct' : 'is-wrong'}>{selectedCorrect ? 'Верно' : 'Попробуйте ещё раз'}</small> : null}</div>;
}

function EditorPreview({type, screen, imageUrl, modelUrl}) {
  const content = screen?.content || {};
  const body = content.body || content.description || content.question || screen?.body || '';
  const title = screen?.title || 'Без названия';
  const options = content.options?.length ? content.options : ['Правда', 'Ложь'];
  const assetName = content.imageName || content.modelName || content.audioName || '';

  return <aside className="artifact-editor-preview" aria-label="Предпросмотр для посетителя">
    <span>Как увидит посетитель</span>
    {type === 'Текст + фото' ? <div className="artifact-visitor-preview artifact-visitor-preview--photo">{imageUrl ? <img src={imageUrl} alt="" /> : <div className="artifact-preview-placeholder">Добавьте изображение</div>}<div className="artifact-visitor-copy"><h2>{title}</h2><p>{body || 'Текст появится здесь.'}</p></div></div> : null}
    {type === '3D-модель' ? <div className="artifact-visitor-preview artifact-visitor-preview--model"><ModelViewer src={modelUrl} /><h2>{title}</h2><p>{body || 'Описание появится здесь.'}</p></div> : null}
    {type === 'Тест' ? <QuizPreview question={body} options={options} correctAnswer={content.correctAnswer || options[0]} /> : null}
    {type === 'Аудио + фото' ? <div className="artifact-visitor-preview artifact-visitor-preview--audio">{imageUrl ? <img src={imageUrl} alt="" /> : <div className="artifact-preview-placeholder">Добавьте изображение</div>}<h2>{title}</h2><p>{body || 'Описание появится здесь.'}</p><small>{assetName || 'Добавьте аудиофайл'}</small></div> : null}
  </aside>;
}

function FileInput({label, accept, name, onChange, onPreviewChange, error}) {
  const inputId = useId();
  const [preview, setPreview] = useState('');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const selectFile = (file) => {
    if (preview) URL.revokeObjectURL(preview);
    const nextPreview = file ? URL.createObjectURL(file) : '';
    setPreview(file?.type?.startsWith('image/') ? nextPreview : '');
    onPreviewChange?.(nextPreview);
    onChange(file || null);
  };
  return <Field label={label} error={error}><div className="artifact-editor-file">{preview ? <img src={preview} alt="Предпросмотр выбранного файла" /> : null}<div><strong>{name || 'Файл не выбран'}</strong><span>{name ? 'Выбранный файл' : 'Выберите файл на устройстве'}</span></div><input id={inputId} type="file" accept={accept} hidden onChange={(event) => { selectFile(event.target.files?.[0]); event.currentTarget.value = ''; }} /><Button view="outlined" onClick={() => document.getElementById(inputId)?.click()}>{name ? 'Заменить' : 'Выбрать файл'}</Button>{name ? <Button view="flat" onClick={() => selectFile(null)}>Удалить</Button> : null}</div></Field>;
}

function EditorShell({type, screen, validation, showValidation, onChange, onCancel, onSave, imageUrl, modelUrl, children}) {
  const errors = useMemo(() => (showValidation ? validation?.fieldErrors || {} : {}), [showValidation, validation]);
  const body = screen?.content?.body || screen?.content?.description || screen?.content?.question || screen?.body || '';
  const formRef = useRef(null);
  const focusedValidationRef = useRef(false);
  useEffect(() => {
    if (showValidation && Object.keys(errors).length > 0 && !focusedValidationRef.current) {
      formRef.current?.querySelector('.has-error input, .has-error textarea, .has-error button')?.focus();
      focusedValidationRef.current = true;
    }
    if (!showValidation) focusedValidationRef.current = false;
  }, [errors, showValidation]);
  return (
    <section className="artifact-editor">
      <Breadcrumbs path="Артефакты / Добавление артефакта / Редактирование экрана" />
      <header className="artifact-flow-header"><h1>Редактирование экрана</h1></header>
      <main className="artifact-editor-layout">
        <div className="artifact-editor-form" ref={formRef}>
          <Label theme="normal" size="s">{type}</Label>
          <Field label="Заголовок" error={errors.title}><TextInput size="l" value={screen?.title || ''} onUpdate={(value) => onChange({title: value})} /></Field>
          {children(errors, body)}
        </div>
        <EditorPreview type={type} screen={screen} imageUrl={imageUrl} modelUrl={modelUrl} />
      </main>
      <ArtifactFlowFooter backLabel="Отменить" onBack={onCancel} nextLabel="Сохранить" onNext={onSave} />
    </section>
  );
}

const updateBody = (onChange, key, value) => onChange((previous) => ({...previous, body: value, textLines: value.split('\n').map((line) => line.trim()).filter(Boolean), content: {...(previous.content || {}), [key]: value}}));

export function EditorTextView({screen, validation, showValidation, onChange, onCancel, onSave}) {
  const [imageUrl, setImageUrl] = useState('');
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  return <EditorShell type="Текст + фото" screen={screen} imageUrl={imageUrl} validation={validation} showValidation={showValidation} onChange={onChange} onCancel={onCancel} onSave={onSave}>{(errors, body) => <><Field label="Текст" error={errors.body}><TextArea size="l" rows={7} value={body} onUpdate={(value) => updateBody(onChange, 'body', value)} /></Field><FileInput label="Изображение" accept="image/jpeg,image/png,image/webp" name={screen?.content?.imageName} error={errors.imageName} onPreviewChange={setImageUrl} onChange={(file) => onChange((previous) => ({...previous, mediaCount: file ? 1 : 0, content: {...(previous.content || {}), imageName: file?.name || ''}}))} /></>}</EditorShell>;
}

export function EditorModelView({screen, validation, showValidation, onChange, onCancel, onSave}) {
  const [modelUrl, setModelUrl] = useState('');
  useEffect(() => () => { if (modelUrl) URL.revokeObjectURL(modelUrl); }, [modelUrl]);
  return <EditorShell type="3D-модель" screen={screen} modelUrl={modelUrl} validation={validation} showValidation={showValidation} onChange={onChange} onCancel={onCancel} onSave={onSave}>{(errors, body) => <><Field label="Описание" error={errors.description}><TextArea size="l" rows={5} value={body} onUpdate={(value) => updateBody(onChange, 'description', value)} /></Field><FileInput label="3D-модель" accept=".glb,.gltf,model/gltf-binary" name={screen?.content?.modelName} error={errors.modelName} onPreviewChange={setModelUrl} onChange={(file) => onChange((previous) => ({...previous, content: {...(previous.content || {}), modelName: file?.name || ''}}))} /></>}</EditorShell>;
}

export function EditorQuizView({screen, validation, showValidation, onChange, onCorrectAnswerChange, onCancel, onSave}) {
  const options = screen?.content?.options?.length ? screen.content.options : ['Правда', 'Ложь'];
  return <EditorShell type="Тест" screen={screen} validation={validation} showValidation={showValidation} onChange={onChange} onCancel={onCancel} onSave={onSave}>{(errors, body) => <><Field label="Вопрос" error={errors.question}><TextArea size="l" rows={4} value={body} onUpdate={(value) => updateBody(onChange, 'question', value)} /></Field><Field label="Варианты" error={errors.options}><div className="artifact-quiz-options">{options.map((option, index) => <TextInput key={`${screen?.id}-${index}`} size="l" value={option} onUpdate={(value) => onChange((previous) => { const nextOptions = [...(previous.content?.options || options)]; nextOptions[index] = value; return {...previous, content: {...(previous.content || {}), options: nextOptions}}; })} />)}<Button view="flat" onClick={() => onChange((previous) => ({...previous, content: {...(previous.content || {}), options: [...(previous.content?.options || options), `Вариант ${options.length + 1}`]}}))}>Добавить вариант</Button></div></Field><Field label="Правильный ответ" error={errors.correctAnswer}><Select size="l" value={[screen?.content?.correctAnswer || options[0]]} options={options.map((option) => ({value: option, content: option}))} onUpdate={(value) => onCorrectAnswerChange(value[0])} /></Field></>}</EditorShell>;
}

export function EditorAudioView({screen, validation, showValidation, onChange, onCancel, onSave}) {
  const [imageUrl, setImageUrl] = useState('');
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  return <EditorShell type="Аудио + фото" screen={screen} imageUrl={imageUrl} validation={validation} showValidation={showValidation} onChange={onChange} onCancel={onCancel} onSave={onSave}>{(errors, body) => <><Field label="Описание" error={errors.description}><TextArea size="l" rows={5} value={body} onUpdate={(value) => updateBody(onChange, 'description', value)} /></Field><FileInput label="Аудиофайл" accept="audio/*" name={screen?.content?.audioName} error={errors.audioName} onChange={(file) => onChange((previous) => ({...previous, audioCount: file ? 1 : 0, content: {...(previous.content || {}), audioName: file?.name || ''}}))} /><FileInput label="Изображение" accept="image/jpeg,image/png,image/webp" name={screen?.content?.imageName} error={errors.imageName} onPreviewChange={setImageUrl} onChange={(file) => onChange((previous) => ({...previous, mediaCount: file ? 1 : 0, content: {...(previous.content || {}), imageName: file?.name || ''}}))} /></>}</EditorShell>;
}
