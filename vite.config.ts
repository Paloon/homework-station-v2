import { defineConfig, loadEnv } from 'vite';
import health from './api/health';

export default defineConfig(({ mode }) => ({
  plugins: [{
    name: 'local-health-endpoint',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), 'SUPABASE_');
      for (const [key, value] of Object.entries(env)) process.env[key] = value;
      server.middlewares.use('/api/health', (request, response) => { void health(request, response); });
    },
  }],
}));
