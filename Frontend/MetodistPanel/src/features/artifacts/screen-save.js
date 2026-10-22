export function createScreenSaveHandler({savingRef, setSaving, onSave, onSaved}) {
  return async (title, body, imageURL) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    let saved;
    try {
      saved = Boolean(await onSave(title, body, imageURL));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    if (saved) onSaved();
    return saved;
  };
}
