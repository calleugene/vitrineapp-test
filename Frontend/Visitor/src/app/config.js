const defaultConfig = {
  apiMode: 'auto',
	apiBaseUrl: import.meta.env.VITE_VISITOR_API_URL || 'http://127.0.0.1:8088/api/v1',
	authApiUrl: import.meta.env.VITE_AUTH_API_URL || 'http://127.0.0.1:8080/api/v1',
  artifactsApiUrl: import.meta.env.VITE_ARTIFACTS_API_URL || 'http://127.0.0.1:8081/api/v1',
  analyticsEventsUrl: '',
};

export const appConfig = {
  ...defaultConfig,
  ...(window.__VIRALABS_CONFIG__ || {}),
};
