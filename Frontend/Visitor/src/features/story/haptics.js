/* Vibration is a progressive enhancement: unsupported browsers and denied
   permissions must never break the story flow. */
export function haptic(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}
