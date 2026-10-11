import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.PORT || '5174'),
    strictPort: false,
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

          return undefined;
        },
      },
    },
  },
});
