import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {artifactsApi} from '../api';
import {
  ARTIFACT_WIZARD_VIEWS,
} from './constants';
import {
  addArtifactScreenToDraft,
  buildArtifactPublishPayload,
  createArtifactDraft,
  duplicateArtifactScreenDraft,
  moveArtifactScreenDraft,
  normalizeArtifactScreen,
  removeArtifactScreenDraft,
  reorderArtifactScreenDraft,
  updateArtifactScreenDraft,
  validateArtifactScreenDraft,
} from './utils';

const DEFAULT_ARTIFACT_FORM = {
  title: 'Письмо фронтовика 1943 года',
  shortDescription: 'Фронтовые письма - это особенные документы.',
  category: 'letters',
  date: '1943-04-12',
  period: '1941-1944',
  place: 'Сталинград',
  tags: ['письмо', 'война', 'фронт'],
  longDescription:
    'Расскажите об артефакте: его истории, значении, интересных фактах и контексте.',
};

export function useArtifactDraft({loadArtifacts, onNavigate}) {
  const [draft, setDraft] = useState(() =>
    (() => {
      try {
        const stored = window.localStorage.getItem('metodist-artifact-draft');
        if (stored) return createArtifactDraft(JSON.parse(stored));
      } catch { /* ignore malformed local draft */ }
      return createArtifactDraft({
      form: DEFAULT_ARTIFACT_FORM,
      screens: [],
      publication: {
        status: 'published',
        visibility: 'public',
        routeAccess: 'selected',
        showViews: true,
        allowDownload: false,
      },
      });
    })()
  );
  const [draftSavedAt, setDraftSavedAt] = useState(null);

  useEffect(() => {
    try {
      window.localStorage.setItem('metodist-artifact-draft', JSON.stringify(draft));
      setDraftSavedAt(new Date());
    } catch { /* storage can be unavailable in private mode */ }
  }, [draft]);
  const [selectedArtifactScreenId, setSelectedArtifactScreenId] = useState(null);
  const [editingScreenId, setEditingScreenId] = useState(null);
  const [editorDraft, setEditorDraft] = useState(null);
  const [editorTouched, setEditorTouched] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishLoading, setPublishLoading] = useState(false);
  const [createdArtifact, setCreatedArtifact] = useState(null);
  const [coverFile, setCoverFileState] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverError, setCoverError] = useState('');
  const coverPreviewRef = useRef('');

  const form = draft.artifact;
  const status = draft.publication.status;
  const visibility = draft.publication.visibility;
  const routeAccess = draft.publication.routeAccess;
  const showViews = draft.publication.showViews;
  const allowDownload = draft.publication.allowDownload;
  const artifactScreens = draft.screens.filter((screen) => !screen.locked);

  const selectedScreen = useMemo(
    () => artifactScreens.find((screen) => screen.id === selectedArtifactScreenId) || null,
    [artifactScreens, selectedArtifactScreenId]
  );

  const activeEditorScreen = editorDraft || selectedScreen;
  const publishValidation = useMemo(() => buildArtifactPublishPayload(draft).validation, [draft]);

  const resetArtifactDraft = useCallback(() => {
    setDraft(
      createArtifactDraft({
        form: DEFAULT_ARTIFACT_FORM,
        screens: [],
        publication: {
          status: 'published',
          visibility: 'public',
          routeAccess: 'selected',
          showViews: true,
          allowDownload: false,
        },
      })
    );
    setSelectedArtifactScreenId(null);
    setEditingScreenId(null);
    setEditorDraft(null);
    setEditorTouched(false);
    setPublishError('');
    setPublishLoading(false);
    setCreatedArtifact(null);
    setCoverFileState(null);
    setCoverPreview('');
    setCoverError('');
  }, []);

  const setCoverFile = useCallback((file) => {
    if (!file) {
      setCoverFileState(null);
      setCoverPreview('');
      setCoverError('');
      return;
    }
    if (!file.type.startsWith('image/')) { setCoverError('Выберите изображение JPG, PNG или WebP.'); return; }
    if (file.size > 10 * 1024 * 1024) { setCoverError('Размер обложки не должен превышать 10 МБ.'); return; }
    setCoverError('');
    setCoverFileState(file);
    const nextPreview = URL.createObjectURL(file);
    if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
    coverPreviewRef.current = nextPreview;
    setCoverPreview(nextPreview);
  }, []);

  useEffect(() => () => {
    if (coverPreviewRef.current) URL.revokeObjectURL(coverPreviewRef.current);
  }, []);

  const setForm = useCallback((nextValue) => {
    setDraft((prev) => ({
      ...prev,
      artifact: typeof nextValue === 'function' ? nextValue(prev.artifact) : nextValue,
    }));
  }, []);

  const setStatus = useCallback((nextStatus) => {
    setDraft((prev) => ({
      ...prev,
      publication: {...prev.publication, status: nextStatus},
    }));
  }, []);

  const setVisibility = useCallback((nextVisibility) => {
    setDraft((prev) => ({
      ...prev,
      publication: {...prev.publication, visibility: nextVisibility},
    }));
  }, []);

  const setRouteAccess = useCallback((nextRouteAccess) => {
    setDraft((prev) => ({
      ...prev,
      publication: {...prev.publication, routeAccess: nextRouteAccess},
    }));
  }, []);

  const setShowViews = useCallback((nextShowViews) => {
    setDraft((prev) => ({
      ...prev,
      publication: {...prev.publication, showViews: nextShowViews},
    }));
  }, []);

  const setAllowDownload = useCallback((nextAllowDownload) => {
    setDraft((prev) => ({
      ...prev,
      publication: {...prev.publication, allowDownload: nextAllowDownload},
    }));
  }, []);

  const startArtifactFlow = useCallback(() => {
    resetArtifactDraft();
    onNavigate('artifact-basic');
  }, [onNavigate, resetArtifactDraft]);

  const goToArtifactStep = useCallback(
    (step) => {
      const nextView = ARTIFACT_WIZARD_VIEWS[step - 1];
      if (nextView) {
        onNavigate(nextView);
      }
    },
    [onNavigate]
  );

  const addArtifactScreen = useCallback((typeId) => {
    setDraft((prev) => {
      const result = addArtifactScreenToDraft(prev.screens, typeId);
      if (result.screen) {
        setSelectedArtifactScreenId(result.screen.id);
        setEditingScreenId(result.screen.id);
        setEditorDraft(result.screen);
        setEditorTouched(false);
      }

      return {
        ...prev,
        screens: result.screens,
      };
    });
  }, []);

  const duplicateArtifactScreen = useCallback((screenId) => {
    setDraft((prev) => ({
      ...prev,
      screens: duplicateArtifactScreenDraft(prev.screens, screenId),
    }));
  }, []);

  const removeArtifactScreen = useCallback((screenId) => {
    setDraft((prev) => ({
      ...prev,
      screens: removeArtifactScreenDraft(prev.screens, screenId),
    }));
    setSelectedArtifactScreenId((prev) => (prev === screenId ? null : prev));
    setEditingScreenId((prev) => (prev === screenId ? null : prev));
    setEditorDraft((prev) => (prev?.id === screenId ? null : prev));
    setEditorTouched(false);
  }, []);

  const moveArtifactScreen = useCallback((screenId, direction) => {
    setDraft((prev) => ({
      ...prev,
      screens: moveArtifactScreenDraft(prev.screens, screenId, direction),
    }));
  }, []);

  const reorderArtifactScreens = useCallback((fromId, toId) => {
    setDraft((prev) => ({
      ...prev,
      screens: reorderArtifactScreenDraft(prev.screens, fromId, toId),
    }));
  }, []);

  const startEditingScreen = useCallback(
    (screenId) => {
      const screen = draft.screens.find((item) => item.id === screenId);
      if (!screen) {
        return;
      }

      setSelectedArtifactScreenId(screenId);
      setEditingScreenId(screenId);
      setEditorDraft(normalizeArtifactScreen(screen));
      setEditorTouched(false);
      if (screen.editor) {
        onNavigate(screen.editor);
      }
    },
    [draft.screens, onNavigate]
  );

  const updateEditingScreen = useCallback((updates) => {
    setEditorTouched(true);
    setEditorDraft((prev) => {
      if (!prev) {
        return prev;
      }

      return normalizeArtifactScreen({
        ...prev,
        ...(typeof updates === 'function' ? updates(prev) : updates),
      });
    });
  }, []);

  const cancelEditingScreen = useCallback(() => {
    setEditorDraft(null);
    setEditingScreenId(null);
    setEditorTouched(false);
    onNavigate('artifact-content');
  }, [onNavigate]);

  const saveEditingScreen = useCallback(() => {
    if (!editingScreenId || !editorDraft) {
      onNavigate('artifact-content');
      return;
    }

    const validation = validateArtifactScreenDraft(editorDraft);
    if (!validation.valid) {
      setEditorTouched(true);
      return;
    }

    setDraft((prev) => ({
      ...prev,
      screens: updateArtifactScreenDraft(prev.screens, editingScreenId, editorDraft),
    }));
    setSelectedArtifactScreenId(editingScreenId);
    setEditorDraft(null);
    setEditingScreenId(null);
    setEditorTouched(false);
    onNavigate('artifact-content');
  }, [editingScreenId, editorDraft, onNavigate]);

  const handlePublishArtifact = useCallback(async () => {
    setPublishLoading(true);
    setPublishError('');

    try {
      const payload = buildArtifactPublishPayload(draft);

      if (!payload.validation.valid) {
        setPublishError(payload.validation.errors.join(' '));
        return;
      }

      const createResponse = await artifactsApi.create(payload.artifact);

      let artifact = createResponse.artifact;

      for (const screenPayload of payload.screens) {
        await artifactsApi.createScreen(artifact.id, screenPayload);
      }

      if (coverFile) {
        const coverResponse = await artifactsApi.uploadCover(artifact.id, coverFile);
        artifact = {...artifact, cover_url: coverResponse.cover_url || coverResponse.artifact?.cover_url};
      }

      if (payload.artifact.status && payload.artifact.status !== artifact.status) {
        const updateResponse = await artifactsApi.update(artifact.id, payload.artifact);
        artifact = updateResponse.artifact;
      }

      setCreatedArtifact(artifact);
      await loadArtifacts();
      onNavigate('artifact-success');
    } catch {
      setPublishError('Не удалось сохранить артефакт. Проверьте, что ArtifactsService доступен и попробуйте снова.');
    } finally {
      setPublishLoading(false);
    }
  }, [draft, loadArtifacts, onNavigate, coverFile]);

  const updateEditingScreenOrder = useCallback((orderValue) => {
    const nextOrder = Number.parseInt(String(orderValue).replace('step-', ''), 10);
    if (!Number.isFinite(nextOrder) || !editorDraft) {
      return;
    }

    updateEditingScreen({order: nextOrder});
  }, [editorDraft, updateEditingScreen]);

  const updateEditingScreenCorrectAnswer = useCallback((nextValue) => {
    updateEditingScreen((prev) => ({
      ...prev,
      content: {
        ...(prev.content || {}),
        correctAnswer: nextValue,
      },
    }));
  }, [updateEditingScreen]);

  const editorValidation = activeEditorScreen
    ? validateArtifactScreenDraft(activeEditorScreen)
    : {valid: true, fieldErrors: {}, errors: []};

  return {
    artifactDraft: draft,
    form,
    setForm,
    status,
    setStatus,
    visibility,
    setVisibility,
    routeAccess,
    setRouteAccess,
    showViews,
    setShowViews,
    allowDownload,
    setAllowDownload,
    artifactScreens,
    selectedScreen,
    editingScreenId,
    editingScreen: activeEditorScreen,
    editorValidation,
    publishValidation,
    draftSavedAt,
    showEditorValidation: editorTouched,
    updateEditingScreenOrder,
    updateEditingScreenCorrectAnswer,
    selectedArtifactScreenId,
    setSelectedArtifactScreenId,
    publishError,
    publishLoading,
    createdArtifact,
    coverFile,
    coverPreview,
    coverError,
    setCoverFile,
    startArtifactFlow,
    goToArtifactStep,
    addArtifactScreen,
    duplicateArtifactScreen,
    removeArtifactScreen,
    moveArtifactScreen,
    reorderArtifactScreens,
    startEditingScreen,
    updateEditingScreen,
    cancelEditingScreen,
    saveEditingScreen,
    handlePublishArtifact,
  };
}
