const fs = require('node:fs');
const path = require('node:path');
const { resolveFromApp } = require('./release-env');

const resolveSqliteDatabaseFilename = (env = process.env) => {
  const configured = env.DATABASE_FILENAME || '.tmp/data.db';
  const filename = path.isAbsolute(configured)
    ? configured
    : resolveFromApp(configured);

  if (!fs.existsSync(filename)) {
    throw new Error(
      `SQLite database file not found at ${filename}. Run the API with a seeded local database, set DATABASE_FILENAME to an existing file, or run the audit with DATABASE_CLIENT=postgres against staging/production data.`,
    );
  }

  return filename;
};

module.exports = {
  resolveSqliteDatabaseFilename,
};
