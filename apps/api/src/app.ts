/**
 * Express application
 *
 * Composition root: wires Express and mounts module routers.
 * No business logic lives here — all logic is in modules.
 */

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
  const { categoryRouter, accountRouter } = createLedgerRouters();
  app.use('/categories', categoryRouter);
  app.use('/accounts', accountRouter);

  // Error handling middleware (last in the chain)
  app.use(
    (
      err: any,
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
