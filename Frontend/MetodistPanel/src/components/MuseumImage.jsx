import React, {useState} from 'react';
import fallback from '../assets/museum-universal.webp';

// Prefer the backend image; a failed URL also falls back to the universal illustration.
export function MuseumImage({src, alt = '', className, ...props}) {
  const [failedSrc, setFailedSrc] = useState(null);
  return <img {...props} className={className} src={src && src !== failedSrc ? src : fallback} alt={alt} width="64" height="64" onError={() => { if (src) setFailedSrc(src); }} />;
}
