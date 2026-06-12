const aicoContract = require('../src/bootstrap/aico-content-contract.json');
const {
  resolveSqliteDatabaseFilename,
} = require('./audit-sqlite');
const { loadReleaseEnvFiles } = require('./release-env');

const REQUIRED_SECTIONS = aicoContract.premium.sections;

loadReleaseEnvFiles();

const premiumContent = (label) => `${label}: Pełna interpretacja Premium.

Relacje: wybierz jedną relację, w której chcesz działać spokojniej, uczciwiej i bardziej świadomie. Nazwij fakt, potrzebę oraz granicę, zanim dopiszesz w myślach intencje drugiej osoby. Premium prowadzi do kontaktu bez presji: krótkiej rozmowy, jednego jasnego zdania i gotowości, aby słuchać odpowiedzi bez natychmiastowego bronienia swojej racji. Dodaj test rzeczywistości: sprawdź, czy reagujesz na aktualną sytuację, czy na wcześniejszy lęk przed odrzuceniem. Jeśli czujesz napięcie, zapisz, co naprawdę chcesz ochronić: bliskość, spokój, dumę czy poczucie wpływu.

Praca: przesuń energię z planowania na domykanie. Wybierz zadanie, które ma widoczny koniec i realnie zmniejszy napięcie. Ustal minimalny dobry rezultat, zamknij rozpraszacze i wykonaj pierwszy krok przed sprawami pobocznymi. Jeżeli pojawi się chaos, wróć do pytania, co dziś buduje stabilność, a co jest tylko reakcją na cudze tempo. Zapisz także koszt decyzji: czas, uwagę albo rozmowę, której nie warto dłużej odkładać. Ambicja ma dziś wspierać rytm, nie zmuszać Cię do udowadniania wartości.

Energia dnia: ciało potrzebuje prostego rytmu: wody, oddechu, krótkiej pauzy i jednej decyzji mniej. Zwróć uwagę na barki, szczękę oraz dłonie, bo tam najszybciej zapisuje się pośpiech. Nie musisz rozwiązać wszystkiego naraz. Wystarczy, że wybierzesz najspokojniejszy następny krok i wykonasz go bez przeciążania siebie. Po południu oceń pobudzenie w skali od jednego do dziesięciu i najpierw obniż napięcie, zanim odpowiesz na wymagającą wiadomość. Ten fragment Premium ma pomóc Ci zauważyć różnicę między intuicją a reakcją obronną.

Rytuał: usiądź przy naturalnym świetle albo zapal małą świecę. Zapisz zdanie zaczynające się od słów "Dziś wybieram". Dopisz trzy gesty, które potwierdzą tę intencję w relacjach, pracy i odpoczynku. Przez dziewięć oddechów trzymaj uwagę na sercu, a potem wykonaj pierwszy najmniejszy gest od razu. Wieczorem wróć do notatki i dopisz, co naprawdę zadziałało. Dzięki temu Premium staje się osobistym archiwum wzorców, nie jednorazową inspiracją. Jeżeli dzień był trudny, zapisz również jeden moment, w którym zatrzymałaś lub zatrzymałeś automatyczną reakcję.

Pytanie refleksyjne: który wybór wzmacnia mój spokój i sprawczość, nawet jeśli wymaga ode mnie większej szczerości niż zwykle? Co zrobię inaczej, jeśli potraktuję siebie jak osobę wartą cierpliwego prowadzenia, a nie projekt do ciągłej poprawy? Jaką jedną decyzję mogę odłożyć, dopóki nie wrócę do spokojniejszego oddechu i pełniejszego obrazu sytuacji?`;

const canonicalWorkflowNames = new Set(
  aicoContract.workflows.map((workflow) => workflow.name),
);
const canonicalWorkflowByName = new Map(
  aicoContract.workflows.map((workflow) => [workflow.name, workflow]),
);
const legacyWorkflowNames = new Set(
  aicoContract.legacyWorkflowNames.filter(
    (name) => !canonicalWorkflowNames.has(name),
  ),
);

const canonicalWorkflowRecord = (workflow) => {
  const defaults = aicoContract.workflowDefaults;
  return {
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
    allow_manual_edit: defaults.allowManualEdit,
    auto_publish: defaults.autoPublish,
    force_regenerate: defaults.forceRegenerate,
    topic_mode: workflow.topicMode,
    horoscope_period: workflow.horoscopePeriod,
    horoscope_type_values: workflow.horoscopeTypeValues,
    all_signs: workflow.allSigns,
  };
};

const serializeJsonColumn = (value, isPostgres) =>
  isPostgres ? JSON.stringify(value) : JSON.stringify(value);

const updateAssignments = (columns, record, placeholder, isPostgres) => {
  const assignments = [];
  const values = [];

  for (const [column, value] of Object.entries(record)) {
    if (!columns.includes(column)) continue;
    assignments.push(`${column} = ${placeholder(values.length + 1)}`);
    values.push(
      column === 'horoscope_type_values'
        ? serializeJsonColumn(value, isPostgres)
        : value,
    );
  }

  return { assignments, values };
};

