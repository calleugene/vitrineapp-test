import {useCallback, useEffect, useState} from 'react';
import {ROUTE_WIZARD_VIEWS} from './navigation';
import {
  DEFAULT_ROUTE_DRAFT,
  createRouteDraftFromRow,
  createPublishedRouteDraft,
  markRouteDeleted,
  persistRouteDraft,
  readStoredRouteDraft,
} from './route-draft-utils';
import {moveItem} from './array';
import {routeApi} from '../api';
import {ROUTE_API_ENABLED} from './config';



export function useRouteDraft({onNavigate}) {
  const [routeDraft, setRouteDraft] = useState(readStoredRouteDraft);
  const [createdRoute, setCreatedRoute] = useState(null);
  const [routeSyncError, setRouteSyncError] = useState(null);

  useEffect(() => {
    persistRouteDraft(routeDraft);
  }, [routeDraft]);

  const resetRouteDraft = useCallback(() => {
    setRouteDraft(DEFAULT_ROUTE_DRAFT);
    setCreatedRoute(null);
  }, []);

  const startRouteFlow = useCallback(() => {
    setRouteDraft({...DEFAULT_ROUTE_DRAFT, artifactIds: []});
    setCreatedRoute(null);
    onNavigate('route-basic');
  }, [onNavigate]);

  const goToRouteStep = useCallback(
    (step) => {
      const nextView = ROUTE_WIZARD_VIEWS[step - 1];
      if (nextView) {
        onNavigate(nextView);
      }
    },
    [onNavigate]
  );

  const toggleRouteArtifact = useCallback(async (artifactId) => {
    const currentRouteId = routeDraft.serverSaved && routeDraft.id ? routeDraft.id : null;
    const isSelected = routeDraft.artifactIds.includes(artifactId);
    if (ROUTE_API_ENABLED && currentRouteId) {
      try {
        if (isSelected) await routeApi.removeArtifact(currentRouteId, artifactId);
        else await routeApi.addArtifact(currentRouteId, {artifact_id: artifactId, order: routeDraft.artifactIds.length});
        setRouteSyncError(null);
      } catch (error) { setRouteSyncError(error); return; }
    }
    setRouteDraft((prev) => {
      return {
        ...prev,
        artifactIds: isSelected
          ? prev.artifactIds.filter((id) => id !== artifactId)
          : [...prev.artifactIds, artifactId],
      };
    });
  }, [routeDraft]);

  const reorderRouteArtifact = useCallback(async (fromId, toId) => {
    const currentRouteId = routeDraft.serverSaved && routeDraft.id ? routeDraft.id : null;
    const fromIndex = routeDraft.artifactIds.indexOf(fromId);
    const toIndex = routeDraft.artifactIds.indexOf(toId);
    const nextIds = fromIndex === -1 || toIndex === -1 ? routeDraft.artifactIds : moveItem(routeDraft.artifactIds, fromIndex, toIndex);
    if (ROUTE_API_ENABLED && currentRouteId && nextIds !== routeDraft.artifactIds) {
      try { await routeApi.reorderArtifacts(currentRouteId, nextIds); setRouteSyncError(null); }
      catch (error) { setRouteSyncError(error); return; }
    }
    setRouteDraft((prev) => {
      const fromIndex = prev.artifactIds.indexOf(fromId);
      const toIndex = prev.artifactIds.indexOf(toId);
      if (fromIndex === -1 || toIndex === -1) {
        return prev;
      }

      return {
        ...prev,
        artifactIds: moveItem(prev.artifactIds, fromIndex, toIndex),
      };
    });
  }, [routeDraft]);

  const editRoute = useCallback((routeRow) => {
    setCreatedRoute(null);
    setRouteDraft((prev) => ({
      ...createRouteDraftFromRow(routeRow),
      deletedRouteIds: prev.deletedRouteIds || [],
    }));
    onNavigate('route-basic');
  }, [onNavigate]);

  const deleteRoute = useCallback(async (routeRow) => {
    setCreatedRoute(null);
    setRouteSyncError(null);
    if (ROUTE_API_ENABLED && routeRow?.id) {
      try { await routeApi.remove(routeRow.id); }
      catch (error) { setRouteSyncError(error); return; }
    }
    setRouteDraft((prev) => markRouteDeleted(prev, routeRow.id));
    onNavigate('routes');
  }, [onNavigate]);

  const publishRoute = useCallback(async () => {
    const nextRoute = createPublishedRouteDraft(routeDraft);
    nextRoute.status = routeDraft.status;
    setRouteSyncError(null);
    if (ROUTE_API_ENABLED) {
      try {
        const existingId = routeDraft.serverSaved && routeDraft.id ? routeDraft.id : null;
        const response = existingId
          ? await routeApi.update(existingId, {title: nextRoute.title, subtitle: nextRoute.subtitle, description: nextRoute.description, duration: nextRoute.duration, audience: nextRoute.audience, difficulty: nextRoute.difficulty, language: nextRoute.language, visibility: nextRoute.visibility === 'team' ? 'private' : nextRoute.visibility, show_on_map: nextRoute.showOnMap, require_qr: nextRoute.requireQr, artifact_ids: nextRoute.artifactIds, status: nextRoute.status})
          : await routeApi.create({title: nextRoute.title, subtitle: nextRoute.subtitle, description: nextRoute.description, duration: nextRoute.duration, audience: nextRoute.audience, difficulty: nextRoute.difficulty, language: nextRoute.language, visibility: nextRoute.visibility === 'team' ? 'private' : nextRoute.visibility, show_on_map: nextRoute.showOnMap, require_qr: nextRoute.requireQr, artifact_ids: nextRoute.artifactIds, status: nextRoute.status});
        const persisted = response?.route || response;
        if (!persisted?.id) throw new Error('Сервер не подтвердил сохранение маршрута');
        nextRoute.id = persisted.id;
        nextRoute.serverSaved = true;
      } catch (error) { setRouteSyncError(error); return; }
    }

    setCreatedRoute(nextRoute);
    setRouteDraft(nextRoute);
    onNavigate('route-success');
  }, [onNavigate, routeDraft]);

  const createAnotherRoute = useCallback(() => {
    resetRouteDraft();
    onNavigate('route-basic');
  }, [onNavigate, resetRouteDraft]);

  return {
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
    routeSyncError,
    createAnotherRoute,
  };
}



