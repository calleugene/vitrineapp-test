function normalizeBaseUrl(value) {
  return value.replace(/\/$/, '');
}

const AUTH_API_URL = normalizeBaseUrl(import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8080');
const ARTIFACTS_API_URL = normalizeBaseUrl(import.meta.env.VITE_ARTIFACTS_API_URL || 'http://localhost:8081');
const ROUTE_API_URL = normalizeBaseUrl(import.meta.env.VITE_ROUTE_API_URL || 'http://localhost:8083');
const DASHBOARD_API_URL = normalizeBaseUrl(import.meta.env.VITE_DASHBOARD_API_URL || 'http://localhost:8084');
const ANALYTICS_API_URL = normalizeBaseUrl(import.meta.env.VITE_ANALYTICS_API_URL || 'http://localhost:8085');
const FEEDBACK_API_URL = normalizeBaseUrl(import.meta.env.VITE_FEEDBACK_API_URL || 'http://localhost:8086');
const NOTIFICATION_API_URL = normalizeBaseUrl(import.meta.env.VITE_NOTIFICATION_API_URL || 'http://localhost:8087');
const API_PREFIX = '/api/v1';
const DEFAULT_MUSEUM_ID = import.meta.env.VITE_MUSEUM_ID || 'mus_001';
const DEFAULT_USER_ID = import.meta.env.VITE_NOTIFICATION_USER_ID || 'usr_001';
const JSON_CONTENT_TYPE = 'application/json';

class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code || null;
    this.status = options.status || null;
    this.payload = options.payload;
    this.cause = options.cause;
  }
}

function isFormData(value) {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

function shouldSetJsonContentType(body, headers) {
  if (!body || isFormData(body)) {
    return false;
  }

  return !Object.keys(headers).some((headerName) => headerName.toLowerCase() === 'content-type');
}

function createQueryString(query) {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) {
      return;
    }

    params.set(key, String(value));
  });

  const search = params.toString();
  return search ? `?${search}` : '';
}

function isJsonResponse(response) {
  return response.headers.get('content-type')?.includes(JSON_CONTENT_TYPE);
}

async function parseResponseBody(response) {
  if (response.status === 204) {
    return null;
  }

  if (isJsonResponse(response)) {
    return response.json().catch(() => null);
  }

  return response.text().catch(() => null);
}

function jsonOptions(method, body, headers = {}) {
  return {
    method,
    body: JSON.stringify(body),
    headers,
  };
}

async function request(baseUrl, path, options = {}) {
  let response;
  const {query, headers: headersFromOptions = {}, body, ...restOptions} = options;
  const headers = {...headersFromOptions};

  if (shouldSetJsonContentType(body, headers)) {
    headers['Content-Type'] = JSON_CONTENT_TYPE;
  }

  try {
    response = await fetch(`${baseUrl}${path}${createQueryString(query)}`, {
      ...restOptions,
      body,
      headers,
    });
  } catch (error) {
    throw new ApiError('service_unavailable', {
      code: 'service_unavailable',
      cause: error,
    });
  }

  const payload = await parseResponseBody(response);
  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && (payload.error || payload.message)) ||
      (typeof payload === 'string' && payload) ||
      `HTTP ${response.status}`;

    throw new ApiError(message, {
      code: typeof payload === 'object' ? payload?.code : null,
      status: response.status,
      payload,
    });
  }

  return payload;
}

function normalizeTokenPayload(payload) {
  if (!payload) {
    return payload;
  }

  return {
    ...payload,
    accessToken: payload.accessToken ?? payload.access_token ?? '',
    refreshToken: payload.refreshToken ?? payload.refresh_token ?? '',
    tokenType: payload.tokenType ?? payload.token_type ?? '',
    expiresIn: payload.expiresIn ?? payload.expires_in ?? 0,
  };
}

export const authApi = {
  login: async (body) => normalizeTokenPayload(await request(AUTH_API_URL, `${API_PREFIX}/auth/login`, jsonOptions('POST', body))),
  register: (body) => request(AUTH_API_URL, `${API_PREFIX}/auth/register`, jsonOptions('POST', body)),
  logout: (accessToken, refreshToken) =>
    request(AUTH_API_URL, `${API_PREFIX}/auth/logout`, {
      headers: {Authorization: `Bearer ${accessToken}`},
      ...jsonOptions('POST', {refresh_token: refreshToken, refreshToken}),
    }),
  me: (accessToken) =>
    request(AUTH_API_URL, `${API_PREFIX}/auth/me`, {
      headers: {Authorization: `Bearer ${accessToken}`},
    }),
  getUser: (userId) => request(AUTH_API_URL, `${API_PREFIX}/users/${userId}`),
  updateUser: (userId, body) => request(AUTH_API_URL, `${API_PREFIX}/users/${userId}`, jsonOptions('PATCH', body)),
  getRoles: (userId) => request(AUTH_API_URL, `${API_PREFIX}/users/${userId}/roles`),
  getMuseums: (userId) => request(AUTH_API_URL, `${API_PREFIX}/users/${userId}/museums`),
  getActivity: (userId) => request(AUTH_API_URL, `${API_PREFIX}/users/${userId}/activity`),
  blockUser: (userId) => request(AUTH_API_URL, `${API_PREFIX}/users/${userId}/block`, {method: 'POST'}),
  unblockUser: (userId) => request(AUTH_API_URL, `${API_PREFIX}/users/${userId}/unblock`, {method: 'POST'}),
};

