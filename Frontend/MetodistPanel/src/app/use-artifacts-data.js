import {useEffect, useEffectEvent, useState} from 'react';
import {artifactsApi, authApi} from '../api';

export function useArtifactsData({
  session,
  isAuthenticated,
  onSessionRefresh,
  onUnauthorized,
  loadConnectedData,
}) {
  const [artifacts, setArtifacts] = useState([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactsError, setArtifactsError] = useState('');

  const loadConnectedDataEvent = useEffectEvent(loadConnectedData);
  const onUnauthorizedEvent = useEffectEvent(onUnauthorized);
  const refreshUserEvent = useEffectEvent((user) => onSessionRefresh({...session, user}));
  const accessToken = session?.accessToken;
  const isMock = session?.isMock;

  const loadArtifacts = async () => {
    setArtifactsLoading(true);
    setArtifactsError('');
    try {
      const response = await artifactsApi.list();
      setArtifacts(response?.artifacts ?? []);
    } catch {
      setArtifacts([]);
      setArtifactsError('Не удалось загрузить артефакты. Проверьте, что ArtifactsService запущен на 8081 порту.');
    } finally {
      setArtifactsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return undefined;
    }

    let cancelled = false;

    const bootstrap = async () => {
      if (isMock) {
        try {
          const [artifactsResponse] = await Promise.all([artifactsApi.list(), loadConnectedDataEvent()]);

          if (cancelled) {
            return;
          }

          setArtifacts(artifactsResponse?.artifacts ?? []);
          setArtifactsError('');
        } catch {
          if (!cancelled) {
            setArtifacts([]);
            setArtifactsError('Mock-пользователь вошёл без AuthService. ArtifactsService сейчас недоступен.');
          }
        } finally {
          if (!cancelled) {
            setArtifactsLoading(false);
          }
        }

        return;
      }

      try {
        const [meResponse, artifactsResponse] = await Promise.all([
          authApi.me(accessToken),
          artifactsApi.list(),
        ]);

        await loadConnectedDataEvent();

        if (cancelled) {
          return;
        }

        refreshUserEvent(meResponse.user);
        setArtifacts(artifactsResponse?.artifacts ?? []);
        setArtifactsError('');
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error.message === 'unauthorized') {
          onUnauthorizedEvent();
          return;
        }

        setArtifacts([]);
        setArtifactsError('Не удалось загрузить артефакты. Проверьте, что AuthService и ArtifactsService доступны.');
      } finally {
        if (!cancelled) {
          setArtifactsLoading(false);
        }
      }
    };

    setArtifactsLoading(true);
    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken, isMock]);

  return {
    artifacts,
    artifactsLoading,
    artifactsError,
    loadArtifacts,
    setArtifacts,
    setArtifactsError,
  };
}
