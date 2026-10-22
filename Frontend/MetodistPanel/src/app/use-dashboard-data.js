import {dashboardApi, feedbackApi, notificationApi, routeApi} from '../api';
import {useDashboardOverview} from '../features/dashboard/use-dashboard-overview';
import {useRouteListData} from '../features/routes/use-route-list-data';
import {useMuseumProfile} from '../features/museum/use-museum-profile';
import {useFeedbackData} from '../features/feedback/use-feedback-data';
import {useNotificationData} from './use-notification-data';

export function useDashboardData({
  selectedFeedbackId,
  setSelectedFeedbackId,
}) {
  const {
    museumProfile,
    setMuseumProfile,
    resetMuseumProfile,
    saveMuseumProfile,
    museumProfileSaving,
    museumProfileError,
    museumProfileLoadState,
    loadMuseumProfile,
  } = useMuseumProfile();
  const {dashboardData, dashboardStates, applyDashboardResults, retryDashboardBlock} = useDashboardOverview();
  const {routeRows, routeSummary, routeActivities, applyRouteResults} = useRouteListData();
  const {feedbackMessages, applyFeedbackResult} = useFeedbackData({selectedFeedbackId, setSelectedFeedbackId});
  const {notificationItems, notificationUnreadCount, applyNotificationResult} = useNotificationData();
  const loadConnectedData = async () => {
    const museumProfileLoad = loadMuseumProfile();
    const [
      dashboardSummaryResult,
      dashboardAttendanceResult,
      dashboardPopularRoutesResult,
      dashboardActivityResult,
      dashboardFeedbackResult,
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
      routeApi.list(),
      routeApi.summary(),
      routeApi.recentActivity(),
      feedbackApi.list(),
      notificationApi.list(),
    ]);

    applyDashboardResults({
      summaryResult: dashboardSummaryResult,
      attendanceResult: dashboardAttendanceResult,
      popularRoutesResult: dashboardPopularRoutesResult,
      activityResult: dashboardActivityResult,
      feedbackResult: dashboardFeedbackResult,
    });

    applyRouteResults({
      routesResult,
      summaryResult: routeSummaryResult,
      activityResult: routeActivityResult,
    });

    applyFeedbackResult(feedbackResult);
    applyNotificationResult(notificationResult);
    await museumProfileLoad;
  };

  return {
    loadConnectedData,
    museumProfile,
    setMuseumProfile,
    resetMuseumProfile,
    saveMuseumProfile,
    museumProfileSaving,
    museumProfileError,
    museumProfileLoadState,
    loadMuseumProfile,
    dashboardData,
    dashboardStates,
    retryDashboardBlock,
    routeRows,
    routeSummary,
    routeActivities,
    feedbackMessages,
    notificationItems,
    notificationUnreadCount,
  };
}
