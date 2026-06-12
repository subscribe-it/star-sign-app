const aicoContract = require('../src/bootstrap/aico-content-contract.json');
const {
  resolveSqliteDatabaseFilename,
} = require('./audit-sqlite');
const { loadReleaseEnvFiles } = require('./release-env');

loadReleaseEnvFiles();

const REQUIRED_COLUMNS = [
  'name',
  'enabled',
  'workflow_type',
  'generate_cron',
  'publish_cron',
  'timezone',
  'locale',
  'prompt_template',
  'temperature',
  'max_completion_tokens',
  'retry_max',
  'retry_backoff_seconds',
  'daily_request_limit',
  'daily_token_limit',
  'topic_mode',
  'horoscope_period',
  'horoscope_type_values',
  'all_signs',
];

const canonicalWorkflowNames = new Set(
  aicoContract.workflows.map((workflow) => workflow.name),
);
const legacyWorkflowNames = aicoContract.legacyWorkflowNames.filter(
  (name) => !canonicalWorkflowNames.has(name),
);

const expectedForWorkflow = (workflow) => {
  const defaults = aicoContract.workflowDefaults;
  return {
    workflow_type: workflow.workflowType,
    generate_cron: workflow.generateCron,
    publish_cron: workflow.publishCron,
    timezone: aicoContract.timezone,
    locale: aicoContract.locale,
    prompt_template: aicoContract.prompts[workflow.promptKey],
    temperature: workflow.temperature,
    max_completion_tokens: workflow.maxCompletionTokens,
    retry_max: defaults.retryMax,
    retry_backoff_seconds: defaults.retryBackoffSeconds,
    daily_request_limit: defaults.dailyRequestLimit,
    daily_token_limit: defaults.dailyTokenLimit,
    topic_mode: workflow.topicMode,
    horoscope_period: workflow.horoscopePeriod,
    horoscope_type_values: workflow.horoscopeTypeValues,
    all_signs: workflow.allSigns,
  };
};

const normalizeJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeBoolean = (value) =>
  value === true || value === 1 || value === '1';

const compareWorkflow = (workflow, row) => {
  const failures = [];
  const expected = expectedForWorkflow(workflow);

  for (const [key, expectedValue] of Object.entries(expected)) {
    const actual = row[key];
    if (key === 'horoscope_type_values') {
      const normalizedActual = normalizeJsonArray(actual);
      if (JSON.stringify(normalizedActual) !== JSON.stringify(expectedValue)) {
        failures.push(
          `${workflow.name}: ${key} expected ${JSON.stringify(expectedValue)} got ${JSON.stringify(normalizedActual)}`,
        );
      }
      continue;
    }

    if (key === 'all_signs') {
      if (normalizeBoolean(actual) !== expectedValue) {
        failures.push(
          `${workflow.name}: ${key} expected ${expectedValue} got ${actual}`,
        );
      }
      continue;
    }

    if (typeof expectedValue === 'number') {
      if (Math.abs(Number(actual) - expectedValue) > 0.0001) {
        failures.push(
          `${workflow.name}: ${key} expected ${expectedValue} got ${actual}`,
        );
      }
      continue;
    }

    if (actual !== expectedValue) {
      failures.push(`${workflow.name}: ${key} does not match contract`);
    }
  }

  return failures;
};

const assertColumns = (columns) => {
  const missing = REQUIRED_COLUMNS.filter(
    (column) => !columns.includes(column),
  );
  if (missing.length > 0) {
    throw new Error(`aico_workflows: missing columns ${missing.join(', ')}`);
  }
};

const auditRows = (rows) => {
  const failures = [];
  const byName = new Map(rows.map((row) => [row.name, row]));

  for (const workflow of aicoContract.workflows) {
    const row = byName.get(workflow.name);
    if (!row) {
      failures.push(`${workflow.name}: missing canonical workflow`);
      continue;
    }
    failures.push(...compareWorkflow(workflow, row));
  }

  const yearly = rows.find(
    (row) =>
      row.workflow_type === 'horoscope' &&
      row.horoscope_period === 'Roczny' &&
      normalizeJsonArray(row.horoscope_type_values).includes('Ogólny'),
  );
  if (!yearly) {
    failures.push('missing canonical Roczny horoscope workflow');
  }

  for (const name of legacyWorkflowNames) {
    const row = byName.get(name);
    if (row && normalizeBoolean(row.enabled)) {
      failures.push(`${name}: legacy workflow is still enabled`);
    }
  }

  return failures;
};

const auditPostgres = async () => {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.DATABASE_HOST || 'localhost',
    port: Number(process.env.DATABASE_PORT || 5432),
    database:
      process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'star_sign',
    user:
      process.env.DATABASE_USERNAME || process.env.POSTGRES_USER || 'star_sign',
    password:
      process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || '',
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
  });

  await client.connect();
  try {
    const columnResult = await client.query(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'aico_workflows'`,
    );
    assertColumns(columnResult.rows.map((row) => row.column_name));

    const workflowResult = await client.query(
      `select ${REQUIRED_COLUMNS.join(', ')} from aico_workflows`,
    );
    return auditRows(workflowResult.rows);
  } finally {
    await client.end();
  }
};

const auditSqlite = () => {
  const Database = require('better-sqlite3');
  const filename = resolveSqliteDatabaseFilename();
  const db = new Database(filename);
  try {
    const columns = db
      .prepare('pragma table_info(aico_workflows)')
      .all()
      .map((row) => row.name);
    assertColumns(columns);

    return auditRows(
      db
        .prepare(`select ${REQUIRED_COLUMNS.join(', ')} from aico_workflows`)
        .all(),
    );
  } finally {
    db.close();
  }
};

const main = async () => {
  const client = process.env.DATABASE_CLIENT || 'sqlite';
  const failures =
    client === 'postgres' ? await auditPostgres() : auditSqlite();

  if (failures.length > 0) {
    console.error(
      JSON.stringify(
        {
          status: 'failed',
          version: aicoContract.version,
          failures,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: 'passed',
        version: aicoContract.version,
        checked: aicoContract.workflows.map((workflow) => workflow.name),
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(`[aico-contract-audit] ${error.message}`);
  process.exit(1);
});
