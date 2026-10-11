import {useEffect, useRef, useState} from 'react';
import {
	getDocumentTitle,
	getRouteFromPathname,
	getPathnameFromView,
  normalizePathname,
} from './routes';

export function useViewRouting({isAuthenticated}) {
	const [route, setRoute] = useState(() => getRouteFromPathname(window.location.pathname));
	const {view, artifactId} = route;
  const historyModeRef = useRef('replace');

  const setView = (nextView, options = {}) => {
    historyModeRef.current = options.replace ? 'replace' : 'push';
		setRoute({view: nextView, artifactId: nextView.startsWith('artifact-') ? (options.artifactId ?? artifactId) : null});
  };

  useEffect(() => {
    const handlePopState = () => {
      historyModeRef.current = 'replace';
		setRoute(getRouteFromPathname(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    document.title = getDocumentTitle(view, isAuthenticated);

    if (!isAuthenticated) {
      return;
    }

		const nextPathname = getPathnameFromView(view, artifactId);
    const currentPathname = normalizePathname(window.location.pathname);

    if (currentPathname !== nextPathname) {
      const historyMethod = historyModeRef.current === 'replace' ? 'replaceState' : 'pushState';
      window.history[historyMethod]({}, '', nextPathname);
    }

    historyModeRef.current = 'push';
	}, [artifactId, isAuthenticated, view]);

  return {
		view,
		artifactId,
    setView,
  };
}
