import {useToaster} from '@gravity-ui/uikit';
import {useMuseumAccess} from './app/use-museum-access';
import {authApi} from './api';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {FEEDBACK_CONVERSATIONS} from './features/feedback/demo-data';
import {DEFAULT_VIEW} from './app/routes';
import {AuthScreen} from './app/AuthScreen';
import {MuseumSetupScreen} from './app/MuseumSetupScreen';
import {AppShell} from './app/AppShell';
import {HeaderActions} from './app/header-actions';
import {useArtifactsData} from './app/use-artifacts-data';
import {useServerArtifactFlow} from './app/use-server-artifact-flow';
import {ViewContent} from './app/view-content';
import {useDashboardData} from './app/use-dashboard-data';
import {ProfilePage, ReactivationScreen} from './features/users/ProfilePage';
import {mergeRouteTableRows} from './app/route-draft-utils';
import {useRouteDraft} from './app/use-route-draft';
import {useSession} from './app/use-session';
import {useViewRouting} from './app/use-view-routing';
import {useStatsData} from './features/stats/use-stats-data';

function App() {
  const {add:showToast} = useToaster();
  const [museumSwitchBusy,setMuseumSwitchBusy] = useState(false);
  const museumSwitchLock = useRef(false);
  const [profileDirty,setProfileDirty] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [routeTab, setRouteTab] = useState('all-routes');
  const [statsTab, setStatsTab] = useState('overview');
  const [statsPeriod, setStatsPeriod] = useState('day');
  const [feedbackTab, setFeedbackTab] = useState('all');
  const [selectedFeedbackId, setSelectedFeedbackId] = useState(FEEDBACK_CONVERSATIONS[0].id);

  const {
    session,
    sessionChecking,
    sessionCheckError,
    retrySessionCheck,
    authTab,
    setAuthTab,
    authForm,
    setAuthForm,
    authError,
    authLoading,
    isAuthenticated,
    needsMuseumContext,
    currentUser,
    updateSession,
    clearSession,
    handleLogin,
    handleProvisionMuseum,
    handleRegister,
    handleLogout,
  } = useSession({
    setView: (...args) => setView(...args),
  });

	const {view, artifactId, setView} = useViewRouting({isAuthenticated});

  const navigate = (nextView, options) => {
    setUserMenuOpen(false);
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
  } = useDashboardData({
    selectedFeedbackId,
    setSelectedFeedbackId,
  });
  const {museums, museumState, refreshMuseums, applyMuseums} = useMuseumAccess({userId:currentUser?.id, accessToken:session?.accessToken, active:isAuthenticated && currentUser?.status?.toUpperCase() === 'ACTIVE', isMock:session?.isMock});
  const {statsDataByTab} = useStatsData({isAuthenticated, statsTab, statsPeriod});

  const {
    artifacts,
    artifactsLoading,
    artifactsError,
    loadArtifacts,
  } = useArtifactsData({
    session,
    isAuthenticated: isAuthenticated && currentUser?.status?.toUpperCase() !== 'DORMANT',
    onSessionRefresh: updateSession,
    onUnauthorized: () => {
      clearSession({authErrorMessage: 'Сессия истекла. Войдите снова.'});
      setView(DEFAULT_VIEW, {replace: true});
    },
    loadConnectedData: async () => {
      await loadConnectedData();
    },
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


  const visibleRouteRows = useMemo(
    () => mergeRouteTableRows(routeRows, routeDraft),
    [routeDraft, routeRows]
  );

  const selectMuseum = async (museumId, {discardConfirmed = false} = {}) => {
    if (museumSwitchLock.current) return false;
    if (museumId === currentUser?.museum_id) {navigate('museum'); return true;}
    if (!discardConfirmed && (profileDirty || view === 'museum' || view.startsWith('artifact-')) && !window.confirm('Переключиться на другой музей? Несохранённые изменения будут отменены.')) return false;
    museumSwitchLock.current = true; setMuseumSwitchBusy(true);
    try {
      const response = await authApi.selectMuseum(museumId);
      updateSession({...session, accessToken:response.accessToken, user:response.user});
      await loadConnectedData();
      navigate('museum');
      return true;
    } catch {
      showToast({name:'museum-switch-error',theme:'warning',title:'Не удалось переключить музей. Повторите попытку.'});
      return false;
    } finally {museumSwitchLock.current = false; setMuseumSwitchBusy(false);}
  };

  const handleAppLogout = async () => {
    await handleLogout();
    setUserMenuOpen(false);
  };

  const headerAction = (
    <HeaderActions
      view={view}
      key={currentUser?.museum_id} items={notificationItems} unreadCount={notificationUnreadCount} onRefresh={loadConnectedData}
    />
  );

  if (sessionChecking || sessionCheckError) return <main className="personal-recovery"><div><p role={sessionCheckError ? 'alert' : 'status'}>{sessionCheckError || 'Проверяем аккаунт…'}</p>{sessionCheckError && <button type="button" onClick={retrySessionCheck}>Повторить</button>}</div></main>;
  if (session?.accessToken && currentUser?.status?.toUpperCase() === 'DORMANT') {
    return <ReactivationScreen user={currentUser} onActivate={async () => {const response = await authApi.reactivate(); updateSession({...session, user: response.user}); setView('dashboard', {replace: true});}} onLogout={handleAppLogout} />;
  }
  if (needsMuseumContext) {
    return <MuseumSetupScreen error={authError} loading={authLoading} onCreate={handleProvisionMuseum} onLogout={handleAppLogout} />;
  }

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
        museumProfile={museumProfile}
        museums={museums}
        museumState={museumState}
        museumSwitchBusy={museumSwitchBusy}
        onSelectMuseum={selectMuseum}
        onRetryMuseums={refreshMuseums}
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
          setView('user-profile');
          setUserMenuOpen(false);
        }}
        onLogout={handleAppLogout}
      >
        {view === 'user-profile' ? <ProfilePage session={session} onSessionRefresh={updateSession} onNavigate={navigate} museums={museums} museumState={museumState} loadMuseums={refreshMuseums} onMuseumsUpdated={applyMuseums} onSelectMuseum={selectMuseum} onDirtyChange={setProfileDirty} /> : <ViewContent
          view={view}
          currentUser={currentUser}
          dashboardData={dashboardData}
          dashboardStates={dashboardStates}
          retryDashboardBlock={retryDashboardBlock}
          museumProfile={museumProfile}
          setMuseumProfile={setMuseumProfile}
          onResetMuseumProfile={resetMuseumProfile}
          onSaveMuseumProfile={saveMuseumProfile}
          museumProfileSaving={museumProfileSaving}
          museumProfileError={museumProfileError}
          museumProfileLoadState={museumProfileLoadState}
          onRetryMuseumProfileLoad={loadMuseumProfile}
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
          setView={setView}
          artifacts={artifacts}
          artifactsLoading={artifactsLoading}
          artifactsError={artifactsError}
          onReloadArtifacts={loadArtifacts}
          serverArtifactFlow={serverArtifactFlow}
        />}
      </AppShell>
    </>
  );
}
export default App;

