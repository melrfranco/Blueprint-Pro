import { createServer } from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function start() {
  // Create HTTP server FIRST
  const httpServer = createServer();

  const port = process.env.PORT || 3000;

  // Create Vite and attach HMR to the existing HTTP server
  // so it doesn't try to create its own WebSocket server
  const vite = await createViteServer({
    configFile: path.resolve(__dirname, 'vite.config.ts'),
    server: {
      middlewareMode: true,
      hmr: {
        server: httpServer,
      },
      allowedHosts: true,
    },
    appType: 'spa',
  });

  // Use Vite's connect middleware
  httpServer.on('request', (req, res) => {
    vite.middlewares.handle(req, res, () => {
      res.statusCode = 404;
      res.end('Not Found');
    });
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Dev server running at http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
