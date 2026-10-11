import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
});
