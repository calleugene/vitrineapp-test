import {useCallback, useEffect, useMemo, useRef} from 'react';
import {haptic} from './haptics';

const DEFAULT_IDLE_MS = 3000;
const DEFAULT_ACTIVATE_PATTERN = [8, 30, 8];

/**
 * Idle timer for the AR interaction mode: activates AR, resets on interaction
 * and deactivates it once the visitor stops touching the model.
 * Returned callbacks have stable identity, so effects can depend on them.
 */
export function useArIdle({onDeactivate, idleMs = DEFAULT_IDLE_MS, hapticOnActivate = DEFAULT_ACTIVATE_PATTERN} = {}) {
  const timerRef = useRef(null);
  const onDeactivateRef = useRef(onDeactivate);
  const idleMsRef = useRef(idleMs);
  const hapticOnActivateRef = useRef(hapticOnActivate);

  useEffect(() => { onDeactivateRef.current = onDeactivate; }, [onDeactivate]);
  useEffect(() => { idleMsRef.current = idleMs; }, [idleMs]);
  useEffect(() => { hapticOnActivateRef.current = hapticOnActivate; }, [hapticOnActivate]);

  const schedule = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onDeactivateRef.current?.(), idleMsRef.current);
  }, []);

  const activate = useCallback(() => {
    haptic(hapticOnActivateRef.current);
    schedule();
  }, [schedule]);

  const reset = useCallback(() => schedule(), [schedule]);

  const deactivate = useCallback(() => {
    clearTimeout(timerRef.current);
    onDeactivateRef.current?.();
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return useMemo(() => ({activate, reset, deactivate}), [activate, reset, deactivate]);
}

