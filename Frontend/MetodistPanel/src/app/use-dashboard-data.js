import {useEffect, useEffectEvent, useState} from 'react';
import {analyticsApi, dashboardApi, feedbackApi, museumApi, notificationApi, routeApi} from '../api';
import {
  ATTENDANCE_SERIES,
  DASHBOARD_STATS,
  FEEDBACK_CONVERSATIONS,
  FEEDBACK_ITEMS,
  NOTIFICATION_ITEMS,
  POPULAR_ROUTES,
  RECENT_ACTIVITY,
  ROUTE_ROWS,
  STATS_TAB_CONTENT,
} from './constants';
import {
  mapDashboardActivities,
  mapDashboardFeedbackItems,
  mapDashboardPopularRoutes,
  mapDashboardSummary,
  mapFeedbackConversations,
  mapMuseumProfileData,
  mapNotifications,
  mapRouteActivities,
  mapRouteRows,
  mapRouteSummaryData,
  mapStatsBarsData,
  mapStatsBreakdownData,
  mapStatsChartData,
  mapStatsRankedData,
  mapStatsSummaryCards,
  mapRouteStatusLabel,
} from './utils';
import {createLocalRouteRowsFromStorage, mergeLocalRouteRows} from './route-draft-utils';
import {MUSEUM_ERRORS} from '../features/museum/config';
import {normalizeWebsite} from '../features/museum/utils';

