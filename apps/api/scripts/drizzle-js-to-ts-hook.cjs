/**
 * Node.js `--require` hook loaded before drizzle-kit.
 *
 * Problem: drizzle-kit uses esbuild-register (CJS) to load TypeScript schema
 * files. Our project uses NodeNext module resolution which requires explicit
 * `.js` extensions in import paths (e.g. `import { foo } from './bar.js'`).
 * CJS `require()` cannot find `./bar.js` when only `./bar.ts` exists on disk.
 *
 * Solution: override Module._resolveFilename via Object.defineProperty with a
 * custom setter so that every time drizzle-kit installs its own wrapper, we
 * wrap that wrapper with our `.js → .ts` fallback. This survives drizzle-kit's
 * safeRegister/unregister cycles.
 */
'use strict';
const Module = require('module');

function makeJsToTsPatcher(inner) {
  return function patchedResolveFilename(request, parent, isMain, options) {
    if (
      typeof request === 'string' &&
      request.endsWith('.js') &&
      request.startsWith('.')
    ) {
      try {
        return inner.call(this, request.slice(0, -3) + '.ts', parent, isMain, options);
      } catch (_e) {
        // fall through to original .js resolution
      }
    }
    return inner.call(this, request, parent, isMain, options);
  };
}

// Intercept every future assignment to _resolveFilename so our patch
// stays outermost regardless of how many times drizzle-kit rewires it.
let _current = makeJsToTsPatcher(Module._resolveFilename);
Object.defineProperty(Module, '_resolveFilename', {
  get() {
    return _current;
  },
  set(fn) {
    // drizzle-kit is installing a new resolver — wrap it with our patcher.
    _current = makeJsToTsPatcher(fn);
  },
  configurable: true,
  enumerable: true,
});
