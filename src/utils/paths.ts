import { withBase } from '../lib/paths.mjs';

/** Joins a root-absolute path with the configured base path (GitHub Pages / custom domain). */
export function sitePath(path = '/'): string {
  return withBase(path, import.meta.env.BASE_URL || '/');
}

/** Same as sitePath(), named for media assets to make intent explicit at call sites. */
export function assetUrl(path = '/'): string {
  return sitePath(path);
}
