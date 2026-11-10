import { createApp } from './app.js';
import { closeLedgerDatabase } from '@capital-care/ledger';

const PORT = process.env.PORT || 3000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`✓ Capital Care API running on http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ Create category: POST http://localhost:${PORT}/categories`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received, shutting down`);
  const forceExit = setTimeout(() => {
    closeLedgerDatabase();
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(() => {
    closeLedgerDatabase();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
