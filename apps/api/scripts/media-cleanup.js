const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { createStrapi } = require('@strapi/strapi');

const appDir = path.join(__dirname, '..');
const distDir = path.join(appDir, 'dist');

const referenceSources = [
  {
    uid: 'api::article.article',
    label: 'article.image',
    populate: ['image'],
    fields: ['image'],
  },
  {
    uid: 'api::zodiac-sign.zodiac-sign',
    label: 'zodiac-sign.symbol',
    populate: ['symbol'],
    fields: ['symbol'],
  },
  {
    uid: 'api::zodiac-sign.zodiac-sign',
    label: 'zodiac-sign.image',
    populate: ['image'],
    fields: ['image'],
  },
  {
    uid: 'api::tarot-card.tarot-card',
    label: 'tarot-card.image',
    populate: ['image'],
    fields: ['image'],
  },
  {
    uid: 'api::product.product',
    label: 'product.image',
    populate: ['image'],
    fields: ['image'],
  },
];

const toPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const addReference = (references, value, source) => {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => addReference(references, entry, source));
    return;
  }

  if (typeof value === 'object' && Number.isInteger(value.id)) {
    const current = references.get(value.id) || [];
    current.push(source);
    references.set(value.id, current);
  }
};

const collectReferencedFileIds = async (app) => {
  const references = new Map();

  for (const source of referenceSources) {
    const entries = await app.entityService.findMany(source.uid, {
      populate: source.populate,
      fields: ['id'],
      pagination: { page: 1, pageSize: 10000 },
    });
    const collection = Array.isArray(entries) ? entries : [];

    for (const entry of collection) {
      for (const field of source.fields) {
        addReference(references, entry[field], `${source.label}#${entry.id}`);
      }
    }
  }

  return references;
};

const fetchAllUploadFiles = async (app) => {
  const uploadService = app.plugin('upload').service('upload');
  const files = [];
  let page = 1;
  let pageCount = 1;

  do {
    const result = await uploadService.findPage({
      page,
      pageSize: 100,
      sort: [{ createdAt: 'asc' }],
    });
    files.push(...result.results);
    pageCount = result.pagination.pageCount || 1;
    page += 1;
  } while (page <= pageCount);

  return files;
};

const fileTimestamp = (file) => {
  const raw = file.createdAt || file.updatedAt;
  const timestamp = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
};

const isPastGracePeriod = (file, graceDays, now) => {
  const timestamp = fileTimestamp(file);
  if (timestamp === null) {
    return false;
  }

  return now - timestamp >= graceDays * 24 * 60 * 60 * 1000;
};

const writeReport = (report) => {
  const reportDir = path.join(appDir, '..', '..', 'artifacts', 'media-cleanup');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(
    reportDir,
    `media-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });
  return reportPath;
};

async function main() {
  const app = await createStrapi({ appDir, distDir }).load();
  const graceDays = toPositiveInteger(process.env.MEDIA_CLEANUP_GRACE_DAYS, 7);
  const deleteRequested =
    process.env.MEDIA_CLEANUP_DELETE === 'true' ||
    process.argv.includes('--delete');
  const deleteConfirmed =
    process.env.MEDIA_CLEANUP_CONFIRM === 'delete-orphaned-media';
  const dryRun = !deleteRequested;
  const now = Date.now();

  if (deleteRequested && !deleteConfirmed) {
    await app.destroy();
    throw new Error(
      'Refusing delete: set MEDIA_CLEANUP_CONFIRM=delete-orphaned-media.',
    );
  }

  try {
    const references = await collectReferencedFileIds(app);
    const files = await fetchAllUploadFiles(app);
    const uploadService = app.plugin('upload').service('upload');
    const candidates = [];
    const skippedRecent = [];
    const deleted = [];

    for (const file of files) {
      if (references.has(file.id)) {
        continue;
      }

      const entry = {
        id: file.id,
        name: file.name,
        url: file.url,
        provider: file.provider,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      };

      if (!isPastGracePeriod(file, graceDays, now)) {
        skippedRecent.push(entry);
        continue;
      }

      candidates.push(entry);

      if (!dryRun) {
        await uploadService.remove(file);
        deleted.push(entry);
      }
    }

    const report = {
      checkedAt: new Date(now).toISOString(),
      dryRun,
      graceDays,
      totalFiles: files.length,
      referencedFiles: references.size,
      orphanCandidates: candidates.length,
      skippedRecent: skippedRecent.length,
      deleted: deleted.length,
      candidates,
      skippedRecentFiles: skippedRecent,
    };
    const reportPath = writeReport(report);

    console.log(`Media cleanup report: ${reportPath}`);
    console.log(
      `Checked ${files.length} files, found ${candidates.length} orphan candidates.`,
    );
    if (dryRun) {
      console.log(
        'Dry-run only. Set MEDIA_CLEANUP_DELETE=true and MEDIA_CLEANUP_CONFIRM=delete-orphaned-media to delete.',
      );
    } else {
      console.log(`Deleted ${deleted.length} orphaned files.`);
    }
  } finally {
    await app.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
