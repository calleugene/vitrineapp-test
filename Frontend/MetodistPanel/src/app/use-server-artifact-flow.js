import {useCallback, useEffect, useMemo, useState} from 'react';
import {artifactsApi} from '../api';

const emptyDraft = {title: '', short_description: '', description: '', category: 'other'};
const payloadFor = (body, imageURL = '', extra = {}) => JSON.stringify({version: 1, content: {...extra, body, image_url: imageURL}, body, image_url: imageURL});

function messageFor(error) {
  if (error?.code === 'screen_content_incomplete') return 'Проверьте экраны: в тесте нужны варианты и правильный ответ, в 3D-экране — модель.';
  if (error?.code === 'invalid_glb') return 'Не удалось прочитать модель. Нужен GLB 2.0 со встроенными текстурами и ресурсами.';
  if (error?.code === 'revision_conflict') return 'Экспонат изменился после загрузки. Откройте его заново, проверьте изменения и повторите публикацию.';
  if (error?.code === 'no_unpublished_changes') return 'Все изменения уже опубликованы. Новая публикация не требуется.';
  if (error?.code === 'cannot_publish_empty') return 'Добавьте хотя бы один экран в разделе «Контент» перед публикацией.';
  if (error?.code === 'archived_artifact') return 'Сначала восстановите экспонат из архива.';
  if (error?.status === 401) return 'Сессия истекла или нет доступа к музею. Войдите в аккаунт заново.';
  if (error?.code === 'service_unavailable') return 'Сервис экспонатов недоступен. Попробуйте ещё раз.';
  if (error?.status === 404) return 'Экспонат или экран уже не существует.';
  return 'Не удалось выполнить действие. Попробуйте ещё раз.';
}

