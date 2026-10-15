import {useEffect, useRef, useState} from 'react';
import {
	getDocumentTitle,
	getRouteFromPathname,
	getPathnameFromView,
  normalizePathname,
} from './routes';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const appPathname = () => {
  const pathname = window.location.pathname;
  return basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))
    ? pathname.slice(basePath.length) || '/'
    : pathname;
};

export function useViewRouting({isAuthenticated}) {
	const [route, setRoute] = useState(() => getRouteFromPathname(appPathname()));
	const {view, artifactId} = route;
  const historyModeRef = useRef('replace');

  const setView = (nextView, options = {}) => {
    historyModeRef.current = options.replace ? 'replace' : 'push';
		setRoute({view: nextView, artifactId: nextView.startsWith('artifact-') ? (options.artifactId ?? artifactId) : null});
  };

  useEffect(() => {
    const handlePopState = () => {
      historyModeRef.current = 'replace';
		setRoute(getRouteFromPathname(appPathname()));
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
    const currentPathname = normalizePathname(appPathname());

    if (currentPathname !== nextPathname) {
      const historyMethod = historyModeRef.current === 'replace' ? 'replaceState' : 'pushState';
      window.history[historyMethod]({}, '', `${basePath}${nextPathname}`);
    }

    historyModeRef.current = 'push';
	}, [artifactId, isAuthenticated, view]);

  return {
		view,
		artifactId,
    setView,
  };
}
