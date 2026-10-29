import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'embed-document',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith('/embed/')) req.url = '/embed.html';
        next();
      });
    },
  }],
  server: {
    port: parseInt(process.env.PORT || '5174'),
    strictPort: false,
    proxy: {
      ...Object.fromEntries([['route',8083],['feedback',8086]].map(([name,port]) => [`/api/${name}`, {target: process.env[`VITE_${name.toUpperCase()}_DEV_TARGET`] || `http://127.0.0.1:${port}`, changeOrigin:true, rewrite: (path) => path.replace(`/api/${name}`, '')}])),
      '/api/visitor': {
        target: process.env.VITE_VISITOR_DEV_TARGET || 'http://127.0.0.1:8088',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/visitor/, ''),
      },
      '/api/auth': {
        target: process.env.VITE_AUTH_DEV_TARGET || 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/auth/, ''),
      },
      '/api/artifacts': {
        target: process.env.VITE_ARTIFACTS_DEV_TARGET || 'http://127.0.0.1:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/artifacts/, ''),
      },
      '/api/analytics': {
        target: process.env.VITE_ANALYTICS_DEV_TARGET || 'http://127.0.0.1:8085',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/analytics/, ''),
      },
    },
  },
  build: {
    rolldownOptions: {
      input: {main: new URL("./index.html", import.meta.url).pathname, embed: new URL("./embed.html", import.meta.url).pathname},
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react';
          }

          if (id.includes('@gravity-ui/uikit') || id.includes('@gravity-ui/icons')) {
            return 'gravity';
          }

          return undefined;
        },
      },
    },
  },
});
