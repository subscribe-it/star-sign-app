const fs = require('node:fs');
const { loadEnvFile, resolveFromWorkspace } = require('./release-env');

// Smoke test for AICO autonomous image generation (Replicate).
// Verifies, WITHOUT spending money by default:
//   1. the image-gen token is accepted by Replicate (GET /v1/account)
//   2. the configured model actually exists (GET /v1/models/{owner}/{name})
// Set AICO_IMAGE_GEN_SMOKE_RUN=1 to ALSO run a tiny real generation (costs money).
//
// Run:  AICO_IMAGE_GEN_TOKEN=r8_... [AICO_IMAGE_GEN_MODEL=owner/name] \
//         npm --prefix apps/api run aico-image-gen-smoke
// or point at an env file: AICO_SMOKE_ENV_FILE=.env npm --prefix apps/api run aico-image-gen-smoke

const REPLICATE_API = 'https://api.replicate.com/v1';
const DEFAULT_MODEL = 'openai/gpt-image-2';
const DEFAULT_TIMEOUT_MS = 30000;

const isMissingOrPlaceholder = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return (
    !normalized ||
    normalized.includes('replace_me') ||
    normalized.includes('changeme') ||
    normalized.includes('change_me') ||
    normalized.startsWith('your_') ||
    normalized.startsWith('example')
  );
};

const parseEnvValue = (rawValue) => {
  const value = String(rawValue || '').trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
    return value.slice(1, -1);
  }

  return value;
};

const readEnvFileValue = (filePath, keys) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return '';
  }

  let found = '';
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (!match || !keys.includes(match[1])) continue;

    found = parseEnvValue(match[2]);
  }

  return found.trim();
};

const loadConfiguredEnvFile = () => {
  const filename =
    process.env.AICO_SMOKE_ENV_FILE ||
    process.env.AICO_PREFLIGHT_ENV_FILE ||
    process.env.PRODUCTION_ENV_FILE ||
    process.env.COMPOSE_ENV_FILE;

  if (!filename) {
    return null;
  }

  const filePath = resolveFromWorkspace(filename);
  const result = loadEnvFile(filePath);
  if (!result.found) {
    throw new Error(`AICO smoke env file not found: ${filename}`);
  }

  return { ...result, filePath };
};

const firstUsable = (values) =>
  values.find((value) => !isMissingOrPlaceholder(value))?.trim() || '';

const getToken = (envFilePath) =>
  firstUsable([
    process.env.AICO_IMAGE_GEN_TOKEN,
    process.env.REPLICATE_API_TOKEN,
    readEnvFileValue(envFilePath, ['AICO_IMAGE_GEN_TOKEN', 'REPLICATE_API_TOKEN']),
  ]);

const getModel = (envFilePath) =>
  firstUsable([
    process.env.AICO_IMAGE_GEN_MODEL,
    readEnvFileValue(envFilePath, ['AICO_IMAGE_GEN_MODEL']),
    DEFAULT_MODEL,
  ]);

const getTimeoutMs = () => {
  const configured = Number(process.env.AICO_IMAGE_GEN_SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
};

const splitModel = (model) => {
  const ownerName = String(model).split(':')[0]; // drop optional :version pin
  const parts = ownerName.split('/').filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`AICO_IMAGE_GEN_MODEL must be "owner/name" (got "${model}").`);
  }
  return { owner: parts[0], name: parts[1] };
};

const fetchJson = async (url, token, timeoutMs, init = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
    const text = (await response.text()).trim();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { status: response.status, ok: response.ok, body, rawLength: text.length };
  } finally {
    clearTimeout(timeout);
  }
};

const main = async () => {
  const loaded = loadConfiguredEnvFile();
  const token = getToken(loaded?.filePath);
  if (isMissingOrPlaceholder(token)) {
    throw new Error(
      'Missing AICO_IMAGE_GEN_TOKEN/REPLICATE_API_TOKEN for image-gen smoke (set it in env or the smoke env file).'
    );
  }

  const model = getModel(loaded?.filePath);
  const { owner, name } = splitModel(model);
  const timeoutMs = getTimeoutMs();

  // 1. Token check.
  const account = await fetchJson(`${REPLICATE_API}/account`, token, timeoutMs);
  if (account.status === 401 || account.status === 403) {
    throw new Error(`Replicate token rejected (HTTP ${account.status}). Check AICO_IMAGE_GEN_TOKEN.`);
  }
  if (!account.ok) {
    throw new Error(`Replicate account check failed (HTTP ${account.status}).`);
  }

  // 2. Model existence check (answers "does openai/gpt-image-2 exist?").
  const modelRes = await fetchJson(`${REPLICATE_API}/models/${owner}/${name}`, token, timeoutMs);
  if (modelRes.status === 404) {
    throw new Error(
      `Replicate model NOT FOUND: "${owner}/${name}". Set AICO_IMAGE_GEN_MODEL to a valid Replicate model.`
    );
  }
  if (!modelRes.ok) {
    throw new Error(`Replicate model check failed (HTTP ${modelRes.status}) for "${owner}/${name}".`);
  }

  const accountName = account.body?.username || account.body?.type || 'ok';
  console.log(
    [
      'OK AICO image-gen smoke',
      `token=valid(account=${accountName})`,
      `model=${owner}/${name}(exists)`,
      loaded ? `env_keys_loaded=${loaded.loadedKeys.length}` : 'env_keys_loaded=0',
      process.env.AICO_IMAGE_GEN_SMOKE_RUN === '1' ? 'generation=pending' : 'generation=skipped(set AICO_IMAGE_GEN_SMOKE_RUN=1 to test, costs money)',
    ].join(' ')
  );

  if (process.env.AICO_IMAGE_GEN_SMOKE_RUN !== '1') {
    return;
  }

  // 3. Optional: run a tiny real generation (COSTS MONEY) via the official client.
  const Replicate = require('replicate');
  const replicate = new Replicate({ auth: token });
  const output = await replicate.run(model, {
    input: {
      prompt: 'A simple gold star on a deep black background, minimalist test image.',
      aspect_ratio: '2:3',
      output_format: 'webp',
      output_quality: 80,
    },
  });
  const url = String(Array.isArray(output) ? output[0] : output);
  if (!/^https?:\/\//.test(url)) {
    throw new Error('Generation returned no usable image URL.');
  }
  console.log(`OK AICO image-gen generation produced an image (url_len=${url.length}).`);
};

main().catch((error) => {
  console.error(
    `FAIL AICO image-gen smoke: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
