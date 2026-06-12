const fs = require('node:fs');
const { loadEnvFile, resolveFromWorkspace } = require('./release-env');

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4.1-mini';
const DEFAULT_TIMEOUT_MS = 30000;

const isMissingOrPlaceholder = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
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
    process.env.AICO_OPENROUTER_TOKEN,
    process.env.OPENROUTER_API_KEY,
    readEnvFileValue(envFilePath, ['AICO_OPENROUTER_TOKEN', 'OPENROUTER_API_KEY']),
  ]);

const getModel = (envFilePath) =>
  firstUsable([
    process.env.AICO_OPENROUTER_MODEL,
    readEnvFileValue(envFilePath, ['AICO_OPENROUTER_MODEL']),
    DEFAULT_MODEL,
  ]);

const getTimeoutMs = () => {
  const configured = Number(process.env.AICO_OPENROUTER_SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
};

const extractText = (payload) => {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => (typeof entry?.text === 'string' ? entry.text : ''))
      .join('')
      .trim();
  }

  return '';
};

const assertJsonOk = (text) => {
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) {
    throw new Error('OpenRouter smoke response did not contain JSON content.');
  }

  const parsed = JSON.parse(match[0]);
  if (parsed?.ok !== true) {
    throw new Error('OpenRouter smoke JSON did not contain ok=true.');
  }
};

const main = async () => {
  const loaded = loadConfiguredEnvFile();
  const token = getToken(loaded?.filePath);
  if (isMissingOrPlaceholder(token)) {
    throw new Error('Missing AICO_OPENROUTER_TOKEN/OPENROUTER_API_KEY for OpenRouter smoke.');
  }

  const model = getModel(loaded?.filePath);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.FRONTEND_URL || 'https://star-sign.pl',
        'X-Title': 'Star Sign AICO release smoke',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 32,
        messages: [
          {
            role: 'system',
            content: 'Return only compact JSON.',
          },
          {
            role: 'user',
            content: 'Return exactly {"ok":true,"check":"openrouter"}.',
          },
        ],
      }),
      signal: controller.signal,
    });

    const raw = (await response.text()).trim();
    if (!response.ok) {
      throw new Error(`OpenRouter smoke HTTP ${response.status}; response body redacted chars=${raw.length}`);
    }

    const payload = JSON.parse(raw);
    const content = extractText(payload);
    assertJsonOk(content);

    const usage = payload.usage || {};
    console.log(
      [
        'OK OpenRouter smoke',
        `model=${model}`,
        `prompt_tokens=${Number(usage.prompt_tokens || 0)}`,
        `completion_tokens=${Number(usage.completion_tokens || 0)}`,
        `total_tokens=${Number(usage.total_tokens || 0)}`,
        loaded ? `env_keys_loaded=${loaded.loadedKeys.length}` : 'env_keys_loaded=0',
      ].join(' '),
    );
  } finally {
    clearTimeout(timeout);
  }
};

main().catch((error) => {
  console.error(`FAIL OpenRouter smoke: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