export function useServerArtifactFlow({loadArtifacts, onNavigate}) {
  const [artifact, setArtifact] = useState(null);
  const [screens, setScreens] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [publication, setPublication] = useState(null);

  useEffect(() => {
    const warnBeforeUnload = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  const loadScreens = useCallback(async (artifactId) => {
    // Screen mutations also advance the artifact revision used by publication.
    const [response, latest] = await Promise.all([
      artifactsApi.listScreens(artifactId),
      artifactsApi.get(artifactId),
    ]);
    setScreens((response?.screens || []).filter((screen) => !screen.is_system));
    setArtifact((current) => current?.id === artifactId ? latest.artifact : current);
  }, []);

  const select = useCallback(async (artifactId, nextView = 'artifact-basic') => {
    setLoading(true); setError('');
    try {
      const response = await artifactsApi.get(artifactId);
      const item = response.artifact;
      setArtifact(item);
      setDraft({title: item.title || '', short_description: item.short_description || '', description: item.description || '', category: item.category || 'other'});
      setDirty(false); setPublication(null);
		await loadScreens(item.id);
		onNavigate(nextView, {artifactId: item.id});
    } catch (nextError) { setError(messageFor(nextError)); }
    finally { setLoading(false); }
  }, [loadScreens, onNavigate]);

  const start = useCallback(() => {
		setArtifact(null); setScreens([]); setDraft(emptyDraft); setDirty(false); setPublication(null); setError(''); setNotice(''); onNavigate('artifact-basic', {artifactId: null});
  }, [onNavigate]);

  const change = useCallback((patch) => { setDraft((current) => ({...current, ...patch})); setDirty(true); }, []);

  const save = useCallback(async () => {
    const title = draft.title.trim();
    if (!title) { setError('Укажите название экспоната.'); return null; }
    if (draft.short_description.length > 250) { setError('Краткое описание не должно превышать 250 символов.'); return null; }
    setLoading(true); setError('');
    const body = {title, short_description: draft.short_description.trim(), description: draft.description.trim() || draft.short_description.trim(), category: draft.category || 'other'};
    try {
      const response = artifact ? await artifactsApi.update(artifact.id, body) : await artifactsApi.create(body);
      const item = response.artifact;
      setArtifact(item); setDraft({title: item.title || '', short_description: item.short_description || '', description: item.description || '', category: item.category || 'other'}); setDirty(false);
      await loadArtifacts();
      return item;
    } catch (nextError) { setError(messageFor(nextError)); return null; }
    finally { setLoading(false); }
  }, [artifact, draft, loadArtifacts]);

	const saveAndGo = useCallback(async (view) => { const item = await save(); if (item) onNavigate(view, {artifactId: item.id}); }, [onNavigate, save]);
  const uploadCover = useCallback(async (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('Допустимы JPG, PNG или WebP до 10 МБ.'); return; }
    const item = artifact || await save();
    if (!item) return;
    setLoading(true); setError('');
    try { await artifactsApi.uploadCover(item.id, file); const latest = await artifactsApi.get(item.id); setArtifact(latest.artifact); setNotice('Обложка загружена.'); await loadArtifacts(); }
    catch (nextError) { setError(messageFor(nextError)); }
    finally { setLoading(false); }
  }, [artifact, loadArtifacts, save]);
  const addTextScreen = useCallback(async (type = 'text') => {
    const item = artifact || await save(); if (!item) return;
    setLoading(true); setError('');
    try { const response = await artifactsApi.createScreen(item.id, {type, title: type === 'quiz' ? 'Новый вопрос' : type === 'model' ? 'Рассмотрите экспонат' : 'Новый экран', payload: payloadFor('', '', type === 'quiz' ? {options: [], correct_answer: '', explanation: ''} : {})}); await loadScreens(item.id); setNotice('Экран добавлен.'); return response.screen; }
    catch (nextError) { setError(messageFor(nextError)); return null; }
    finally { setLoading(false); }
  }, [artifact, loadScreens, save]);
  const updateScreen = useCallback(async (screenId, title, body, imageURL = '', extra = {}) => {
    if (!artifact) return false;
    setLoading(true); setError('');
    try { await artifactsApi.updateScreen(artifact.id, screenId, {title: title.trim(), payload: payloadFor(body, imageURL, extra)}); await loadScreens(artifact.id); setNotice('Экран сохранён.'); return true; }
    catch (nextError) { setError(messageFor(nextError)); return false; }
    finally { setLoading(false); }
  }, [artifact, loadScreens]);
  const uploadScreenImage = useCallback(async (screenId, file) => {
    if (!artifact || !file) return '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError('Допустимы JPG, PNG или WebP до 10 МБ.'); return ''; }
    setLoading(true); setError('');
    try { const response = await artifactsApi.uploadScreenImage(artifact.id, screenId, file); setNotice('Фоновое изображение загружено.'); return response.image_url || ''; }
    catch (nextError) { setError(messageFor(nextError)); return ''; }
    finally { setLoading(false); }
  }, [artifact]);
  const removeScreen = useCallback(async (screenId) => {
    if (!artifact) return;
    setLoading(true); setError('');
    try { await artifactsApi.removeScreen(artifact.id, screenId); await loadScreens(artifact.id); setNotice('Экран удалён.'); }
    catch (nextError) { setError(messageFor(nextError)); }
    finally { setLoading(false); }
  }, [artifact, loadScreens]);
  const duplicateScreen = useCallback(async (screen) => {
    if (!artifact) return;
    setLoading(true); setError('');
    try { await artifactsApi.duplicateScreen(artifact.id, screen.id); await loadScreens(artifact.id); setNotice('Экран продублирован.'); }
    catch (nextError) { setError(messageFor(nextError)); }
    finally { setLoading(false); }
  }, [artifact, loadScreens]);
  const reorder = useCallback(async (nextScreens) => {
    if (!artifact) return;
    setLoading(true); setError('');
    const before = screens; setScreens(nextScreens);
    try { await artifactsApi.reorderScreens(artifact.id, nextScreens.map((screen, index) => ({screenId: screen.id, order: index + 1}))); await loadScreens(artifact.id); setNotice('Порядок экранов сохранён.'); }
    catch (nextError) { setScreens(before); setError(messageFor(nextError)); }
    finally {setLoading(false);}
  }, [artifact, screens, loadScreens]);
  const duplicateArtifact = useCallback(async (artifactId) => { try { await artifactsApi.duplicate(artifactId); await loadArtifacts(); setNotice('Экспонат продублирован.'); } catch (nextError) { setError(messageFor(nextError)); } }, [loadArtifacts]);
	const archiveArtifact = useCallback(async (artifactId) => { try { await artifactsApi.archive(artifactId); await loadArtifacts(); setNotice('Экспонат перенесён в архив.'); } catch (nextError) { setError(messageFor(nextError)); } }, [loadArtifacts]);
	const restoreArtifact = useCallback(async (artifactId) => { try { await artifactsApi.restore(artifactId); await loadArtifacts(); setNotice('Экспонат восстановлен в черновики.'); } catch (nextError) { setError(messageFor(nextError)); } }, [loadArtifacts]);
  const publish = useCallback(async () => { if (!artifact) return; setLoading(true); setError(''); try { const result = await artifactsApi.publish(artifact.id, artifact.draft_revision); setPublication(result); setArtifact((current) => ({...current, status: 'published', published_revision: result.version, draft_revision: result.version})); setDirty(false); await loadArtifacts(); onNavigate('artifact-success'); } catch (nextError) { setError(messageFor(nextError)); } finally { setLoading(false); } }, [artifact, loadArtifacts, onNavigate]);

	return useMemo(() => ({artifact, screens, draft, dirty, loading, error, notice, publication, select, start, change, save, saveAndGo, uploadCover, addTextScreen, updateScreen, uploadScreenImage, removeScreen, duplicateScreen, reorder, duplicateArtifact, archiveArtifact, restoreArtifact, publish, setError}), [artifact, screens, draft, dirty, loading, error, notice, publication, select, start, change, save, saveAndGo, uploadCover, addTextScreen, updateScreen, uploadScreenImage, removeScreen, duplicateScreen, reorder, duplicateArtifact, archiveArtifact, restoreArtifact, publish]);
}
