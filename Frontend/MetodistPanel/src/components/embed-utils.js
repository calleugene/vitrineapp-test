const escapeAttribute = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function embedDetails(publicUrl, height = 640, title = 'Опубликованный экспонат') {
  try {
    const url = new URL(publicUrl);
    const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    const match = url.pathname.match(/^\/exhibits\/((?:[a-z0-9]{5}|[a-f0-9]{10}))\/?$/i);
    if (!match || url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) return null;
    const size = Math.min(1200, Math.max(320, Math.round(Number(height) || 640)));
    url.pathname = `/exhibits/${match[1].toUpperCase()}`;
    url.search = ''; url.hash = '';
    const standalone = url.href;
    url.pathname = `/embed${url.pathname}`;
    const src = url.href;
    return {src, height:size, standalone, html:`<iframe src="${escapeAttribute(src)}" title="${escapeAttribute(title)}" width="100%" height="${size}" style="border:0;display:block" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>\n<p><a href="${escapeAttribute(standalone)}" target="_blank" rel="noopener noreferrer">Открыть экспонат отдельно</a></p>`};
  } catch { return null; }
}
