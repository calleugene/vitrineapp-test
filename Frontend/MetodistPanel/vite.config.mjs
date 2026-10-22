import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({command}) => ({
  base: command === 'build' ? '/methodist/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      ...Object.fromEntries([['route',8083],['feedback',8086],['notification',8087]].map(([name,port]) => [`/api/${name}`, {target: process.env[`VITE_${name.toUpperCase()}_DEV_TARGET`] || `http://127.0.0.1:${port}`, changeOrigin:true, rewrite: (path) => path.replace(`/api/${name}`, '')}])),
      '/api/analytics': {
        target: process.env.VITE_ANALYTICS_DEV_TARGET || 'http://127.0.0.1:8085',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/analytics/, ''),
      },
      '/api/dashboard': {
        target: process.env.VITE_DASHBOARD_DEV_TARGET || 'http://127.0.0.1:8084',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/dashboard/, ''),
      },
    },
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react';
          }

          if (id.includes('@gravity-ui/uikit') || id.includes('@gravity-ui/icons')) {
            return 'gravity';
          }

          if (id.includes('chart.js')) {
            return 'charts';
          }

          return undefined;
        },
      },
    },
  },
}));
