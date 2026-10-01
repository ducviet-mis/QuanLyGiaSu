import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],optimizeDeps:{esbuildOptions:{tsconfigRaw:{compilerOptions:{}}}},build:{chunkSizeWarningLimit:1000}});
