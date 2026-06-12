const aicoContract = require('../src/bootstrap/aico-content-contract.json');
const {
  resolveSqliteDatabaseFilename,
} = require('./audit-sqlite');
const { loadReleaseEnvFiles } = require('./release-env');

const REQUIRED_SECTIONS = aicoContract.premium.sections;

const MINIMUMS = {
  daily: 180,
  periodic: 300,
  article: 350,
};

loadReleaseEnvFiles();

const stripMarkup = (value) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[`*_>#\-[\](){}|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const countWords = (value) => {
  const text = stripMarkup(value);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
};

const normalize = (value) =>
  stripMarkup(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ąćęłńóśźż]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const evaluate = ({ content, premiumContent, minimum }) => {
  const contentWords = countWords(content);
  const premiumWords = countWords(premiumContent);
  const minimumWords = Math.max(contentWords, minimum);
  const normalizedPremium = normalize(premiumContent);
  const normalizedContent = normalize(content);
  const issues = [];

  if (!String(premiumContent || '').trim()) issues.push('missing');
  if (premiumWords < minimumWords)
    issues.push(`short:${premiumWords}/${minimumWords}`);
  if (
    !REQUIRED_SECTIONS.every((section) =>
      normalizedPremium.includes(normalize(section)),
    )
  ) {
    issues.push('missing_sections');
  }
  if (
    normalizedContent &&
    (normalizedContent === normalizedPremium ||
      (normalizedContent.length > 80 &&
        normalizedPremium.includes(normalizedContent)))
  ) {
    issues.push('copy');
  }

  return {
    valid: issues.length === 0,
    issues,
    contentWords,
    premiumWords,
    minimumWords,
  };
};

const assertColumns = (columns, required, tableName) => {
  const missing = required.filter((column) => !columns.includes(column));
  if (missing.length > 0) {
    throw new Error(`${tableName}: missing columns ${missing.join(', ')}`);
  }
};

const auditRows = (rows, kind) => {
  const failures = [];

  for (const row of rows) {
    const minimum =
      kind === 'article'
        ? MINIMUMS.article
        : row.period === 'Dzienny'
          ? MINIMUMS.daily
          : MINIMUMS.periodic;
    const result = evaluate({
      content: row.content,
      premiumContent: row.premium_content,
      minimum,
    });

    const articlePremiumEnabled =
      row.is_premium === true || row.is_premium === 1;

    if (!result.valid || (kind === 'article' && !articlePremiumEnabled)) {
      failures.push({
        id: row.id,
        label: row.title || `${row.period}/${row.type}`,
        issues: result.issues,
      });
    }
  }

  return failures;
};

const auditWorkflows = (rows) => {
  const failures = [];
  const dailyTypes = new Set();

  for (const row of rows) {
    const prompt = row.prompt_template || '';
    if (
      !prompt.includes('premiumContent') ||
      !REQUIRED_SECTIONS.every((section) => prompt.includes(section))
    ) {
      failures.push(`${row.name}: prompt missing premium contract`);
    }

    if (
      row.workflow_type === 'horoscope' &&
      row.horoscope_period === 'Dzienny'
    ) {
      const values = Array.isArray(row.horoscope_type_values)
        ? row.horoscope_type_values
        : JSON.parse(row.horoscope_type_values || '[]');
      for (const value of values) dailyTypes.add(value);
    }
  }

  const requiredDailyTypes = aicoContract.workflows
    .filter(
      (workflow) =>
        workflow.workflowType === 'horoscope' &&
        workflow.horoscopePeriod === 'Dzienny',
    )
    .flatMap((workflow) => workflow.horoscopeTypeValues);

  for (const type of requiredDailyTypes) {
    if (!dailyTypes.has(type))
      failures.push(`missing daily workflow for ${type}`);
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
    const columns = async (tableName) => {
      const result = await client.query(
        `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
        [tableName],
      );
      return result.rows.map((row) => row.column_name);
    };

    assertColumns(
      await columns('horoscopes'),
      ['content', 'premium_content'],
      'horoscopes',
    );
    assertColumns(
      await columns('articles'),
      ['content', 'premium_content', 'is_premium'],
      'articles',
    );

    const horoscopes = await client.query(
      'select id, period, type, content, premium_content from horoscopes',
    );
    const articles = await client.query(
      'select id, title, content, premium_content, is_premium from articles',
    );
    const workflows = await client.query(
      'select name, workflow_type, horoscope_period, horoscope_type_values, prompt_template from aico_workflows',
    );

    return {
      horoscopeFailures: auditRows(horoscopes.rows, 'horoscope'),
      articleFailures: auditRows(articles.rows, 'article'),
      workflowFailures: auditWorkflows(workflows.rows),
    };
  } finally {
    await client.end();
  }
};

const auditSqlite = () => {
  const Database = require('better-sqlite3');
  const filename = resolveSqliteDatabaseFilename();
  const db = new Database(filename);
  try {
    const columns = (tableName) =>
      db
        .prepare(`pragma table_info(${tableName})`)
        .all()
        .map((row) => row.name);

    assertColumns(
      columns('horoscopes'),
      ['content', 'premium_content'],
      'horoscopes',
    );
    assertColumns(
      columns('articles'),
      ['content', 'premium_content', 'is_premium'],
      'articles',
    );

    return {
      horoscopeFailures: auditRows(
        db
          .prepare(
            'select id, period, type, content, premium_content from horoscopes',
          )
          .all(),
        'horoscope',
      ),
      articleFailures: auditRows(
        db
          .prepare(
            'select id, title, content, premium_content, is_premium from articles',
          )
          .all(),
        'article',
      ),
      workflowFailures: auditWorkflows(
        db
          .prepare(
            'select name, workflow_type, horoscope_period, horoscope_type_values, prompt_template from aico_workflows',
          )
          .all(),
      ),
    };
  } finally {
    db.close();
  }
};

const main = async () => {
  const client = process.env.DATABASE_CLIENT || 'sqlite';
  const result = client === 'postgres' ? await auditPostgres() : auditSqlite();
  const totalFailures =
    result.horoscopeFailures.length +
    result.articleFailures.length +
    result.workflowFailures.length;

  if (totalFailures > 0) {
    console.error(
      JSON.stringify(
        {
          status: 'failed',
          ...result,
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
        checked: ['horoscopes', 'articles', 'aico_workflows'],
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(`[premium-content-audit] ${error.message}`);
  process.exit(1);
});
