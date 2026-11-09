/**
 * Module resolution shim for drizzle-kit (CommonJS loader).
 *
 * The project uses NodeNext ESM, so TypeScript imports carry `.js`
 * extensions (e.g. `./user.entity.js` pointing at `user.entity.ts`).
 * drizzle-kit 0.20 loads the schema through CommonJS and cannot resolve
 * those specifiers. This hook retries a failed `.js` lookup with `.ts`.
 *
 * Loaded only by the `db:generate` script via NODE_OPTIONS.
 */

const Module = require('node:module');

const originalResolve = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  try {
    return originalResolve.call(this, request, parent, isMain, options);
  } catch (error) {
    if (request.endsWith('.js')) {
      return originalResolve.call(
        this,
        request.slice(0, -3) + '.ts',
        parent,
        isMain,
        options,
      );
    }
    throw error;
  }
};
