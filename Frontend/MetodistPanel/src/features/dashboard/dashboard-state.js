export const DASHBOARD_BLOCKS = ['summary', 'attendance', 'popularRoutes', 'recentActivity', 'feedbackItems'];

export function createInitialDashboardData() {
  return {
    summary: [],
    attendance: {labels: [], values: [], note: ''},
    popularRoutes: [],
    recentActivity: [],
    feedbackItems: [],
  };
}

export function createInitialDashboardStates() {
  return Object.fromEntries(DASHBOARD_BLOCKS.map((key) => [key, {status: 'loading'}]));
}

export function createDashboardRetryHandler({setData, setStates}) {
  const pending = new Set();
  return async (key, request, mapResponse) => {
    if (pending.has(key)) return false;
    pending.add(key);
    setStates((current) => ({...current, [key]: {status: 'loading'}}));
    try {
      const value = mapResponse(await request());
      setData((current) => ({...current, [key]: value}));
      setStates((current) => ({...current, [key]: {status: 'success'}}));
      return true;
    } catch {
      setStates((current) => ({...current, [key]: {status: 'error'}}));
      return false;
    } finally {
      pending.delete(key);
    }
  };
}

export function dashboardResultStatus(result, mapResponse) {
  if (result.status === 'rejected') return {status: 'error'};
  try {
    return {status: 'success', value: mapResponse(result.value)};
  } catch {
    return {status: 'error'};
  }
}

export function resolveDashboardResults(results, maps) {
  const states = {};
  const data = {};
  for (const [key, result] of Object.entries(results)) {
    const resolved = dashboardResultStatus(result, maps[key]);
    states[key] = {status: resolved.status};
    if (resolved.status === 'success') data[key] = resolved.value;
  }
  return {states, data};
}
