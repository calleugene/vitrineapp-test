import React from 'react';
import {AppShell} from './app/AppShell.jsx';
import {ViewContent} from './app/view-content.jsx';
import {ToastProvider} from './components/Toast.jsx';
import {useVisitorData} from './app/use-visitor-data.js';
import {useUrlSync} from './app/routes-router.jsx';
import {PublicArtifactStory} from './features/public-artifact/PublicArtifactStory.jsx';
import {PublicRoute} from './features/public-artifact/PublicServices.jsx';

function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f2f3f8',
      gap: 16,
      zIndex: 9999,
    }}>
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="vl-grad-load" x1="6" y1="4" x2="38" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#695bff"/>
            <stop offset="1" stopColor="#9b8fff"/>
          </linearGradient>
        </defs>
        <path d="M22 4L38 13V31L22 40L6 31V13L22 4Z" fill="url(#vl-grad-load)"/>
        <path d="M14 18l8 12 8-12" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid rgba(105,91,255,0.15)',
        borderTopColor: '#695bff',
        borderRadius: '50%',
        animation: 'vl-spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes vl-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function DataLayer() {
  const {state, navigate, actions} = useVisitorData();
  useUrlSync(state, actions);
  return (
    <>
      {state.loading && state.view === 'museumSelect' && !state.museums.length && <LoadingScreen />}
      <AppShell view={state.view} onNavigate={navigate} />
      <ViewContent data={state} navigate={navigate} actions={actions} />
    </>
  );
}

export function App() {
  const publicRouteId = window.location.pathname.match(/^\/routes\/(rte_[a-f0-9]{32})\/?$/)?.[1];
  if (publicRouteId) return <PublicRoute routeId={publicRouteId} />;
  const publicCode = window.location.pathname.match(/^\/exhibits\/((?:[A-Z0-9]{5}|[A-F0-9]{10}))\/?$/i)?.[1];
  if (publicCode) return <PublicArtifactStory code={publicCode.toUpperCase()} />;
  return (
    <ToastProvider>
      <DataLayer />
    </ToastProvider>
  );
}