const auditColumns = (columns, required, tableName) => {
  const missing = required.filter((column) => !columns.includes(column));
  if (missing.length > 0) {
    throw new Error(`${tableName}: missing columns ${missing.join(', ')}`);
  }
};

const backfillPostgres = async () => {
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

    auditColumns(
      await columns('horoscopes'),
      ['premium_content'],
      'horoscopes',
    );
    auditColumns(
      await columns('articles'),
      ['premium_content', 'is_premium'],
      'articles',
    );
    const workflowColumns = await columns('aico_workflows');

    const horoscopes = await client.query(
      'select id, period, type from horoscopes',
    );
    for (const row of horoscopes.rows) {
      await client.query(
        'update horoscopes set premium_content = $1 where id = $2',
        [
          premiumContent(
            `Horoskop ${row.period || 'Dzienny'} ${row.type || 'Ogólny'}`,
          ),
          row.id,
        ],
      );
    }

    const articles = await client.query('select id, title from articles');
    for (const row of articles.rows) {
      await client.query(
        'update articles set premium_content = $1, is_premium = true where id = $2',
        [premiumContent(row.title || 'Artykuł Star Sign'), row.id],
      );
    }

    const workflows = await client.query(
      'select id, name, workflow_type, horoscope_period from aico_workflows',
    );
    for (const row of workflows.rows) {
      if (legacyWorkflowNames.has(row.name)) {
        await client.query(
          'update aico_workflows set enabled = false, status = $1 where id = $2',
          ['idle', row.id],
        );
        continue;
      }

      const workflow = canonicalWorkflowByName.get(row.name);
      if (!workflow) continue;

      const { assignments, values } = updateAssignments(
        workflowColumns,
        canonicalWorkflowRecord(workflow),
        (index) => `$${index}`,
        true,
      );
      if (assignments.length === 0) continue;

      values.push(row.id);

      await client.query(
        `update aico_workflows set ${assignments.join(', ')} where id = $${values.length}`,
        values,
      );
    }

    return {
      horoscopes: horoscopes.rowCount,
      articles: articles.rowCount,
      workflows: workflows.rowCount,
    };
  } finally {
    await client.end();
  }
};

const backfillSqlite = () => {
  const Database = require('better-sqlite3');
  const filename = resolveSqliteDatabaseFilename();
  const db = new Database(filename);
  try {
    const columns = (tableName) =>
      db
        .prepare(`pragma table_info(${tableName})`)
        .all()
        .map((row) => row.name);

    auditColumns(columns('horoscopes'), ['premium_content'], 'horoscopes');
    auditColumns(
      columns('articles'),
      ['premium_content', 'is_premium'],
      'articles',
    );
    const workflowColumns = columns('aico_workflows');

    const horoscopeRows = db
      .prepare('select id, period, type from horoscopes')
      .all();
    const updateHoroscope = db.prepare(
      'update horoscopes set premium_content = ? where id = ?',
    );
    for (const row of horoscopeRows) {
      updateHoroscope.run(
        premiumContent(
          `Horoskop ${row.period || 'Dzienny'} ${row.type || 'Ogólny'}`,
        ),
        row.id,
      );
    }

    const articleRows = db.prepare('select id, title from articles').all();
    const updateArticle = db.prepare(
      'update articles set premium_content = ?, is_premium = 1 where id = ?',
    );
    for (const row of articleRows) {
      updateArticle.run(
        premiumContent(row.title || 'Artykuł Star Sign'),
        row.id,
      );
    }

    const workflowRows = db
      .prepare(
        'select id, name, workflow_type, horoscope_period from aico_workflows',
      )
      .all();
    for (const row of workflowRows) {
      if (legacyWorkflowNames.has(row.name)) {
        db.prepare(
          'update aico_workflows set enabled = 0, status = ? where id = ?',
        ).run('idle', row.id);
        continue;
      }

      const workflow = canonicalWorkflowByName.get(row.name);
      if (!workflow) continue;

      const { assignments, values } = updateAssignments(
        workflowColumns,
        canonicalWorkflowRecord(workflow),
        () => '?',
        false,
      );
      if (assignments.length === 0) continue;

      values.push(row.id);

      db.prepare(
        `update aico_workflows set ${assignments.join(', ')} where id = ?`,
      ).run(...values);
    }

    return {
      horoscopes: horoscopeRows.length,
      articles: articleRows.length,
      workflows: workflowRows.length,
    };
  } finally {
    db.close();
  }
};

const main = async () => {
  const client = process.env.DATABASE_CLIENT || 'sqlite';
  const result =
    client === 'postgres' ? await backfillPostgres() : backfillSqlite();

  console.log(
    JSON.stringify(
      {
        status: 'backfilled',
        requiredSections: REQUIRED_SECTIONS,
        ...result,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(`[premium-content-backfill] ${error.message}`);
  process.exit(1);
});
