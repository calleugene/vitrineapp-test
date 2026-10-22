import {SESSION_STORAGE_KEY} from './config';
import {MOCK_AUTH_CREDENTIALS, MOCK_AUTH_USER} from './mock-auth';

export function readStoredSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function persistSession(session) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!session) {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function isServiceUnavailableError(error) {
  return error?.code === 'service_unavailable' || error?.message === 'service_unavailable';
}

export function isMockCredentials(email, password) {
  return email === MOCK_AUTH_CREDENTIALS.email && password === MOCK_AUTH_CREDENTIALS.password;
}

export function createMockSession() {
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    tokenType: 'Bearer',
    user: MOCK_AUTH_USER,
    isMock: true,
  };
}
