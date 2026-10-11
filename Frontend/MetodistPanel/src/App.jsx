import React, {useEffect, useMemo, useState} from 'react';
import {FEEDBACK_CONVERSATIONS} from './app/constants';
import {DEFAULT_VIEW} from './app/routes';
import {AuthScreen} from './app/AuthScreen';
import {AppShell} from './app/AppShell';
import {HeaderActions} from './app/header-actions';
import {useArtifactDraft} from './app/use-artifact-draft';
import {useArtifactsData} from './app/use-artifacts-data';
import {useServerArtifactFlow} from './app/use-server-artifact-flow';
import {ViewContent} from './app/view-content';
import {useDashboardData} from './app/use-dashboard-data';
import {useProfileData} from './app/use-profile-data';
import {mergeRouteTableRows} from './app/route-draft-utils';
import {useRouteDraft} from './app/use-route-draft';
import {useSession} from './app/use-session';
import {useViewRouting} from './app/use-view-routing';

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [artifactTab, setArtifactTab] = useState('all');
  const [artifactCategory, setArtifactCategory] = useState('all');
  const [routeTab, setRouteTab] = useState('all-routes');
  const [statsTab, setStatsTab] = useState('overview');
  const [statsPeriod, setStatsPeriod] = useState('day');
  const [feedbackTab, setFeedbackTab] = useState('all');
  const [selectedFeedbackId, setSelectedFeedbackId] = useState(FEEDBACK_CONVERSATIONS[0].id);
  const [userProfileTab, setUserProfileTab] = useState('profile');

  const {
    session,
    authTab,
    setAuthTab,
    authForm,
    setAuthForm,
    authError,
    authLoading,
    isAuthenticated,
    currentUser,
    updateSession,
    clearSession,
    handleLogin,
    handleRegister,
    handleLogout,
  } = useSession({
    setView: (...args) => setView(...args),
  });

	const {view, artifactId, setView} = useViewRouting({isAuthenticated});

  const navigate = (nextView, options) => {
    setUserMenuOpen(false);
    setNotificationsOpen(false);
    setView(nextView, options);
  };

  const {
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
  } = useDashboardData({
    isAuthenticated,
    statsTab,
    statsPeriod,
    selectedFeedbackId,
    setSelectedFeedbackId,
  });

  const {
    artifacts,
    artifactsLoading,
    artifactsError,
    loadArtifacts,
  } = useArtifactsData({
    session,
    isAuthenticated,
    onSessionRefresh: updateSession,
    onUnauthorized: () => {
      clearSession({authErrorMessage: 'Сессия истекла. Войдите снова.'});
      setView(DEFAULT_VIEW, {replace: true});
    },
    loadConnectedData: async () => {
      await loadConnectedData();
    },
  });

  const {
    form,
    setForm,
    status,
    setStatus,
    visibility,
    setVisibility,
    routeAccess,
    setRouteAccess,
    showViews,
    setShowViews,
    allowDownload,
    setAllowDownload,
    artifactScreens,
    selectedScreen,
    editingScreen,
    editorValidation,
    showEditorValidation,
    selectedArtifactScreenId,
    setSelectedArtifactScreenId,
    publishError,
    publishLoading,
    createdArtifact,
    coverPreview,
    coverError,
    setCoverFile,
    publishValidation,
    startArtifactFlow,
    goToArtifactStep,
    addArtifactScreen,
    duplicateArtifactScreen,
    removeArtifactScreen,
    moveArtifactScreen,
    reorderArtifactScreens,
    startEditingScreen,
    updateEditingScreen,
    updateEditingScreenOrder,
    updateEditingScreenCorrectAnswer,
    cancelEditingScreen,
    saveEditingScreen,
    handlePublishArtifact,
  } = useArtifactDraft({
    loadArtifacts,
    onNavigate: navigate,
  });

	const serverArtifactFlow = useServerArtifactFlow({
    loadArtifacts,
    onNavigate: navigate,
	});

	useEffect(() => {
		if (!artifactId || !view.startsWith('artifact-') || serverArtifactFlow.artifact?.id === artifactId || serverArtifactFlow.loading) return;
		serverArtifactFlow.select(artifactId, view);
	}, [artifactId, serverArtifactFlow, view]);

  const {
    routeDraft,
    setRouteDraft,
    createdRoute,
    startRouteFlow,
    goToRouteStep,
    toggleRouteArtifact,
    reorderRouteArtifact,
    editRoute,
    deleteRoute,
    publishRoute,
    createAnotherRoute,
    routeSyncError,
  } = useRouteDraft({
    onNavigate: navigate,
  });

  const {
    userProfile,
    userProfileDraft,
    setUserProfileDraft,
    profileSaving,
    profileError,
    handleSaveUserProfile,
  } = useProfileData({
    session,
    isAuthenticated,
    currentUser,
    onSessionRefresh: updateSession,
  });

  const visibleRouteRows = useMemo(
    () => mergeRouteTableRows(routeRows, routeDraft),
    [routeDraft, routeRows]
  );

  const handleAppLogout = async () => {
    await handleLogout();
    setUserMenuOpen(false);
  };

  const headerAction = (
    <HeaderActions
      view={view}
      form={form}
      profileSaving={profileSaving}
      publishLoading={publishLoading}
      onResetUserProfile={() => {
        setUserProfileDraft(userProfile);
        setView('dashboard');
      }}
      onSaveUserProfile={handleSaveUserProfile}
      onStartArtifactFlow={serverArtifactFlow.start}
      onStartRouteFlow={startRouteFlow}
      onPublishRoute={publishRoute}
      routeDraft={routeDraft}
      onPublishArtifact={handlePublishArtifact}
      onNavigate={navigate}
    />
  );

  if (!isAuthenticated) {
    return (
      <>
        <AuthScreen
          authTab={authTab}
          setAuthTab={setAuthTab}
          authForm={authForm}
          setAuthForm={setAuthForm}
          authError={authError}
          authLoading={authLoading}
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      </>
    );
  }

  return (
    <>
      <AppShell
        sidebarCollapsed={sidebarCollapsed}
        mobileNavOpen={mobileNavOpen}
        userMenuOpen={userMenuOpen}
        notificationsOpen={notificationsOpen}
        notificationUnreadCount={notificationUnreadCount}
        notificationItems={notificationItems}
        currentUser={currentUser}
        view={view}
        headerAction={headerAction}
        onNavigate={setView}
        onToggleSidebar={() => {
          setSidebarCollapsed((prev) => !prev);
          setUserMenuOpen(false);
        }}
        onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
        onCloseMobileNav={() => setMobileNavOpen(false)}
        onToggleUserMenu={() => setUserMenuOpen((prev) => !prev)}
        onOpenUserProfile={() => {
          setUserProfileDraft(userProfile);
          setUserProfileTab('profile');
          setView('user-profile');
          setUserMenuOpen(false);
        }}
        onLogout={handleAppLogout}
        onToggleNotifications={() => setNotificationsOpen((prev) => !prev)}
      >
        <ViewContent
          view={view}
          currentUser={currentUser}
          dashboardData={dashboardData}
          museumProfile={museumProfile}
          setMuseumProfile={setMuseumProfile}
          onResetMuseumProfile={resetMuseumProfile}
          onSaveMuseumProfile={saveMuseumProfile}
          museumProfileSaving={museumProfileSaving}
          museumProfileError={museumProfileError}
          userProfileDraft={userProfileDraft}
          setUserProfileDraft={setUserProfileDraft}
          userProfileTab={userProfileTab}
          setUserProfileTab={setUserProfileTab}
          profileError={profileError}
          profileSaving={profileSaving}
          onResetUserProfile={() => {
            setUserProfileDraft(userProfile);
            setView('dashboard');
          }}
          onSaveUserProfile={handleSaveUserProfile}
          statsTab={statsTab}
          setStatsTab={setStatsTab}
          statsPeriod={statsPeriod}
          setStatsPeriod={setStatsPeriod}
          statsDataByTab={statsDataByTab}
          feedbackTab={feedbackTab}
          setFeedbackTab={setFeedbackTab}
          selectedFeedbackId={selectedFeedbackId}
          setSelectedFeedbackId={setSelectedFeedbackId}
          feedbackMessages={feedbackMessages}
          routeTab={routeTab}
          setRouteTab={setRouteTab}
          routeRows={visibleRouteRows}
          routeSummary={routeSummary}
          routeActivities={routeActivities}
          routeDraft={routeDraft}
          setRouteDraft={setRouteDraft}
          createdRoute={createdRoute}
          routeSyncError={routeSyncError}
          goToRouteStep={goToRouteStep}
          toggleRouteArtifact={toggleRouteArtifact}
          reorderRouteArtifact={reorderRouteArtifact}
          onEditRoute={editRoute}
          onDeleteRoute={deleteRoute}
          onPublishRoute={publishRoute}
          onCreateAnotherRoute={createAnotherRoute}
          onStartRouteFlow={startRouteFlow}
          artifactTab={artifactTab}
          setArtifactTab={setArtifactTab}
          artifactCategory={artifactCategory}
          setArtifactCategory={setArtifactCategory}
          setView={setView}
          artifacts={artifacts}
          artifactsLoading={artifactsLoading}
          artifactsError={artifactsError}
          onReloadArtifacts={loadArtifacts}
          onStartArtifactFlow={startArtifactFlow}
          serverArtifactFlow={serverArtifactFlow}
          form={form}
          setForm={setForm}
          goToArtifactStep={goToArtifactStep}
          status={status}
          setStatus={setStatus}
          artifactScreens={artifactScreens}
          selectedScreen={selectedScreen}
          editingScreen={editingScreen}
          editorValidation={editorValidation}
          showEditorValidation={showEditorValidation}
          selectedArtifactScreenId={selectedArtifactScreenId}
          setSelectedArtifactScreenId={setSelectedArtifactScreenId}
          onAddArtifactScreen={(typeId) => {
            addArtifactScreen(typeId);
            navigate(typeId);
          }}
          onDuplicateScreen={duplicateArtifactScreen}
          onDeleteScreen={removeArtifactScreen}
          onMoveScreen={moveArtifactScreen}
          onReorderScreens={reorderArtifactScreens}
          onEditScreen={startEditingScreen}
          onUpdateEditingScreen={updateEditingScreen}
          onUpdateEditingScreenOrder={updateEditingScreenOrder}
          onUpdateEditingScreenCorrectAnswer={updateEditingScreenCorrectAnswer}
          onCancelEditingScreen={cancelEditingScreen}
          onSaveEditingScreen={saveEditingScreen}
          visibility={visibility}
          setVisibility={setVisibility}
          routeAccess={routeAccess}
          setRouteAccess={setRouteAccess}
          showViews={showViews}
          setShowViews={setShowViews}
          allowDownload={allowDownload}
          setAllowDownload={setAllowDownload}
          publishLoading={publishLoading}
          publishError={publishError}
          onPublishArtifact={handlePublishArtifact}
          createdArtifact={createdArtifact}
          coverPreview={coverPreview}
          coverError={coverError}
          setCoverFile={setCoverFile}
          publishValidation={publishValidation}
          onCreateAnotherArtifact={startArtifactFlow}
        />
      </AppShell>
    </>
  );
}
export default App;