export const artifactsApi = {
  list: (query) => request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts`, {query, headers: museumHeaders()}),
  get: (artifactId) => request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}`, {headers: museumHeaders()}),
  create: (body) => request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts`, {...jsonOptions('POST', body), headers: museumHeaders()}),
  update: (artifactId, body) =>
    request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}`, {...jsonOptions('PATCH', body), headers: museumHeaders()}),
	archive: (artifactId) => request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}/archive`, {method: 'POST', headers: museumHeaders()}),
	restore: (artifactId) => request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}/restore`, {method: 'POST', headers: museumHeaders()}),
  remove: (artifactId) => request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}`, {method: 'DELETE', headers: museumHeaders()}),
  duplicate: (artifactId) => request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}/duplicate`, {method: 'POST', headers: museumHeaders()}),
  createScreen: (artifactId, body) =>
    request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}/screens`, {...jsonOptions('POST', body), headers: museumHeaders()}),
  uploadScreenImage: (artifactId, screenId, file) => {
    const body = new FormData();
    body.append('file', file);
    return request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}/screens/${screenId}/image`, {method: 'POST', body, headers: museumHeaders()});
  },
  listScreens: (artifactId) => request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}/screens`, {headers: museumHeaders()}),
  updateScreen: (artifactId, screenId, body) => request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}/screens/${screenId}`, {...jsonOptions('PATCH', body), headers: museumHeaders()}),
  removeScreen: (artifactId, screenId) => request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}/screens/${screenId}`, {method: 'DELETE', headers: museumHeaders()}),
  reorderScreens: (artifactId, items) => request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}/screens/reorder`, {...jsonOptions('PUT', {items}), headers: museumHeaders()}),
  duplicateScreen: (artifactId, screenId) => request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}/screens/${screenId}/duplicate`, {method: 'POST', headers: museumHeaders()}),
  publish: (artifactId, expectedDraftRevision) => request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}/publish`, {...jsonOptions('POST', {expected_draft_revision: expectedDraftRevision}), headers: museumHeaders()}),
  getQRCode: async (artifactId) => {
    let response;
    try {
      response = await fetch(`${ARTIFACTS_API_URL}${API_PREFIX}/artifacts/${artifactId}/qr.png`, {headers: museumHeaders()});
    } catch (cause) {
      throw new ApiError('service_unavailable', {code: 'service_unavailable', cause});
    }
    if (!response.ok) {
      throw new ApiError(`HTTP ${response.status}`, {status: response.status});
    }
    return response.blob();
  },
  uploadCover: (artifactId, file) => {
    const body = new FormData();
    body.append('file', file);
    return request(ARTIFACTS_API_URL, `${API_PREFIX}/artifacts/${artifactId}/cover`, {method: 'POST', body, headers: museumHeaders()});
  },
};

function museumHeaders(museumId = DEFAULT_MUSEUM_ID, headers = {}) {
	let accessToken = '';
	try {
		accessToken = JSON.parse(window.localStorage.getItem('vira-methodist-session') || '{}').accessToken || '';
	} catch {
		// The API will return unauthorized if the locally stored session is malformed.
	}
	return {
		'X-Museum-ID': museumId,
		...(accessToken ? {Authorization: `Bearer ${accessToken}`} : {}),
		...headers,
	};
}

export const museumApi = {
  getProfile: (museumId) => request(ARTIFACTS_API_URL, `${API_PREFIX}/museums/profile`, {headers: museumHeaders(museumId)}),
  createProfile: (body, museumId) => request(ARTIFACTS_API_URL, `${API_PREFIX}/museums/profile`, {...jsonOptions('POST', body), headers: museumHeaders(museumId)}),
  updateProfile: (body, museumId) => request(ARTIFACTS_API_URL, `${API_PREFIX}/museums/profile`, {...jsonOptions('PATCH', body), headers: museumHeaders(museumId)}),
};

