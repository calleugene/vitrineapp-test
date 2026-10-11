// Keep leading zeroes when matching exhibit codes.
export function findArtifactBySecretCode(museum, code) {
  if (!/^[0-9]{5}$/.test(code)) return null;
  return museum?.artifacts?.find((artifact) =>
    String(artifact.secretCode || artifact.secret_code || '') === code,
  ) || null;
}

export function readQrArtifactId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/\/a\/([^/?#]+)/);
  try {
    return match ? decodeURIComponent(match[1]) : raw;
  } catch {
    return '';
  }
}