export function useDashboardData({
  isAuthenticated,
  statsTab,
  statsPeriod,
  selectedFeedbackId,
  setSelectedFeedbackId,
}) {
  const [museumProfile, setMuseumProfile] = useState(() => mapMuseumProfileData(null));
  const [museumProfileSaved, setMuseumProfileSaved] = useState(() => mapMuseumProfileData(null));
  const [dashboardData, setDashboardData] = useState({
    summary: DASHBOARD_STATS,
    attendance: ATTENDANCE_SERIES.month,
    recentActivity: RECENT_ACTIVITY,
    popularRoutes: POPULAR_ROUTES,
    feedbackItems: FEEDBACK_ITEMS,
  });
  const [routeRows, setRouteRows] = useState(ROUTE_ROWS);
  const [routeSummary, setRouteSummary] = useState(() => mapRouteSummaryData(null));
  const [routeActivities, setRouteActivities] = useState(() => mapRouteActivities(null));
  const [feedbackMessages, setFeedbackMessages] = useState(FEEDBACK_CONVERSATIONS);
  const [notificationItems, setNotificationItems] = useState(NOTIFICATION_ITEMS);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(NOTIFICATION_ITEMS.length);
  const [statsDataByTab, setStatsDataByTab] = useState({});
  const [museumProfileSaving, setMuseumProfileSaving] = useState(false);
  const [museumProfileError, setMuseumProfileError] = useState('');

  /* Профиль и его сохранённая копия меняются только при загрузке и сохранении. */
  const applyMuseumProfile = (nextProfile) => {
    setMuseumProfile(nextProfile);
    setMuseumProfileSaved(nextProfile);
  };

  const saveMuseumProfile = async (profile, creating) => {
    setMuseumProfileSaving(true); setMuseumProfileError('');
    try {
      const body = {name: profile.name, short_description: profile.shortDescription, description: profile.description, website: normalizeWebsite(profile.website).value, address: profile.address, logo_url: profile.logoUrl};
      const response = creating ? await museumApi.createProfile(body) : await museumApi.updateProfile(body);
      applyMuseumProfile(mapMuseumProfileData(response.museum));
      return true;
    } catch {
      setMuseumProfileError(MUSEUM_ERRORS.save);
      return false;
    } finally { setMuseumProfileSaving(false); }
  };

  /* «Отмена» возвращает форму к последнему сохранённому состоянию. */
  const resetMuseumProfile = () => setMuseumProfile(museumProfileSaved);

  const loadStatsTabData = async (tab, period) => {
    const fallback = STATS_TAB_CONTENT[tab] || STATS_TAB_CONTENT.overview;
    const [summaryResult, chartResult, breakdownResult, rankedResult, barsResult] = await Promise.allSettled([
      analyticsApi.statsSummary(tab, period),
      analyticsApi.statsChart(tab, period),
      analyticsApi.statsBreakdown(tab),
      analyticsApi.statsRanked(tab),
      analyticsApi.statsBars(tab),
    ]);

    setStatsDataByTab((prev) => ({
      ...prev,
      [tab]: {
        summary: summaryResult.status === 'fulfilled' ? mapStatsSummaryCards(summaryResult.value, fallback) : fallback.summary,
        chart:
          chartResult.status === 'fulfilled'
            ? mapStatsChartData(chartResult.value, fallback.chartSeries[period] || fallback.chartSeries.day, fallback.chartLabel)
            : {
                labels: (fallback.chartSeries[period] || fallback.chartSeries.day).labels,
                values: (fallback.chartSeries[period] || fallback.chartSeries.day).values,
                chartLabel: fallback.chartLabel,
              },
        breakdown:
          breakdownResult.status === 'fulfilled'
            ? mapStatsBreakdownData(breakdownResult.value, fallback)
            : {title: fallback.sideTitle, items: fallback.sideItems},
        ranked:
          rankedResult.status === 'fulfilled'
            ? mapStatsRankedData(rankedResult.value, fallback.lowerSections[0])
            : fallback.lowerSections[0],
        bars:
          barsResult.status === 'fulfilled'
            ? mapStatsBarsData(barsResult.value, fallback.lowerSections[fallback.lowerSections.length - 1])
            : fallback.lowerSections[fallback.lowerSections.length - 1],
        footnote: fallback.footnote,
      },
    }));
  };

  const loadConnectedData = async () => {
    const [
      dashboardSummaryResult,
      dashboardAttendanceResult,
      dashboardPopularRoutesResult,
      dashboardActivityResult,
      dashboardFeedbackResult,
      museumProfileResult,
      routesResult,
      routeSummaryResult,
      routeActivityResult,
      feedbackResult,
      notificationResult,
    ] = await Promise.allSettled([
      dashboardApi.summary(),
      dashboardApi.attendance('month'),
      dashboardApi.popularRoutes(),
      dashboardApi.recentActivity(),
      dashboardApi.feedback(),
      museumApi.getProfile(),
      routeApi.list(),
      routeApi.summary(),
      routeApi.recentActivity(),
      feedbackApi.list(),
      notificationApi.list(),
    ]);

    setDashboardData({
      summary: dashboardSummaryResult.status === 'fulfilled' ? mapDashboardSummary(dashboardSummaryResult.value) : DASHBOARD_STATS,
      attendance:
        dashboardAttendanceResult.status === 'fulfilled'
          ? {
              labels: dashboardAttendanceResult.value.labels || ATTENDANCE_SERIES.month.labels,
              values: dashboardAttendanceResult.value.values || ATTENDANCE_SERIES.month.values,
              note: dashboardAttendanceResult.value.note || ATTENDANCE_SERIES.month.note,
            }
          : ATTENDANCE_SERIES.month,
      popularRoutes:
        dashboardPopularRoutesResult.status === 'fulfilled'
          ? mapDashboardPopularRoutes(dashboardPopularRoutesResult.value.routes)
          : POPULAR_ROUTES,
      recentActivity:
        dashboardActivityResult.status === 'fulfilled'
          ? mapDashboardActivities(dashboardActivityResult.value.activities)
          : RECENT_ACTIVITY,
      feedbackItems:
        dashboardFeedbackResult.status === 'fulfilled'
          ? mapDashboardFeedbackItems(dashboardFeedbackResult.value.items)
          : FEEDBACK_ITEMS,
    });

    if (museumProfileResult.status === 'fulfilled') {
      applyMuseumProfile(mapMuseumProfileData(museumProfileResult.value.museum));
    }

    if (routesResult.status === 'fulfilled') {
      const mergedRoutes = mergeLocalRouteRows(routesResult.value.routes);
      setRouteRows(mapRouteRows(mergedRoutes));

      const localDraftCount = mergedRoutes.filter((item) => mapRouteStatusLabel(item.status) === 'Черновик').length;
      setRouteSummary((prev) => ({
        ...prev,
        total: mergedRoutes.length,
        draft: localDraftCount,
      }));
    }

    if (routeSummaryResult.status === 'fulfilled') {
      const mappedSummary = mapRouteSummaryData(routeSummaryResult.value);
      const localDrafts = createLocalRouteRowsFromStorage();
      setRouteSummary({
        ...mappedSummary,
        total: mappedSummary.total + localDrafts.length,
        draft: mappedSummary.draft + localDrafts.length,
      });
    }

    if (routeActivityResult.status === 'fulfilled') {
      setRouteActivities(mapRouteActivities(routeActivityResult.value.activities));
    }

    if (feedbackResult.status === 'fulfilled') {
      const mapped = mapFeedbackConversations(feedbackResult.value.items);
      setFeedbackMessages(mapped);
      if (!mapped.some((item) => item.id === selectedFeedbackId)) {
        setSelectedFeedbackId(mapped[0]?.id || FEEDBACK_CONVERSATIONS[0].id);
      }
    }

    if (notificationResult.status === 'fulfilled') {
      setNotificationItems(mapNotifications(notificationResult.value.items));
      setNotificationUnreadCount(notificationResult.value.unread_count ?? notificationResult.value.unreadCount ?? 0);
    }
  };

  const loadStatsTabDataEvent = useEffectEvent(loadStatsTabData);
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    loadStatsTabDataEvent(statsTab, statsPeriod);
  }, [isAuthenticated, statsPeriod, statsTab]);

  return {
    loadConnectedData,
    museumProfile,
    setMuseumProfile,
    resetMuseumProfile,
    saveMuseumProfile,
    museumProfileSaving,
    museumProfileError,
    dashboardData,
    routeRows,
    routeSummary,
    routeActivities,
    feedbackMessages,
    notificationItems,
    notificationUnreadCount,
    statsDataByTab,
  };
}
