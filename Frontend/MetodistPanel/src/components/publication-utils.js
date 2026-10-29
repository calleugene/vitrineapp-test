export function normalizePublicUrl(value, origin) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, origin);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

export function routePublicUrl(route, origin) {
  if (!route?.id || route.serverSaved !== true || route.status !== 'published' || route.visibility !== 'public') return '';
  return normalizePublicUrl(`/routes/${encodeURIComponent(route.id)}`, origin);
}

export function artifactPublicUrl(artifact, publication, origin) {
  if (!artifact?.id || artifact.status !== 'published' || !(artifact.published_revision > 0)) return '';
  const result = publication?.artifact_id === artifact.id ? publication : null;
  const url = result?.public_url || result?.publicUrl || artifact.public_url || artifact.publicUrl;
  return normalizePublicUrl(url || (artifact.public_code ? `/exhibits/${encodeURIComponent(artifact.public_code)}` : ''), origin);
}
