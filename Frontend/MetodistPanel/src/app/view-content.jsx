import React from 'react';
import {ServerArtifactFlow} from '../features/artifacts/server-artifact-flow';
import {DashboardView, AttendanceChart} from '../features/dashboard/views';
import {FeedbackView} from '../features/feedback/views';
import {MuseumProfileView} from '../features/museum/views';
import {RouteBasicView, RouteContentView, RoutePublishView, RouteSuccessView, RoutesView} from '../features/routes/views';
import {StatsView} from '../features/stats/views';
import {VisitorsView} from '../features/visitors/views';

export function ViewContent({
  view,
  currentUser,
  dashboardData,
  dashboardStates,
  retryDashboardBlock,
  museumProfile,
  setMuseumProfile,
  onResetMuseumProfile,
  onSaveMuseumProfile,
  museumProfileSaving,
  museumProfileError,
  museumProfileLoadState,
  onRetryMuseumProfileLoad,
  statsTab,
  setStatsTab,
  statsPeriod,
  setStatsPeriod,
  statsDataByTab,
  feedbackTab,
  setFeedbackTab,
  selectedFeedbackId,
  setSelectedFeedbackId,
  feedbackMessages,
  routeTab,
  setRouteTab,
  routeRows,
  routeSummary,
  routeActivities,
  routeDraft,
  setRouteDraft,
  createdRoute,
  routeSyncError,
  goToRouteStep,
  toggleRouteArtifact,
  reorderRouteArtifact,
  onEditRoute,
  onDeleteRoute,
  onPublishRoute,
  onCreateAnotherRoute,
  onStartRouteFlow,
  setView,
  artifacts,
  artifactsLoading,
  artifactsError,
  onReloadArtifacts,
  serverArtifactFlow,
}) {
  if (view === 'dashboard') {
    return <DashboardView setView={setView} userName={currentUser?.full_name} dashboardData={dashboardData} dashboardStates={dashboardStates} retryDashboardBlock={retryDashboardBlock} />;
  }

  if (view === 'museum') {
    return <MuseumProfileView currentUser={currentUser} museumProfile={museumProfile} setMuseumProfile={setMuseumProfile} onReset={onResetMuseumProfile} onSave={onSaveMuseumProfile} saving={museumProfileSaving} error={museumProfileError} loadState={museumProfileLoadState} onRetryLoad={onRetryMuseumProfileLoad} />;
  }

  if (view === 'visitors') {
    return <VisitorsView AttendanceChart={AttendanceChart} />;
  }

  if (view === 'stats') {
    return (
      <StatsView
        statsTab={statsTab}
        setStatsTab={setStatsTab}
        statsPeriod={statsPeriod}
        setStatsPeriod={setStatsPeriod}
        statsData={statsDataByTab[statsTab]}
        AttendanceChart={AttendanceChart}
      />
    );
  }

  if (view === 'feedback') {
    return (
      <FeedbackView
        feedbackTab={feedbackTab}
        setFeedbackTab={setFeedbackTab}
        selectedFeedbackId={selectedFeedbackId}
        setSelectedFeedbackId={setSelectedFeedbackId}
        feedbackMessages={feedbackMessages}
      />
    );
  }

  if (view === 'routes') {
    return (
      <RoutesView
        routeTab={routeTab}
        setRouteTab={setRouteTab}
        routeRows={routeRows}
        routeSummary={routeSummary}
        routeActivities={routeActivities}
        onStartRouteFlow={onStartRouteFlow}
        onEditRoute={onEditRoute}
        onDeleteRoute={onDeleteRoute}
      />
    );
  }

  if (view === 'route-basic') {
    return <RouteBasicView routeDraft={routeDraft} setRouteDraft={setRouteDraft} setView={setView} goToRouteStep={goToRouteStep} />;
  }

  if (view === 'route-content') {
    return (
      <RouteContentView
        routeDraft={routeDraft}
        artifacts={artifacts}
        goToRouteStep={goToRouteStep}
        toggleRouteArtifact={toggleRouteArtifact}
        reorderRouteArtifact={reorderRouteArtifact}
      />
    );
  }

  if (view === 'route-publish') {
    return (
      <RoutePublishView
        routeDraft={routeDraft}
        setRouteDraft={setRouteDraft}
        goToRouteStep={goToRouteStep}
        onPublishRoute={onPublishRoute}
        routeSyncError={routeSyncError}
      />
    );
  }

  if (view === 'route-success') {
    return <RouteSuccessView route={createdRoute} setView={setView} onCreateAnotherRoute={onCreateAnotherRoute} />;
  }

  if (view === 'artifacts') {
    return <ServerArtifactFlow mode="selector" artifacts={artifacts} artifactsLoading={artifactsLoading} artifactsError={artifactsError} onReload={onReloadArtifacts} flow={serverArtifactFlow} onNavigate={setView} />;
  }

  if (view === 'artifact-basic') {
    return <ServerArtifactFlow mode="basic" flow={serverArtifactFlow} onNavigate={setView} />;
  }

  if (view === 'artifact-content') {
    return <ServerArtifactFlow mode="content" flow={serverArtifactFlow} onNavigate={setView} />;
  }

  if (view === 'artifact-publish') {
    return <ServerArtifactFlow mode="publish" flow={serverArtifactFlow} onNavigate={setView} />;
  }

  if (view === 'artifact-success') {
    return <ServerArtifactFlow mode="success" flow={serverArtifactFlow} onNavigate={setView} />;
  }

  return null;
}
