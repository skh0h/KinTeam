import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'info', // Show startup banner (Local: http://localhost:5180) and info logs
  server: {
    port: 5180,
    strictPort: true,
  },
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: false,
      visualEditAgent: true
    }),
    react(),
  ],
  resolve: {
    alias: [
      // Redirect the specific base44Client specifier to the backend adapter.
      // This reroutes all 33 component imports at build time without editing them.
      // The general '@' alias below must come AFTER this entry.
      {
        find: '@/api/base44Client',
        replacement: fileURLToPath(new URL('./src/api/backendAdapter.js', import.meta.url)),
      },
      // General '@' → 'src' alias (provided here since @base44/vite-plugin injects it
      // internally but we need it declared for resolve.alias to work correctly).
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
});