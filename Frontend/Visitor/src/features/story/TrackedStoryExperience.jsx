import React, {useCallback, useEffect} from 'react';
import {analyticsEvents} from '../../app/analytics-events.js';
import {StoryExperienceView} from './views.jsx';

export function TrackedStoryExperience({data, navigate, actions}) {
  const artifactId = data?.activeArtifactId;
  const publicCode = data?.museumDetail?.artifacts?.find((artifact) => artifact.id === artifactId)?.publicCode || '';
  const museumId = data?.selectedMuseumId;
  const startVisit = useCallback(() => {
    if (publicCode) analyticsEvents.trackOnce(`visit:${museumId || publicCode}`, 'visit_start', {public_code:publicCode, artifact_id:artifactId, source:'route'});
  }, [publicCode, artifactId, museumId]);
  useEffect(startVisit, [startVisit]);
  const track = useCallback((type, payload) => {
    if (!publicCode) return;
    startVisit();
    analyticsEvents.track(type, {public_code:publicCode, artifact_id:artifactId, source:'route', ...payload});
  }, [publicCode, artifactId, startVisit]);
  const trackOnce = useCallback((key, type, payload) => {
    if (!publicCode) return;
    startVisit();
    analyticsEvents.trackOnce(`${publicCode}:${key}`, type, {public_code:publicCode, artifact_id:artifactId, source:'route', ...payload});
  }, [publicCode, artifactId, startVisit]);
  return <StoryExperienceView data={data} navigate={navigate} actions={actions} onTrackEvent={track} onTrackEventOnce={trackOnce} />;
}
