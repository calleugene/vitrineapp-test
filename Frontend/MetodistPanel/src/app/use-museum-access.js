import {useCallback, useEffect, useState} from 'react';
import {authApi} from '../api';

// Profile cards and the sidebar share the same confirmed backend memberships.
export function useMuseumAccess({userId, accessToken, active, isMock}) {
  const [museums, setMuseums] = useState([]);
  const [state, setState] = useState('loading');
  const applyMuseums = useCallback((next) => {
    setMuseums(Array.isArray(next) ? next : []);
    setState('ready');
  }, []);
  const refreshMuseums = useCallback(async () => {
    if (!userId || !active || isMock) return;
    setState('loading');
    try {const response = await authApi.getMuseums(userId); applyMuseums(response.museums);}
    catch {setState('error');}
  }, [userId, active, isMock, applyMuseums]);

  useEffect(() => {
    if (!userId || !active || isMock) {setMuseums([]); setState('ready'); return undefined;}
    let cancelled = false;
    setMuseums([]); setState('loading');
    authApi.getMuseums(userId).then(({museums: next}) => {if (!cancelled) applyMuseums(next);}).catch(() => {if (!cancelled) setState('error');});
    return () => {cancelled = true;};
  }, [userId, accessToken, active, isMock, applyMuseums]);

  return {museums, museumState:state, refreshMuseums, applyMuseums};
}
