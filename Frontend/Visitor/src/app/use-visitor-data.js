import {useCallback, useEffect, useRef, useState} from 'react';
import {createApiClient, createVisitorAuthApi} from './api-client.js';
import {appConfig} from './config.js';
import {findArtifactBySecretCode, readQrArtifactId} from '../features/scanner/code-utils.js';
import {useToast} from '../components/Toast.jsx';
import {analyticsEvents as analytics} from './analytics-events.js';

const api = createApiClient(appConfig);
const visitorAuth = createVisitorAuthApi(appConfig.authApiUrl);
const artifactQrMap = {
  'front-letter': 'qr-hermitage-madonna',
  'tank-diary': 'qr-hermitage-armor',
  'medal-courage': 'qr-hermitage-malachite',
  'school-banner': 'qr-glory-flag',
  'author-notes': 'qr-literature-manuscript',
};

const VIEW_URLS = {
  museumSelect: '/museums',
  profileCollection: '/collection',
  profileHome: '/profile',
  profileSettings: '/profile/settings',
  auth: '/profile/login',
  forgotPassword: '/profile/recovery',
};
const PUBLIC_STORY_RETURN_URL_KEY = 'viralabs.public.story.return-url';

const PATH_TO_VIEW = {
  '/museums': 'museumSelect',
  '/collection': 'profileCollection',
  '/profile': 'profileHome',
  '/profile/settings': 'profileSettings',
  '/profile/login': 'auth',
  '/profile/recovery': 'forgotPassword',
};

