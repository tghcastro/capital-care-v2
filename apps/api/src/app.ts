/**
 * Express application
 *
 * Composition root: wires Express and mounts module routers.
 * No business logic lives here — all logic is in modules.
 */

import path from 'node:path';
import express from 'express';
import { createLedgerRouters } from '@capital-care/ledger';

export function createApp(): express.Express {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '100kb' }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Mount routers from modules/ledger
  const { categoryRouter, accountRouter, transactionRouter } = createLedgerRouters();
  app.use('/categories', categoryRouter);
  app.use('/accounts', accountRouter);
  app.use('/transactions', transactionRouter);

  // Built web app (same origin as the API). Registered after the API routers so it never
  // shadows them. Served only when WEB_DIST_PATH is set; there is no SPA fallback yet.
  const webDistPath = process.env.WEB_DIST_PATH;
  if (webDistPath) {
    const root = path.resolve(webDistPath);
    app.use(
      express.static(root, {
        setHeaders: (res, filePath) => {
          const relative = path.relative(root, filePath).split(path.sep);
          if (relative[0] === 'assets') {
            // Vite hashes asset file names, so their content never changes under one URL.
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (relative.join('/') === 'index.html') {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );
  }

  // Error handling middleware (last in the chain)
  app.use(
    (
      err: Error & { statusCode?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ): void => {
      console.error('Unhandled error:', err);
      res.status(err.statusCode || 500).json({
        type: 'about:blank',
        title: err.constructor.name,
        status: err.statusCode || 500,
        detail: err.message,
        instance: _req.url,
      });
    },
  );

  return app;
}
