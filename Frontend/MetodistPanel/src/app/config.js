function normalizeBaseUrl(value) {
  return value.replace(/\/$/, '');
}

function defaultServiceUrl(service, port) {
  return import.meta.env.PROD ? `/api/${service}` : `http://localhost:${port}`;
}

export const API_URLS = {
  auth: normalizeBaseUrl(import.meta.env.VITE_AUTH_API_URL || defaultServiceUrl('auth', 8080)),
  artifacts: normalizeBaseUrl(import.meta.env.VITE_ARTIFACTS_API_URL || defaultServiceUrl('artifacts', 8081)),
  routes: normalizeBaseUrl(import.meta.env.VITE_ROUTE_API_URL || '/api/route'),
  dashboard: normalizeBaseUrl(import.meta.env.VITE_DASHBOARD_API_URL || '/api/dashboard'),
  analytics: normalizeBaseUrl(import.meta.env.VITE_ANALYTICS_API_URL || '/api/analytics'),
  feedback: normalizeBaseUrl(import.meta.env.VITE_FEEDBACK_API_URL || '/api/feedback'),
  notifications: normalizeBaseUrl(import.meta.env.VITE_NOTIFICATION_API_URL || '/api/notification'),
};

export const API_PREFIX = '/api/v1';
export const DEFAULT_MUSEUM_ID = import.meta.env.VITE_MUSEUM_ID || 'mus_001';
export const DEFAULT_USER_ID = import.meta.env.VITE_NOTIFICATION_USER_ID || 'usr_001';
export const ROUTE_API_ENABLED = import.meta.env.VITE_ROUTE_API_ENABLED !== 'false';

// Keep storage keys stable so existing sessions and route drafts remain readable.
export const SESSION_STORAGE_KEY = 'vira-methodist-session';
export const ROUTE_DRAFT_STORAGE_KEY = 'vira-methodist-route-draft';