function getViewFromPath(path) {
  if (path === '/' || path === '' || path === '/visitor' || path === '/visitor/') return 'museumSelect';
  if (PATH_TO_VIEW[path]) return PATH_TO_VIEW[path];
  if (path.match(/^\/m\d+/)) return 'museumDetail';
  if (path.match(/^\/a\d+$/)) return 'artifactCard';
  if (path.match(/^\/a\//)) return 'secretCode';
  if (path.startsWith('/profile')) return 'profileHome';
  return 'notFound';
}

function getInitialView() {
  try {
    if (!localStorage.getItem('vl_onboarded')) return 'onboarding';
    return getViewFromPath(window.location.pathname);
  } catch {
    return 'museumSelect';
  }
}

const INITIAL = {
  visitor: null,
  museums: [],
  museumDetail: null,
  storyData: null,
  profile: null,
  collection: [],
  achievements: [],
  settings: null,
  artifactDetail: null,
  routeResult: null,
  selectedMuseumId: null,
  activeArtifactId: null,
  loading: true,
  loadError: false,
	isAuthenticated: visitorAuth.isAuthenticated(),
  view: getInitialView(),
};

export function useVisitorData() {
  const toast = useToast();
  const [state, setState] = useState(INITIAL);
  const ref = useRef(state);

  const patch = useCallback((partial) => {
    ref.current = {...ref.current, ...partial};
    setState(ref.current);
  }, []);

  const get = () => ref.current;
  const visitorId = useCallback(() => get().visitor?.id || '', []);
  const selectedDetail = useCallback(() => get().museumDetail, []);
  const activeArtifact = useCallback(() => {
    const detail = selectedDetail();
    return detail ? detail.artifacts.find((a) => a.id === get().activeArtifactId) || null : null;
  }, [selectedDetail]);

  // ---- data loaders ----
  const refreshMuseums = useCallback(async () => {
    const museums = await api.listMuseums(visitorId());
    patch({museums});
    return museums;
  }, [patch, visitorId]);

  const refreshMuseumDetail = useCallback(
    async (museumId = get().selectedMuseumId) => {
      if (!museumId) return null;
      const museumDetail = await api.getMuseum(museumId, visitorId());
      patch({selectedMuseumId: museumId, museumDetail});
      return museumDetail;
    },
    [patch, visitorId],
  );

  const refreshProfileData = useCallback(async () => {
    const [profile, collection, achievements, settings] = await Promise.all([
      api.getProfile(visitorId()),
      api.getCollection(visitorId()),
      api.listAchievements(visitorId()),
      api.getSettings(visitorId()),
    ]);
    patch({profile, collection, achievements, settings});
  }, [patch, visitorId]);

  const loadArtifactDetail = useCallback(
    async (artifactId = get().activeArtifactId) => {
      if (!artifactId) return null;
      const artifactDetail = await api.getArtifactDetail(visitorId(), artifactId);
      patch({artifactDetail, activeArtifactId: artifactId});
      return artifactDetail;
    },
    [patch, visitorId],
  );

  const loadRouteResult = useCallback(
    async (routeId) => {
      try {
        const routeResult = await api.getRouteResult(visitorId(), routeId);
        patch({routeResult});
        return routeResult;
      } catch (error) {
        if (error?.status === 404) {
          patch({routeResult: null});
          return null;
        }
        throw error;
      }
    },
    [patch, visitorId],
  );

  const loadStory = useCallback(
    async (routeId, artifactId) => {
      const storyData = await api.getStory(routeId, artifactId);
      patch({storyData});
      return storyData;
    },
    [patch],
  );

  // ---- navigation ----
  const navigate = useCallback((view) => {
    patch({view});
    const url = VIEW_URLS[view];
    if (url && window.location.pathname !== url) {
      window.history.pushState({view}, '', url);
    }
  }, [patch]);

  // ---- actions ----
  const selectMuseum = useCallback(
    async (museumId) => {
      await refreshMuseumDetail(museumId);
      patch({activeArtifactId: selectedDetail()?.artifacts[0]?.id || null, view: 'museumDetail'});
    },
    [patch, refreshMuseumDetail, selectedDetail],
  );

  const openArtifactFromCollection = useCallback(
    async (artifactId) => {
      await loadArtifactDetail(artifactId);
      patch({view: 'artifactCard'});
    },
    [patch, loadArtifactDetail],
  );

  const selectArtifact = useCallback(
    (artifactId) => {
      const detail = selectedDetail();
      const artifact = detail?.artifacts.find((a) => a.id === artifactId);
      if (!artifact) return;
      if (artifact.publicCode) {
        try {
          window.sessionStorage.setItem(PUBLIC_STORY_RETURN_URL_KEY, window.location.pathname);
        } catch {
          // A direct QR visit still has a safe fallback to the museum list.
        }
        window.location.assign(`/exhibits/${encodeURIComponent(artifact.publicCode)}`);
        return;
      }
      patch({activeArtifactId: artifactId, view: 'secretCode'});
    },
    [patch, selectedDetail],
  );

  const buildScanPayload = useCallback((qrCode) => ({
    visitor_id: visitorId(),
    qr_code: qrCode,
    idempotency_key: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    answer_correct: true,
    ar_moment_completed: true,
    story_duration_sec: activeArtifact()?.story_duration_sec || 90,
  }), [activeArtifact, visitorId]);

  const runScan = useCallback(
    async (qrCode) => {
      const museum = selectedDetail();
      if (!museum) return null;
      const scanResult = await api.scanArtifact(museum.route_id, buildScanPayload(qrCode));
      analytics.track('scan', {route_id: museum.route_id, artifact_id: scanResult.artifact?.id || ''});
      await Promise.all([
        refreshMuseums(),
        refreshMuseumDetail(museum.id),
        refreshProfileData(),
        loadStory(scanResult.route_id, scanResult.artifact.id),
      ]);
      patch({activeArtifactId: scanResult.artifact.id});
      return scanResult;
    },
    [patch, refreshMuseums, refreshMuseumDetail, refreshProfileData, loadStory, selectedDetail, buildScanPayload],
  );

  const collectActiveArtifact = useCallback(async () => {
    const artifact = activeArtifact();
    if (!artifact) return;
    const qrCode = artifactQrMap[artifact.id] || `qr-${artifact.id}`;
    await runScan(qrCode);
    patch({view: 'artifactReceived'});
    toast.show('Артефакт добавлен в коллекцию', {type: 'success'});
  }, [patch, runScan, toast, activeArtifact]);

  const resolveQrResult = useCallback(
    async (qrValue = '') => {
      const artifactId = readQrArtifactId(qrValue);
      if (!artifactId) return {success: false};
      const museums = [selectedDetail(), ...get().museums].filter(Boolean);
      const targetMuseum = museums.find((museum) => museum.artifacts?.some((artifact) => artifact.id === artifactId));
      if (!targetMuseum) return {success: false};
      await refreshMuseumDetail(targetMuseum.id);
      patch({activeArtifactId: artifactId, view: 'secretCode'});
      return {success: true};
    },
    [patch, refreshMuseumDetail, selectedDetail],
  );

  const toggleFavorite = useCallback(async () => {
    const detail = get().artifactDetail;
    if (!detail) return;
    const updated = await api.setFavorite(visitorId(), detail.id, !detail.is_favorite);
    patch({artifactDetail: updated});
    await refreshProfileData();
    toast.show(updated.is_favorite ? 'Добавлено в избранное' : 'Убрано из избранного', {type: 'info'});
  }, [patch, refreshProfileData, toast, visitorId]);

	const login = useCallback(async ({email, password, register, displayName}) => {
		if (register) await visitorAuth.register({email, password, displayName});
		else await visitorAuth.login({email, password});
		const linkedVisitor = await api.linkAccount({visitorId: visitorId(), accessToken: visitorAuth.accessToken()});
		patch({isAuthenticated: true, visitor: linkedVisitor});
		return linkedVisitor;
	}, [patch, visitorId]);
	const logout = useCallback(() => {
		visitorAuth.logout();
		patch({isAuthenticated: false});
	}, [patch]);

  const completeOnboarding = useCallback(() => {
    try {
      localStorage.setItem('vl_onboarded', '1');
    } catch {
      // storage blocked (private mode) — onboarding still completes
      void 0;
    }
    window.history.replaceState(null, '', '/visitor/');
    patch({view: 'museumSelect'});
  }, [patch]);

  const openStory = useCallback(async () => {
    const artifact = activeArtifact();
    const museum = selectedDetail();
    if (!artifact || !museum) return;
    await loadStory(museum.route_id, artifact.id);
    analytics.track('scene_view', {route_id: museum.route_id, artifact_id: artifact.id});
    patch({view: 'storyExperience'});
  }, [patch, loadStory, activeArtifact, selectedDetail]);

  const enterSecretCode = useCallback(
    async (code) => {
      const museum = selectedDetail();
      const artifact = findArtifactBySecretCode(museum, code);
      if (!artifact) return {success: false};
      // Preserve the current selection if loading the story fails.
      await loadStory(museum.route_id, artifact.id);
      analytics.track('scene_view', {route_id: museum.route_id, artifact_id: artifact.id});
      patch({activeArtifactId: artifact.id, view: 'storyExperience'});
      return {success: true};
    },
    [selectedDetail, loadStory, patch],
  );

  // ---- bootstrap ----
  const bootstrap = useCallback(async () => {
    const wasError = get().loadError;
    patch({loading: true, loadError: false});
    try {
      const visitor = await api.ensureVisitor();
      patch({visitor});
      const museums = await refreshMuseums();

      // Handle direct artifact URL: /a/{artifactId}
      const initialPath = window.location.pathname;
      const artifactUrlMatch = initialPath.match(/^\/a\/([^/?#]+)/);
      if (artifactUrlMatch) {
        const artifactId = decodeURIComponent(artifactUrlMatch[1]);
        const targetMuseum = museums.find((m) => m.artifacts?.some((a) => a.id === artifactId));
        if (targetMuseum) {
          await refreshMuseumDetail(targetMuseum.id);
          patch({activeArtifactId: artifactId, view: 'secretCode'});
          return;
        }
      }

      const firstMuseum = museums[0];
      if (firstMuseum) {
        await refreshMuseumDetail(firstMuseum.id);
        patch({activeArtifactId: selectedDetail()?.artifacts[0]?.id || null});
      }
      await refreshProfileData();
      if (firstMuseum?.route_id) {
        await loadRouteResult(firstMuseum.route_id);
      }
      if (wasError) toast.show('Данные обновлены', {type: 'success'});
    } catch {
      patch({loadError: true});
      toast.show('Не удалось загрузить данные. Проверьте соединение.', {type: 'error'});
    } finally {
      patch({loading: false});
    }
  }, [patch, refreshMuseums, refreshMuseumDetail, refreshProfileData, loadRouteResult, toast, selectedDetail]);

  useEffect(() => {
    bootstrap();
    const onOffline = () => toast.show('Нет подключения к интернету', {type: 'error'});
    const onOnline = () => {
      toast.show('Соединение восстановлено', {type: 'success'});
      if (get().loadError) bootstrap();
    };
    const onPopState = (e) => {
      const view = e.state?.view || getViewFromPath(window.location.pathname);
      patch({view});
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('popstate', onPopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    navigate,
    actions: {
      selectMuseum,
      selectArtifact,
      openArtifactFromCollection,
      collectActiveArtifact,
      resolveQrResult,
      enterSecretCode,
      toggleFavorite,
      openStory,
      loadRouteResult,
      loadStory,
      trackEvent: analytics.track,
      refreshProfileData,
      bootstrap,
      completeOnboarding,
      login,
      logout,
    },
  };
}
