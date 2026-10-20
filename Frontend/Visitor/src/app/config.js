const defaultConfig = {
  apiMode: 'auto',
	apiBaseUrl: import.meta.env?.VITE_VISITOR_API_URL || '/api/visitor/api/v1',
	authApiUrl: import.meta.env?.VITE_AUTH_API_URL || '/api/auth/api/v1',
  artifactsApiUrl: import.meta.env?.VITE_ARTIFACTS_API_URL || '/api/artifacts/api/v1',
  analyticsEventsUrl: import.meta.env?.VITE_ANALYTICS_EVENTS_URL || '/api/analytics/api/v1/analytics/events',
};

export const appConfig = {
  ...defaultConfig,
  ...(window.__VIRALABS_CONFIG__ || {}),
};
