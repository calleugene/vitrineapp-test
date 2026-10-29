import React from 'react';
import {createRoot} from 'react-dom/client';
import {EmbedArtifact} from './features/public-artifact/EmbedArtifact.jsx';

const code = window.location.pathname.match(/^\/embed\/exhibits\/((?:[a-z0-9]{5}|[a-f0-9]{10}))\/?$/i)?.[1]?.toUpperCase() || '';
createRoot(document.getElementById('root')).render(<React.StrictMode><EmbedArtifact code={code} /></React.StrictMode>);
