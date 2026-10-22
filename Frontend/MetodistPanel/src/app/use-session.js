import {useCallback, useEffect, useState} from 'react';
import {authApi} from '../api';
import {ensureMuseumSession} from './museum-session';
import {DEFAULT_VIEW} from './routes';
import {createMockSession, isMockCredentials, isServiceUnavailableError, persistSession, readStoredSession} from './session-storage';

export function useSession({setView}) {
  const [session, setSession] = useState(() => readStoredSession());
  const [sessionChecking, setSessionChecking] = useState(() => Boolean(readStoredSession()?.accessToken && !readStoredSession()?.isMock));
  const [sessionCheckError, setSessionCheckError] = useState('');
  const [checkRevision,setCheckRevision] = useState(0);
  const [authTab, setAuthTab] = useState('login');
  const [authForm, setAuthForm] = useState({
    loginEmail: window.localStorage.getItem('vitrina-remembered-email') || '',
    rememberMe: Boolean(window.localStorage.getItem('vitrina-remembered-email')),
    loginPassword: '',
    registerFullName: '',
    registerEmail: '',
    registerPassword: '',
  });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const isAuthenticated = Boolean(session?.accessToken && (session?.isMock || session?.user?.role !== 'methodist' || session?.user?.museum_id));
  const needsMuseumContext = Boolean(session?.accessToken && session?.user?.role === 'methodist' && !session?.user?.museum_id && !session?.isMock);
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

  useEffect(() => {
    if (!session?.accessToken || session.isMock) {setSessionChecking(false); return undefined;}
    let cancelled = false;
    setSessionChecking(true); setSessionCheckError('');
    authApi.me(session.accessToken).then(({user}) => {if (!cancelled) updateSession({...session, user});}).catch((error) => {
      if (cancelled) return;
      if (error?.status === 401 || error?.status === 403) clearSession({authErrorMessage:'Сессия завершена. Войдите снова.'});
      else setSessionCheckError('Не удалось проверить статус аккаунта. Повторите попытку.');
    }).finally(() => {if (!cancelled) setSessionChecking(false);});
    return () => {cancelled = true;};
  // A token changes only on login, refresh or switching museum; profile edits do not restart this check.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, checkRevision, updateSession, clearSession]);

  const handleLogin = useCallback(async (credentials) => {
    setAuthLoading(true);
    setAuthError('');

    try {
      const email = (credentials?.email ?? authForm.loginEmail).trim();
      const password = credentials?.password ?? authForm.loginPassword;

      if (authForm.rememberMe) window.localStorage.setItem('vitrina-remembered-email', email);
      else window.localStorage.removeItem('vitrina-remembered-email');
      const tokenResponse = await authApi.login({
        email,
        password,
      });
      const meResponse = await authApi.me(tokenResponse.accessToken);
      const loginSession = {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken,
        tokenType: tokenResponse.tokenType,
        user: meResponse.user,
      };

      updateSession(loginSession);
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
  }, [authForm.loginEmail, authForm.loginPassword, authForm.rememberMe, setView, updateSession]);

  const handleProvisionMuseum = useCallback(async () => {
    if (!needsMuseumContext) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const nextSession = await ensureMuseumSession(session, authApi);
      updateSession(nextSession);
      setView(DEFAULT_VIEW, {replace: true});
    } catch {
      setAuthError('Не удалось создать музей. Проверьте подключение и повторите попытку.');
    } finally {
      setAuthLoading(false);
    }
  }, [needsMuseumContext, session, setView, updateSession]);

  const handleRegister = useCallback(async (consents) => {
    setAuthLoading(true);
    setAuthError('');

    try {
      const email = authForm.registerEmail.trim();
      const password = authForm.registerPassword;

      await authApi.register({
        email,
        password,
        full_name: authForm.registerFullName.trim(),
        consents,
      });

      setAuthForm((prev) => ({
        ...prev,
        loginEmail: email,
        loginPassword: '',
        registerPassword: '',
      }));
      setAuthTab('login');
      await handleLogin({email, password});
    } catch (error) {
      const messages = {
        email_already_exists: 'Аккаунт с этой почтой уже существует. Войдите или восстановите пароль.',
        bad_request: 'Проверьте email, имя, пароль (не менее 12 символов) и согласие на обработку данных. Если страница давно открыта, обновите её.',
        invalid_json: 'Сервер регистрации требует обновления. Повторите попытку позже.',
        service_unavailable: 'Сервис регистрации временно недоступен. Повторите попытку позже.',
      };
      setAuthError(messages[error?.code] || 'Не удалось зарегистрироваться. Повторите попытку позже.');
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
    sessionChecking,
    sessionCheckError,
    retrySessionCheck: () => setCheckRevision((prev) => prev + 1),
    authTab,
    setAuthTab,
    authForm,
    setAuthForm,
    authError,
    setAuthError,
    authLoading,
    isAuthenticated,
    needsMuseumContext,
    currentUser,
    updateSession,
    clearSession,
    handleLogin,
    handleProvisionMuseum,
    handleRegister,
    handleLogout,
  };
}
