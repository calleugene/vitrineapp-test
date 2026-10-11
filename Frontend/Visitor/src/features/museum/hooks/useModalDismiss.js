import {useCallback, useEffect, useRef} from 'react';

/* Закрытие модалки по Escape и первый фокус внутри неё.

   По образцу InfoModal из features/profile/views.jsx: слушатель живёт ровно
   столько, сколько открыта модалка (компонент монтируется только при открытии). */
export function useModalDismiss(onClose) {
  const closeRef = useRef(null);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return closeRef;
}
