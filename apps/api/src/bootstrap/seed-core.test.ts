import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { getAppDir } = require('../../scripts/seed-core.js');

describe('production seed core helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves Strapi appDir independently from current working directory', () => {
    const originalCwd = process.cwd();
    const expectedAppDir = getAppDir();
    const directory = mkdtempSync(join(tmpdir(), 'seed-core-cwd-'));

    try {
      process.chdir(directory);

      expect(getAppDir()).toBe(expectedAppDir);
      expect(getAppDir()).toMatch(/apps\/api$/);
      expect(isAbsolute(getAppDir())).toBe(true);
    } finally {
      process.chdir(originalCwd);
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
