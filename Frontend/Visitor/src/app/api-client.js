import {mockData} from './mock-data.js';

const global = window;

	const VISITOR_STORAGE_KEY = "viralabs.visitor.id";
	const GUEST_LINK_TOKEN_STORAGE_KEY = 'viralabs.visitor.guest-link-token';
	const ACCESS_TOKEN_STORAGE_KEY = 'viralabs.visitor.access-token';
	const REFRESH_TOKEN_STORAGE_KEY = 'viralabs.visitor.refresh-token';
  const PUBLIC_COLLECTED_ARTIFACTS_KEY = 'viralabs.public.collected-artifacts';

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function getStoredVisitorId() {
    try {
      return global.localStorage.getItem(VISITOR_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function isUUID(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
  }

	function isVisitorID(value) {
		return isUUID(value) || /^(gst|acc)_[a-f0-9]{32}$/i.test(value || '');
	}

	function setStoredVisitorId(visitorId) {
	  try {
	    global.localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
	  } catch {
	    // noop
	}
	}

	function getStoredGuestLinkToken() {
		try { return global.localStorage.getItem(GUEST_LINK_TOKEN_STORAGE_KEY) || ''; } catch { return ''; }
	}

	function setStoredGuestLinkToken(token) {
		try { global.localStorage.setItem(GUEST_LINK_TOKEN_STORAGE_KEY, token); } catch { /* noop */ }
	}

  function publicCollectedArtifactIDs() {
    try {
      const value = JSON.parse(global.localStorage.getItem(PUBLIC_COLLECTED_ARTIFACTS_KEY) || '[]');
      return new Set(Array.isArray(value) ? value : []);
    } catch {
      return new Set();
    }
  }

  function createMockApi(config = {}) {
    const db = config.publicCatalog ? {museums: []} : clone(mockData);
    const testMuseumId = 'viralabs-test-museum';
    const artifactsApiUrl = (config.artifactsApiUrl || 'http://127.0.0.1:8081/api/v1').replace(/\/$/, '');
    let lastTestMuseumSync = 0;
    let visitor = {
      id: getStoredVisitorId() || "mock-visitor-1",
      display_name: "Исследователь",
      is_guest: true,
      locale: "ru"
    };
    setStoredVisitorId(visitor.id);

    function toMuseumCard(museum) {
      const foundArtifacts = museum.artifacts.filter((artifact) => artifact.found).length;
		return {
        id: museum.id,
        name: museum.title,
        city: museum.city || "",
        description: museum.subtitle,
        cover_image_url: museum.coverImageUrl || "",
        total_artifacts: museum.artifacts.length,
        found_artifacts: foundArtifacts,
        estimated_minutes: parseInt(museum.durationLabel.replace(/[^\d]/g, ""), 10) || 0,
        status: foundArtifacts >= museum.artifacts.length ? "completed" : foundArtifacts > 0 ? "in_progress" : "new",
        route_id: `${museum.id}-route`,
        route_title: museum.title
      };
    }

    function toArtifactCard(museum, artifact) {
      return {
        id: artifact.id,
        title: artifact.title,
        subtitle: artifact.summary,
        description: artifact.summary,
        image_url: "",
        route_order: museum.artifacts.findIndex((item) => item.id === artifact.id) + 1,
        found: artifact.found,
        is_favorite: false,
        found_at: artifact.found ? new Date().toISOString() : null,
        story_duration_sec: 90,
        answer_correct: true,
        ar_moment_completed: true,
        replay_route_id: `${museum.id}-route`,
        replay_artifact_id: artifact.id,
        museum_id: museum.id,
        museum_name: museum.title,
        secretCode: artifact.secretCode,
        publicCode: artifact.publicCode || ''
      };
    }

    function makePublishedStory(artifact) {
      return {
        topTitle: artifact.title,
        coverTitle: artifact.title,
        coverSubtitle: artifact.summary || 'История экспоната',
        coverImage: artifact.coverUrl || '',
        factOneTitle: artifact.title,
        factOneText: artifact.summary || 'Откройте историю экспоната.',
        finalTitle: 'История доступна',
        finalText: 'Нажмите на карточку, чтобы открыть просмотр экспоната.'
      };
    }

    async function syncTestMuseum() {
      // Keep the test profile useful without making the standard mock data
      // dependent on a local backend. A failed local request is intentionally
      // ignored: the rest of Visitor must remain usable offline.
      if (Date.now() - lastTestMuseumSync < 3000) return;
      try {
        const profiles = config.publicCatalog
          ? (await fetchJson(`${artifactsApiUrl}/public/museums`, {cache: 'no-store'})).museums
          : [{museum_id: 'mus_001'}];
        const syncedMuseums = [];
        for (const entry of profiles) {
        const museumId = entry.museum_id;
        const [profileResponse, artifactsResponse] = await Promise.all([
          global.fetch(`${artifactsApiUrl}/public/museums/${encodeURIComponent(museumId)}`, {cache: 'no-store'}),
          global.fetch(`${artifactsApiUrl}/public/museums/${encodeURIComponent(museumId)}/artifacts`, {cache: 'no-store'})
        ]);
        // A museum becomes visible only after the methodist has created its profile.
        if (!profileResponse.ok || !artifactsResponse.ok) {
          if (config.publicCatalog) throw new Error('Не удалось загрузить экспозицию музея');
          return;
        }
        const [profilePayload, payload] = await Promise.all([profileResponse.json(), artifactsResponse.json()]);
        const profile = profilePayload.museum || {};
        const artifacts = Array.isArray(payload.artifacts) ? payload.artifacts : [];
        const collectedIDs = publicCollectedArtifactIDs();
        const museum = {
          id: config.publicCatalog ? museumId : testMuseumId,
          title: profile.name || 'Музей',
          subtitle: profile.short_description || profile.description || 'Экспонаты музея.',
          durationLabel: `примерно ${Math.max(artifacts.length * 2, 1)} мин.`,
          heroCaption: profile.short_description || 'Экспозиция музея',
          hours: '',
          website: profile.website || '',
          address: profile.address || '',
          coverImageUrl: profile.logo_url || '',
          category: '',
          about: profile.description || profile.short_description || '',
          artifacts: artifacts.map((artifact) => ({
            id: artifact.id,
            title: artifact.title || 'Без названия',
            summary: artifact.short_description || artifact.description || 'Описание пока не добавлено.',
            coverUrl: artifact.cover_url || '',
            found: collectedIDs.has(artifact.id),
            secretCode: artifact.public_code || artifact.id,
            publicCode: artifact.public_code || '',
            story: makePublishedStory({
              title: artifact.title || 'Без названия',
              summary: artifact.short_description || artifact.description || '',
              coverUrl: artifact.cover_url || ''
            })
          }))
        };
        syncedMuseums.push(museum);
        const index = db.museums.findIndex((item) => item.id === museum.id);
        if (index >= 0) db.museums[index] = museum;
        else db.museums.unshift(museum);
        }
        if (config.publicCatalog) db.museums = syncedMuseums;
        lastTestMuseumSync = Date.now();
      } catch (error) {
        if (config.publicCatalog) throw error;
        // The service may be stopped during local work. Do not break Visitor.
      }
    }

    return {
			async ensureVisitor() {
        return visitor;
			},
			async linkAccount() { return visitor; },
      async listMuseums() {
        await syncTestMuseum();
        return db.museums.map(toMuseumCard);
      },
      async getMuseum(museumId) {
        await syncTestMuseum();
        const museum = db.museums.find((item) => item.id === museumId);
        if (!museum) throw new Error('museum not found');
        return {
          id: museum.id,
          name: museum.title,
          city: museum.city || "",
          description: museum.subtitle,
          about: museum.about || "",
          category: museum.category || "",
          cover_image_url: museum.coverImageUrl || "",
          hours: museum.hours || "",
          website: museum.website || "",
          address: museum.address || "",
          route_id: `${museum.id}-route`,
          route_title: museum.title,
          found_artifacts: museum.artifacts.filter((artifact) => artifact.found).length,
          total_artifacts: museum.artifacts.length,
          estimated_minutes: parseInt(museum.durationLabel.replace(/[^\d]/g, ""), 10) || 0,
          artifacts: museum.artifacts.map((artifact) => toArtifactCard(museum, artifact))
        };
      },
      async scanArtifact(routeId, payload) {
        const museum = db.museums.find((item) => `${item.id}-route` === routeId);
        const artifact =
          museum.artifacts.find((item) => item.id === payload.qr_code) ||
          museum.artifacts.find((item) => !item.found) ||
          museum.artifacts[0];
        artifact.found = true;
        return {
          artifact: toArtifactCard(museum, artifact),
          route_id: routeId,
          found_artifacts: museum.artifacts.filter((item) => item.found).length,
          total_artifacts: museum.artifacts.length,
          completed: museum.artifacts.every((item) => item.found),
          new_achievements: []
        };
      },
      async getStory(routeId, artifactId) {
        const museum = db.museums.find((item) => `${item.id}-route` === routeId);
        const artifact = museum.artifacts.find((item) => item.id === artifactId);
        return artifact.story;
      },
      async getProfile() {
        const artifactsFound = db.museums.flatMap((museum) => museum.artifacts).filter((artifact) => artifact.found).length;
        return {
          visitor_id: visitor.id,
          display_name: visitor.display_name,
          level_name: artifactsFound >= 3 ? "Исследователь" : "Новичок",
          artifacts_found: artifactsFound,
          museums_visited: db.museums.filter((museum) => museum.artifacts.some((artifact) => artifact.found)).length,
          minutes_in_stories: 4,
          average_pace_minutes: 2,
          current_route: null,
          recent_collection: [],
          latest_achievement: null
        };
      },
      async getCollection() {
        const items = [];
        db.museums.forEach((museum) => {
          museum.artifacts.filter((artifact) => artifact.found).forEach((artifact) => items.push(toArtifactCard(museum, artifact)));
        });
        return items;
      },
      async getArtifactDetail(_visitorId, artifactId) {
        for (const museum of db.museums) {
          const artifact = museum.artifacts.find((item) => item.id === artifactId);
          if (artifact) {
            return {
              ...toArtifactCard(museum, artifact),
              description: artifact.summary,
              story_slides: [
                artifact.story.coverTitle.replace(/<br>/g, " "),
                artifact.story.coverSubtitle,
                artifact.story.finalText
              ]
            };
          }
        }
        throw new Error("artifact not found");
      },
      async setFavorite(_visitorId, artifactId, favorite) {
        const detail = await this.getArtifactDetail(visitor.id, artifactId);
        detail.is_favorite = favorite;
        return detail;
      },
      async getRouteResult(_visitorId, routeId) {
        const museum = db.museums.find((item) => `${item.id}-route` === routeId);
        const found = museum.artifacts.filter((artifact) => artifact.found).length;
        return {
          route_id: routeId,
          museum_id: museum.id,
          museum_name: museum.title,
          found_artifacts: found,
          total_artifacts: museum.artifacts.length,
          completed: found >= museum.artifacts.length,
          minutes_spent: 4,
          average_artifact_pace: 2,
          achievements_unlocked: []
        };
      },
      async listAchievements() {
        return [];
      },
      async getSettings() {
        return {
          language: "ru",
          sound_enabled: true,
          ar_mode: "adaptive",
          text_size: "normal"
        };
      },
      async updateSettings(_visitorId, settings) {
        return settings;
      }
    };
  }

  async function fetchJson(url, init) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json"
      },
      ...init
    });

    if (!response.ok) {
      const error = new Error(`API request failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  function createHttpApi(apiBaseUrl) {
    const baseUrl = apiBaseUrl.replace(/\/$/, "");

    return {
		async ensureVisitor() {
        const storedVisitorId = getStoredVisitorId();
		if (isVisitorID(storedVisitorId)) {
          return { id: storedVisitorId };
        }
			const response = await fetchJson(`${baseUrl}/visitors/guest`, { method: "POST" });
			const visitor = response.visitor || response;
			setStoredVisitorId(visitor.id);
			if (response.guest_link_token) setStoredGuestLinkToken(response.guest_link_token);
			return visitor;
		},
		async linkAccount({visitorId, accessToken}) {
			const response = await global.fetch(`${baseUrl}/visitors/link`, {
				method: 'POST',
				headers: {'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`},
				body: JSON.stringify({guest_visitor_id: visitorId, guest_link_token: getStoredGuestLinkToken()}),
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				const error = new Error(payload.error || `API request failed: ${response.status}`);
				error.status = response.status;
				throw error;
			}
			setStoredVisitorId(payload.visitor.id);
			setStoredGuestLinkToken('');
			return payload.visitor;
		},
      async listMuseums(visitorId) {
        return fetchJson(`${baseUrl}/museums?visitor_id=${encodeURIComponent(visitorId)}`);
      },
      async getMuseum(museumId, visitorId) {
        return fetchJson(`${baseUrl}/museums/${museumId}?visitor_id=${encodeURIComponent(visitorId)}`);
      },
      async scanArtifact(routeId, payload) {
        return fetchJson(`${baseUrl}/routes/${routeId}/scan`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      },
      async getStory(routeId, artifactId) {
        return fetchJson(`${baseUrl}/routes/${routeId}/story?artifact_id=${encodeURIComponent(artifactId)}`);
      },
      async getProfile(visitorId) {
        return fetchJson(`${baseUrl}/visitors/${visitorId}/profile`);
      },
      async getCollection(visitorId) {
        return fetchJson(`${baseUrl}/visitors/${visitorId}/collection`);
      },
      async getArtifactDetail(visitorId, artifactId) {
        return fetchJson(`${baseUrl}/visitors/${visitorId}/artifacts/${artifactId}`);
      },
      async setFavorite(visitorId, artifactId, favorite) {
        return fetchJson(`${baseUrl}/visitors/${visitorId}/artifacts/${artifactId}/favorite`, {
          method: "PUT",
          body: JSON.stringify({ favorite })
        });
      },
      async getRouteResult(visitorId, routeId) {
        return fetchJson(`${baseUrl}/visitors/${visitorId}/route-results/${routeId}`);
      },
      async listAchievements(visitorId) {
        return fetchJson(`${baseUrl}/visitors/${visitorId}/achievements`);
      },
      async getSettings(visitorId) {
        return fetchJson(`${baseUrl}/visitors/${visitorId}/settings`);
      },
      async updateSettings(visitorId, settings) {
        return fetchJson(`${baseUrl}/visitors/${visitorId}/settings`, {
          method: "PUT",
          body: JSON.stringify(settings)
        });
      }
    };
  }

  function isLocalHost(host) {
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "[::1]";
  }

  // A remote page (e.g. the deployed prototype) can never reach a backend bound
  // to the visitor's own localhost, and mixed-content requests are blocked over
  // https. In that case there is no point probing — use the bundled mock data.
  function isLocalApiUnreachable(apiBaseUrl) {
    try {
      const apiHost = new global.URL(apiBaseUrl).hostname;
      const pageHost = global.location?.hostname || "";
      return isLocalHost(apiHost) && !isLocalHost(pageHost);
    } catch {
      return false;
    }
  }

  // Guard the probe with a timeout so a stalled connection can never hang the app.
  async function probeWithTimeout(url, timeoutMs) {
    const controller = typeof global.AbortController === "function" ? new global.AbortController() : null;
    const timer = controller ? global.setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      await fetchJson(url, controller ? { signal: controller.signal } : undefined);
    } finally {
      if (timer) global.clearTimeout(timer);
    }
  }

  function createAutoApi(config) {
    const mockApi = createMockApi(config);
    const publishedApi = createMockApi({...config, publicCatalog: true});
    const httpApi = createHttpApi(config.apiBaseUrl);
    let resolvedApi = null;

    async function resolveApi() {
      if (resolvedApi) return resolvedApi;
      if (global.location?.protocol === "file:" || isLocalApiUnreachable(config.apiBaseUrl)) {
        resolvedApi = global.location?.protocol === 'file:' ? mockApi : publishedApi;
        return resolvedApi;
      }
      try {
        await probeWithTimeout(`${config.apiBaseUrl.replace(/\/$/, "")}/museums?visitor_id=00000000-0000-0000-0000-000000000000`, 2500);
      } catch {
        // A 404/400 is not a healthy Visitor API either. Falling through here
        // used to select a non-compatible service (often AuthService on :8080)
        // and left the museum catalogue empty.
        resolvedApi = publishedApi;
        return resolvedApi;
      }
      resolvedApi = httpApi;
      return resolvedApi;
    }

	const methods = ["ensureVisitor", "linkAccount", "listMuseums", "getMuseum", "scanArtifact", "getStory", "getProfile", "getCollection", "getArtifactDetail", "setFavorite", "getRouteResult", "listAchievements", "getSettings", "updateSettings"];
    return Object.fromEntries(methods.map((method) => [method, async (...args) => (await resolveApi())[method](...args)]));
  }

  function createApiClient(config) {
    if (config.apiMode === "real") return createHttpApi(config.apiBaseUrl);
    if (config.apiMode === "auto") return createAutoApi(config);
    return createMockApi(config);
  }

  function createVisitorAuthApi(authApiUrl) {
    const baseUrl = authApiUrl.replace(/\/$/, '');
    const request = async (path, body) => {
      const response = await global.fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error || `API request failed: ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return payload;
    };
    const store = (tokens) => {
      try {
        global.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, tokens.access_token);
        global.sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refresh_token);
      } catch {
        // The account works for the current page even if the browser blocks storage.
      }
    };
    return {
		isAuthenticated() {
        try { return Boolean(global.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)); } catch { return false; }
		},
		accessToken() {
			try { return global.sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || ''; } catch { return ''; }
		},
      async register({email, password, displayName}) {
        await request('/auth/visitor/register', {email, password, display_name: displayName});
        const tokens = await request('/auth/visitor/login', {email, password});
        store(tokens);
        return tokens;
      },
      async login({email, password}) {
        const tokens = await request('/auth/visitor/login', {email, password});
        store(tokens);
        return tokens;
      },
      logout() {
        try {
          global.sessionStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
          global.sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
        } catch {
          // noop
        }
      },
    };
  }


export {createApiClient, createVisitorAuthApi, getStoredVisitorId};
