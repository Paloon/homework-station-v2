import { defineConfig, loadEnv } from 'vite';
import health from './api/health';

export default defineConfig(({ mode }) => ({
  // Browser fixtures must never inherit the database configured for normal development.
  define: mode === 'test' ? {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(''),
  } : undefined,
  plugins: [{
    name: 'local-health-endpoint',
    configureServer(server) {
      const env = mode === 'test' ? { SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' } : loadEnv(mode, process.cwd(), 'SUPABASE_');
      for (const [key, value] of Object.entries(env)) process.env[key] = value;
      server.middlewares.use('/api/health', (request, response) => { void health(request, response); });
    },
  }],
}));
