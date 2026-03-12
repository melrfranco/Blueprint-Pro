import { createServer } from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function start() {
  const vite = await createViteServer({
    configFile: path.resolve(__dirname, 'vite.config.ts'),
    server: {
      middlewareMode: true,
      hmr: false,
    },
    appType: 'spa',
  });

  const http = createServer((req, res) => {
    vite.middlewares.handle(req, res, () => {
      res.statusCode = 404;
      res.end('Not Found');
    });
  });

  const port = process.env.PORT || 3000;
  http.listen(port, '0.0.0.0', () => {
    console.log(`Dev server running at http://localhost:${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
