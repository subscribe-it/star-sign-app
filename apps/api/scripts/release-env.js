const fs = require('node:fs');
const path = require('node:path');

const APP_DIR = path.resolve(__dirname, '..');
const WORKSPACE_DIR = path.resolve(APP_DIR, '../..');

const firstNonEmpty = (values) =>
  values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() || '';

const getAppDir = () => APP_DIR;

const getWorkspaceDir = () => WORKSPACE_DIR;

const resolveFromWorkspace = (filename) =>
  path.isAbsolute(filename) ? filename : path.resolve(WORKSPACE_DIR, filename);

const resolveFromApp = (filename) =>
  path.isAbsolute(filename) ? filename : path.resolve(APP_DIR, filename);

const getReleaseEnvFileCandidates = (env = process.env) => {
  const explicit = firstNonEmpty([
    env.AICO_AUDIT_ENV_FILE,
    env.COMPOSE_ENV_FILE,
  ]);
  const candidates = [
    ...(explicit ? [resolveFromWorkspace(explicit)] : []),
    path.join(WORKSPACE_DIR, '.env'),
    path.join(APP_DIR, '.env'),
  ];

  return Array.from(new Set(candidates));
};

const parseEnvLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
    return null;
  }

  const [key, ...rest] = trimmed.split('=');
  const normalizedKey = key.trim();
  if (!normalizedKey) {
    return null;
  }

  return {
    key: normalizedKey,
    value: rest.join('=').trim().replace(/^['"]|['"]$/g, ''),
  };
};

const loadEnvFile = (filePath, options = {}) => {
  const env = options.env ?? process.env;
  const override = options.override === true;
  const result = {
    filePath,
    found: fs.existsSync(filePath),
    loadedKeys: [],
    skippedExistingKeys: [],
  };

  if (!result.found) {
    return result;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    if (!override && Object.prototype.hasOwnProperty.call(env, parsed.key)) {
      result.skippedExistingKeys.push(parsed.key);
      continue;
    }

    env[parsed.key] = parsed.value;
    result.loadedKeys.push(parsed.key);
  }

  return result;
};

const loadReleaseEnvFiles = (options = {}) => {
  const env = options.env ?? process.env;
  const candidates = options.candidates ?? getReleaseEnvFileCandidates(env);

  return candidates.map((candidate) =>
    loadEnvFile(candidate, {
      env,
      override: options.override === true,
    }),
  );
};

module.exports = {
  getAppDir,
  getReleaseEnvFileCandidates,
  getWorkspaceDir,
  loadEnvFile,
  loadReleaseEnvFiles,
  resolveFromApp,
  resolveFromWorkspace,
};
