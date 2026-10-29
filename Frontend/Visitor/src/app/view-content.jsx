import React, {Suspense, lazy} from 'react';
import {OnboardingView} from '../features/onboarding/views.jsx';
import {MuseumSelectView, MuseumDetailView} from '../features/museum/views.jsx';
import {CollectionView} from '../features/collection/views.jsx';
import {
  ProfileHomeView,
  ProfileGuestView,
  ProfileAchievementsView,
  ProfileSettingsView,
  PublicProfileView,
  DeleteAccountView,
  AccountDeletedView,
} from '../features/profile/views.jsx';
import {MyMuseumsView, RouteResultView} from '../features/routes/views.jsx';
import {ArtifactFoundView, ArtifactReceivedView, ArtifactCardView} from '../features/artifact/views.jsx';
import {QrScannerView} from '../features/scanner/views.jsx';
import {AuthView, ForgotPasswordView, ForgotPasswordSentView, ResetPasswordView, ResetPasswordSuccessView} from '../features/auth/views.jsx';
import {NotFoundView} from '../features/not-found/views.jsx';
import {SkeletonCards} from '../components/ui.jsx';

const StoryExperienceView = lazy(() => import('../features/story/TrackedStoryExperience.jsx').then(m => ({default: m.TrackedStoryExperience})));

export function ViewContent({data, navigate, actions}) {
  const {view} = data;

  switch (view) {
    case 'onboarding':
      return <OnboardingView actions={actions} />;
    case 'museumSelect':
      return <MuseumSelectView data={data} navigate={navigate} actions={actions} />;
    case 'museumDetail':
      return <MuseumDetailView data={data} navigate={navigate} actions={actions} />;
    case 'profileCollection':
      return <CollectionView data={data} navigate={navigate} actions={actions} />;
    case 'profileHome':
      return data.isAuthenticated
        ? <ProfileHomeView data={data} navigate={navigate} actions={actions} />
        : <ProfileGuestView data={data} navigate={navigate} />;
    case 'profileAchievements':
      return <ProfileAchievementsView data={data} navigate={navigate} />;
    case 'profileSettings':
      return <ProfileSettingsView data={data} navigate={navigate} actions={actions} />;
    case 'publicProfile':
      return <PublicProfileView data={data} navigate={navigate} />;
    case 'deleteAccount':
      return <DeleteAccountView navigate={navigate} actions={actions} />;
    case 'accountDeleted':
      return <AccountDeletedView navigate={navigate} />;
    case 'auth':
      return <AuthView navigate={navigate} actions={actions} />;
    case 'forgotPassword':
      return <ForgotPasswordView navigate={navigate} />;
    case 'forgotPasswordSent':
      return <ForgotPasswordSentView navigate={navigate} />;
    case 'resetPassword':
      return <ResetPasswordView navigate={navigate} />;
    case 'resetPasswordSuccess':
      return <ResetPasswordSuccessView navigate={navigate} />;
    case 'myMuseums':
      return <MyMuseumsView data={data} navigate={navigate} actions={actions} />;
    case 'routeResult':
      return <RouteResultView data={data} navigate={navigate} />;
    case 'artifactFound':
      return <ArtifactFoundView data={data} navigate={navigate} actions={actions} />;
    case 'artifactReceived':
      return <ArtifactReceivedView data={data} navigate={navigate} />;
    case 'artifactCard':
      return <ArtifactCardView data={data} navigate={navigate} actions={actions} />;
    case 'qrScanner':
      return <QrScannerView navigate={navigate} actions={actions} />;
    case 'storyExperience':
      return (
        <Suspense fallback={<div style={{padding: '20px'}}><SkeletonCards count={3} /></div>}>
          <StoryExperienceView data={data} navigate={navigate} actions={actions} />
        </Suspense>
      );
    case 'notFound':
      return <NotFoundView navigate={navigate} />;
    default:
      return <MuseumSelectView data={data} navigate={navigate} actions={actions} />;
  }
}
