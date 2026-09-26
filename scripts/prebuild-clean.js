/**
 * Automated Build Cache Purge Script
 * Flushes local build caches (node_modules/.vite, dist, .cache, and temp compiler buffers)
 * prior to executing a production build to prevent corrupted file retention or stale chunks.
 */

import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const targetPurgeDirs = [
  path.join(projectRoot, 'dist'),
  path.join(projectRoot, 'node_modules', '.vite'),
  path.join(projectRoot, '.vite'),
  path.join(projectRoot, '.cache'),
  path.join(projectRoot, 'dev-dist'),
];

console.log('🛡️ [Governance Purge] Starting automated build cache purge...');

let purgedCount = 0;
for (const dir of targetPurgeDirs) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(` ✓ Purged cache directory: ${path.relative(projectRoot, dir)}`);
      purgedCount++;
    }
  } catch (err) {
    console.warn(` ⚠️ Notice while purging ${path.relative(projectRoot, dir)}:`, err.message);
  }
}

console.log(`🛡️ [Governance Purge] Purge complete. ${purgedCount} target directories refreshed. Ready for clean build.\n`);