export const routeApi = {
  list: ({status = '', page = 1, limit = 20, museumId} = {}) =>
    request(ROUTE_API_URL, `${API_PREFIX}/routes`, {
      query: {status, page, limit},
      headers: museumHeaders(museumId),
    }),
  summary: (museumId) => request(ROUTE_API_URL, `${API_PREFIX}/routes/summary`, {headers: museumHeaders(museumId)}),
  recentActivity: (museumId) => request(ROUTE_API_URL, `${API_PREFIX}/routes/recent-activity`, {headers: museumHeaders(museumId)}),
  get: (routeId, museumId) => request(ROUTE_API_URL, `${API_PREFIX}/routes/${routeId}`, {headers: museumHeaders(museumId)}),
  create: (body, museumId) => request(ROUTE_API_URL, `${API_PREFIX}/routes`, {headers: museumHeaders(museumId), ...jsonOptions('POST', body)}),
  update: (routeId, body, museumId) => request(ROUTE_API_URL, `${API_PREFIX}/routes/${routeId}`, {headers: museumHeaders(museumId), ...jsonOptions('PATCH', body)}),
  remove: (routeId, museumId) => request(ROUTE_API_URL, `${API_PREFIX}/routes/${routeId}`, {headers: museumHeaders(museumId), method: 'DELETE'}),
  addArtifact: (routeId, body, museumId) => request(ROUTE_API_URL, `${API_PREFIX}/routes/${routeId}/artifacts`, {headers: museumHeaders(museumId), ...jsonOptions('POST', body)}),
  removeArtifact: (routeId, artifactId, museumId) => request(ROUTE_API_URL, `${API_PREFIX}/routes/${routeId}/artifacts/${artifactId}`, {headers: museumHeaders(museumId), method: 'DELETE'}),
  reorderArtifacts: (routeId, artifactIds, museumId) => request(ROUTE_API_URL, `${API_PREFIX}/routes/${routeId}/artifacts/reorder`, {headers: museumHeaders(museumId), ...jsonOptions('PUT', {artifact_ids: artifactIds})}),
};

export const dashboardApi = {
  summary: () => request(DASHBOARD_API_URL, `${API_PREFIX}/dashboard/summary`),
  attendance: (period = 'month') =>
    request(DASHBOARD_API_URL, `${API_PREFIX}/dashboard/attendance`, {query: {period}}),
  popularRoutes: () => request(DASHBOARD_API_URL, `${API_PREFIX}/dashboard/popular-routes`),
  recentActivity: () => request(DASHBOARD_API_URL, `${API_PREFIX}/dashboard/recent-activity`),
  feedback: () => request(DASHBOARD_API_URL, `${API_PREFIX}/dashboard/feedback`),
};

export const feedbackApi = {
  list: ({type = '', replyStatus = '', page = 1, limit = 20, museumId} = {}) =>
    request(FEEDBACK_API_URL, `${API_PREFIX}/feedback`, {
      query: {type, reply_status: replyStatus, page, limit},
      headers: museumHeaders(museumId),
    }),
};

export const notificationApi = {
  list: ({unreadOnly = false, userId = DEFAULT_USER_ID, page = 1, limit = 20} = {}) =>
    request(NOTIFICATION_API_URL, `${API_PREFIX}/notifications`, {
      query: {unread: unreadOnly ? 'true' : '', page, limit},
      headers: {'X-User-ID': userId},
    }),
};

export const analyticsApi = {
  visitorsSummary: (period = 'month') =>
    request(ANALYTICS_API_URL, `${API_PREFIX}/visitors/summary`, {query: {period}}),
  visitorsDynamics: (period = 'month', series = 'visitors') =>
    request(ANALYTICS_API_URL, `${API_PREFIX}/visitors/dynamics`, {
      query: {period, series},
    }),
  visitorsSources: () => request(ANALYTICS_API_URL, `${API_PREFIX}/visitors/sources`),
  visitorsList: ({page = 1, limit = 10, sortBy = '', sortDir = '', routeId = ''} = {}) =>
    request(ANALYTICS_API_URL, `${API_PREFIX}/visitors/list`, {
      query: {page, limit, sort_by: sortBy, sort_dir: sortDir, route_id: routeId},
    }),
  statsSummary: (tab, period = 'month') =>
    request(ANALYTICS_API_URL, `${API_PREFIX}/stats/${encodeURIComponent(tab)}/summary`, {query: {period}}),
  statsChart: (tab, period = 'month') =>
    request(ANALYTICS_API_URL, `${API_PREFIX}/stats/${encodeURIComponent(tab)}/chart`, {query: {period}}),
  statsBreakdown: (tab) => request(ANALYTICS_API_URL, `${API_PREFIX}/stats/${encodeURIComponent(tab)}/breakdown`),
  statsRanked: (tab) => request(ANALYTICS_API_URL, `${API_PREFIX}/stats/${encodeURIComponent(tab)}/ranked`),
  statsBars: (tab) => request(ANALYTICS_API_URL, `${API_PREFIX}/stats/${encodeURIComponent(tab)}/bars`),
};

export {
  ANALYTICS_API_URL,
  ARTIFACTS_API_URL,
  AUTH_API_URL,
  DASHBOARD_API_URL,
  DEFAULT_MUSEUM_ID,
  DEFAULT_USER_ID,
  FEEDBACK_API_URL,
  NOTIFICATION_API_URL,
  ROUTE_API_URL,
};
