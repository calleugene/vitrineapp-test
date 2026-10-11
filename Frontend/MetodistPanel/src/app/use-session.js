import {useCallback, useState} from 'react';
import {authApi} from '../api';
import {DEFAULT_VIEW} from './routes';
import {createMockSession, isMockCredentials, isServiceUnavailableError, persistSession, readStoredSession} from './utils';

export function useSession({setView}) {
  const [session, setSession] = useState(() => readStoredSession());
  const [authTab, setAuthTab] = useState('login');
  const [authForm, setAuthForm] = useState({
    loginEmail: '',
    loginPassword: '',
    registerFullName: '',
    registerEmail: '',
    registerPassword: '',
  });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const isAuthenticated = Boolean(session?.accessToken);
  const currentUser = session?.user ?? null;

  const updateSession = useCallback((nextSession) => {
    setSession(nextSession);
    persistSession(nextSession);
  }, []);

  const clearSession = useCallback(({authErrorMessage = '', resetAuthTab = false} = {}) => {
    setSession(null);
    persistSession(null);

    if (authErrorMessage) {
      setAuthError(authErrorMessage);
    }

    if (resetAuthTab) {
      setAuthTab('login');
    }
  }, []);

  const handleLogin = useCallback(async (credentials) => {
    setAuthLoading(true);
    setAuthError('');

    try {
      const email = (credentials?.email ?? authForm.loginEmail).trim();
      const password = credentials?.password ?? authForm.loginPassword;

      const tokenResponse = await authApi.login({
        email,
        password,
      });
      const meResponse = await authApi.me(tokenResponse.accessToken);
      const nextSession = {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        tokenType: tokenResponse.tokenType,
        user: meResponse.user,
      };

      updateSession(nextSession);
      setView(DEFAULT_VIEW, {replace: true});
      setAuthForm((prev) => ({...prev, loginEmail: email, loginPassword: ''}));
    } catch (error) {
      const email = (credentials?.email ?? authForm.loginEmail).trim();
      const password = credentials?.password ?? authForm.loginPassword;

      if (isServiceUnavailableError(error) && isMockCredentials(email, password)) {
        updateSession(createMockSession());
        setView(DEFAULT_VIEW, {replace: true});
        setAuthForm((prev) => ({...prev, loginEmail: email, loginPassword: ''}));
        return;
      }

      setAuthError('Не удалось войти. Проверьте email и пароль, затем попробуйте снова.');
    } finally {
      setAuthLoading(false);
    }
  }, [authForm.loginEmail, authForm.loginPassword, setView, updateSession]);

  const handleRegister = useCallback(async () => {
    setAuthLoading(true);
    setAuthError('');

    try {
      const email = authForm.registerEmail.trim();
      const password = authForm.registerPassword;

      await authApi.register({
        email,
        password,
        full_name: authForm.registerFullName.trim(),
      });

      setAuthForm((prev) => ({
        ...prev,
        loginEmail: email,
        loginPassword: password,
      }));
      setAuthTab('login');
      await handleLogin({email, password});
    } catch {
      setAuthError('Не удалось зарегистрироваться. Проверьте форму и попробуйте снова.');
    } finally {
      setAuthLoading(false);
    }
  }, [authForm.registerEmail, authForm.registerFullName, authForm.registerPassword, handleLogin]);

  const handleLogout = useCallback(async () => {
    const accessToken = session?.accessToken;
    const refreshToken = session?.refreshToken;

    try {
      if (accessToken && refreshToken && !session?.isMock) {
        await authApi.logout(accessToken, refreshToken);
      }
    } catch {
      // Logout should still clear the local session even if the API is unavailable.
    } finally {
      clearSession({resetAuthTab: true});
      setView(DEFAULT_VIEW, {replace: true});
    }
  }, [clearSession, session, setView]);

  return {
    session,
    authTab,
    setAuthTab,
    authForm,
    setAuthForm,
    authError,
    setAuthError,
    authLoading,
    isAuthenticated,
    currentUser,
    updateSession,
    clearSession,
    handleLogin,
    handleRegister,
    handleLogout,
  };
}
