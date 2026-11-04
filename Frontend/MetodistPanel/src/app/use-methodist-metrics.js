import {useCallback, useEffect, useRef} from 'react';
import {analyticsApi} from '../api';

const SAMPLE_MS = 15000;
const SESSION_IDLE_MS = 30 * 60 * 1000;
const metricId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');

export function useMethodistMetrics(enabled, userId) {
  const session = useRef(null);

  const record = useCallback((kind, id, duration) => {
    const durationMs = Math.round(duration);
    if (!enabled || !session.current || durationMs < 1 || durationMs > 86400000) return;
    void analyticsApi.recordMethodistMetric({
      kind, id, duration_ms: durationMs, session_key: session.current.id,
    }).catch(() => {});
  }, [enabled]);

  useEffect(() => {
    session.current = null;
  }, [userId]);

  useEffect(() => {
    if (!enabled) return;
    let visibleSince = null;
    function sync() {
      const now = performance.now();
      if (visibleSince !== null) {
        record('session', metricId(), Math.min(SAMPLE_MS, now - visibleSince));
        session.current.lastSeen = now;
      }
      if (document.hidden) {
        visibleSince = null;
        return;
      }
      if (!session.current || now - session.current.lastSeen >= SESSION_IDLE_MS) {
        session.current = {id: metricId(), lastSeen: now};
      }
      visibleSince = now;
    }
    sync();
    const timer = setInterval(sync, SAMPLE_MS);
    document.addEventListener('visibilitychange', sync);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [enabled, userId, record]);

  return record;
}
