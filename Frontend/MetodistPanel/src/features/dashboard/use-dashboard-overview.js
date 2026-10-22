import {useMemo, useState} from 'react';
import {dashboardApi} from '../../api';
import {createDashboardRetryHandler, createInitialDashboardData, createInitialDashboardStates, resolveDashboardResults} from './dashboard-state';
import {mapDashboardActivities, mapDashboardAttendance, mapDashboardFeedbackItems, mapDashboardPopularRoutes, mapDashboardSummary} from './mappers';

const blockMaps = {
  summary: mapDashboardSummary,
  attendance: mapDashboardAttendance,
  popularRoutes: (response) => mapDashboardPopularRoutes(response?.routes),
  recentActivity: (response) => mapDashboardActivities(response?.activities),
  feedbackItems: (response) => mapDashboardFeedbackItems(response?.items),
};

const blockRequests = {
  summary: () => dashboardApi.summary(),
  attendance: () => dashboardApi.attendance('month'),
  popularRoutes: () => dashboardApi.popularRoutes(),
  recentActivity: () => dashboardApi.recentActivity(),
  feedbackItems: () => dashboardApi.feedback(),
};

export function useDashboardOverview() {
  const [dashboardData, setDashboardData] = useState(createInitialDashboardData);
  const [dashboardStates, setDashboardStates] = useState(createInitialDashboardStates);
  const loadBlock = useMemo(() => createDashboardRetryHandler({setData: setDashboardData, setStates: setDashboardStates}), []);

  const applyDashboardResults = ({summaryResult, attendanceResult, popularRoutesResult, activityResult, feedbackResult}) => {
    const results = {summary: summaryResult, attendance: attendanceResult, popularRoutes: popularRoutesResult, recentActivity: activityResult, feedbackItems: feedbackResult};
    const resolved = resolveDashboardResults(results, blockMaps);
    setDashboardStates((current) => ({...current, ...resolved.states}));
    setDashboardData((current) => ({...current, ...resolved.data}));
  };

  const retryDashboardBlock = (key) => loadBlock(key, blockRequests[key], blockMaps[key]);
  return {dashboardData, dashboardStates, applyDashboardResults, retryDashboardBlock};
}
