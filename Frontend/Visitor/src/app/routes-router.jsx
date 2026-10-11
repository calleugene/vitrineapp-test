import {useEffect, useRef} from 'react';

function parseDeepLink(path) {
  // /m{num}  or  /m{num}/r{num}
  const museumMatch = path.match(/^\/m(\d+)(?:\/r\d+)?$/);
  if (museumMatch) return {type: 'museum', num: parseInt(museumMatch[1], 10)};

  // /a{num}
  const artifactMatch = path.match(/^\/a(\d+)$/);
  if (artifactMatch) return {type: 'artifact', num: parseInt(artifactMatch[1], 10)};

  return null;
}

export function useUrlSync(state, actions) {
  const deepLinkHandled = useRef(false);
  const pendingArtifactNum = useRef(null);

  // After bootstrap, resolve numeric deep link → string ID
  useEffect(() => {
    if (state.loading || deepLinkHandled.current) return;
    deepLinkHandled.current = true;

    const parsed = parseDeepLink(window.location.pathname);
    if (!parsed) return;

    if (parsed.type === 'museum') {
      const museum = state.museums[parsed.num - 1];
      if (museum) actions.selectMuseum(museum.id);
    } else if (parsed.type === 'artifact') {
      pendingArtifactNum.current = parsed.num;
    }
  }, [state.loading, state.museums, actions]);

  // Open pending artifact once museum detail is available
  useEffect(() => {
    if (pendingArtifactNum.current === null || !state.museumDetail) return;
    const num = pendingArtifactNum.current;
    pendingArtifactNum.current = null;
    const artifact = state.museumDetail.artifacts[num - 1];
    if (artifact) actions.openArtifactFromCollection(artifact.id);
  }, [state.museumDetail, actions]);

  // Keep URL in sync: convert string IDs → numeric position
  useEffect(() => {
    const {selectedMuseumId, activeArtifactId, view, museums, museumDetail} = state;

    let urlPath;
    if ((view === 'artifactCard' || view === 'storyExperience') && activeArtifactId && museumDetail) {
      const idx = museumDetail.artifacts.findIndex((a) => a.id === activeArtifactId);
      if (idx >= 0) urlPath = `/a${idx + 1}`;
    } else if (view === 'museumDetail' && selectedMuseumId && museums.length > 0) {
      const idx = museums.findIndex((m) => m.id === selectedMuseumId);
      if (idx >= 0) urlPath = `/m${idx + 1}/r1`;
    }

    if (!urlPath || window.location.pathname === urlPath) return;
    window.history.replaceState({view, selectedMuseumId, activeArtifactId}, '', urlPath);
  }, [state]);
}
