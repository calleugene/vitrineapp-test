import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';

const ToastContext = createContext({show: () => {}});

const MAX_TOASTS = 3;
let nextId = 0;

const ICON = {
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="rgba(22,163,74,0.12)" />
      <path d="m7.5 12 3 3 6-6" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="rgba(220,38,38,0.12)" />
      <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="rgba(105,91,255,0.12)" />
      <path d="M12 8v.01M12 11v5" stroke="#695bff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  warning: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="rgba(217,119,6,0.12)" />
      <path d="M12 8v4m0 4h.01" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
};

function ToastItem({toast, onDismiss}) {
  const [leaving, setLeaving] = useState(false);
  const exitTimer = useRef(null);

  const dismiss = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    exitTimer.current = setTimeout(() => onDismiss(toast.id), 270);
  }, [leaving, onDismiss, toast.id]);

  useEffect(() => () => clearTimeout(exitTimer.current), []);

  return (
    <div
      className={`vl-toast vl-toast--${toast.type}${leaving ? ' is-leaving' : ''}`}
      role="alert"
      onClick={dismiss}
    >
      <div className="vl-toast-body">
        <span className="vl-toast-icon">{ICON[toast.type] || ICON.info}</span>
        <span className="vl-toast-text">{toast.message}</span>
      </div>
      <button
        className="vl-toast-close"
        type="button"
        onClick={e => { e.stopPropagation(); dismiss(); }}
        aria-label="Закрыть"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>
      <div
        className="vl-toast-bar"
        aria-hidden="true"
        style={{'--toast-dur': `${toast.duration}ms`}}
      />
    </div>
  );
}

export function ToastProvider({children}) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts(list => list.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const show = useCallback((message, options = {}) => {
    if (!message) return;
    const {type = 'info', duration = 3200} = options;
    const id = ++nextId;
    setToasts(list => [...list, {id, message, type, duration}].slice(-MAX_TOASTS));
    timers.current.set(id, setTimeout(() => dismiss(id), Math.max(1200, duration)));
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{show}}>
      {children}
      <div className="vl-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// This hook intentionally shares the provider context from this module.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext);
}
