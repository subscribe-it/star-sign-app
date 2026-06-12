import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  getAppDir,
  getReleaseEnvFileCandidates,
  getWorkspaceDir,
  loadEnvFile,
  loadReleaseEnvFiles,
  resolveFromApp,
} = require('../../scripts/release-env.js');

describe('release env helpers', () => {
  it('resolves release env candidates independently from current working directory', () => {
    const originalCwd = process.cwd();
    const directory = mkdtempSync(join(tmpdir(), 'release-env-cwd-'));

    try {
      process.chdir(directory);

      const candidates = getReleaseEnvFileCandidates({
        AICO_AUDIT_ENV_FILE: 'ops/.env.production',
      });

      expect(getAppDir()).toMatch(/apps\/api$/);
      // Workspace dir is the parent of apps/api — assert that invariant
      // rather than a hardcoded directory name (CI checks out to star-sign-app).
      expect(getAppDir()).toBe(join(getWorkspaceDir(), 'apps/api'));
      expect(isAbsolute(getAppDir())).toBe(true);
      expect(isAbsolute(getWorkspaceDir())).toBe(true);
      expect(candidates[0]).toBe(join(getWorkspaceDir(), 'ops/.env.production'));
      expect(candidates).toContain(join(getWorkspaceDir(), '.env'));
      expect(candidates).toContain(join(getAppDir(), '.env'));
    } finally {
      process.chdir(originalCwd);
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('loads env files without overriding existing process values or returning secret values', () => {
    const directory = mkdtempSync(join(tmpdir(), 'release-env-file-'));
    const filename = join(directory, '.env');
    const env: NodeJS.ProcessEnv = {
      EXISTING_SECRET: 'keep-process-value',
    };

    writeFileSync(
      filename,
      [
        'EXISTING_SECRET=from-file',
        'NEW_SECRET="loaded-secret"',
        'VALUE_WITH_EQUALS=one=two',
        '# ignored',
      ].join('\n'),
    );

    try {
      const result = loadEnvFile(filename, { env });

      expect(env.EXISTING_SECRET).toBe('keep-process-value');
      expect(env.NEW_SECRET).toBe('loaded-secret');
      expect(env.VALUE_WITH_EQUALS).toBe('one=two');
      expect(result).toEqual({
        filePath: filename,
        found: true,
        loadedKeys: ['NEW_SECRET', 'VALUE_WITH_EQUALS'],
        skippedExistingKeys: ['EXISTING_SECRET'],
      });
      expect(JSON.stringify(result)).not.toContain('loaded-secret');
      expect(JSON.stringify(result)).not.toContain('from-file');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('loads explicit audit env before default candidates', () => {
    const directory = mkdtempSync(join(tmpdir(), 'release-env-explicit-'));
    const explicit = join(directory, 'explicit.env');
    const fallback = join(directory, 'fallback.env');
    const env: NodeJS.ProcessEnv = {};

    writeFileSync(explicit, 'DATABASE_CLIENT=postgres\nSHARED=explicit\n');
    writeFileSync(fallback, 'DATABASE_CLIENT=sqlite\nSHARED=fallback\n');

    try {
      const result = loadReleaseEnvFiles({
        env,
        candidates: [explicit, fallback],
      });

      expect(env.DATABASE_CLIENT).toBe('postgres');
      expect(env.SHARED).toBe('explicit');
      expect(result.map((item) => item.loadedKeys)).toEqual([
        ['DATABASE_CLIENT', 'SHARED'],
        [],
      ]);
      expect(result[1].skippedExistingKeys).toEqual(['DATABASE_CLIENT', 'SHARED']);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('resolves relative SQLite paths from the API app directory', () => {
    expect(resolveFromApp('.tmp/data.db')).toBe(join(getAppDir(), '.tmp/data.db'));
  });
});
