export function hasUnsavedScreenChanges(values, original) {
  return ['title', 'body', 'imageURL'].some((key) => values[key] !== original[key]);
}

export function createScreenNavigationGuard({isDirty, isPending, confirmDiscard, navigate}) {
  return (...args) => {
    if (isPending()) return false;
    if (isDirty() && !confirmDiscard()) return false;
    navigate(...args);
    return true;
  };
}
