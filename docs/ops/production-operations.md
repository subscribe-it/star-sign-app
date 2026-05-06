# Star Sign Production Operations

## Backup and Restore

- RPO: 24 hours. Run PostgreSQL backup daily.
- RTO: 60 minutes for a database restore on the same VPS.
- Current accepted risk: backups are local to the VPS only. Loss of the VPS disk can still mean loss of backup and database.

Recommended daily schedule: 02:30 UTC.

```bash
POSTGRES_DB=star_sign POSTGRES_USER=star_sign ./ops/backup-postgres.sh
```

Systemd timer or cron should set:

```bash
BACKUP_DIR=/var/backups/star-sign/postgres
BACKUP_RETENTION_DAYS=14
POSTGRES_SERVICE=postgres
```

Every backup writes:

- `star-sign-YYYYMMDDTHHMMSSZ.dump`
- `star-sign-YYYYMMDDTHHMMSSZ.dump.sha256`

Verify the latest backup:

```bash
POSTGRES_DB=star_sign POSTGRES_USER=star_sign ./ops/verify-backup.sh /var/backups/star-sign/postgres/star-sign-YYYYMMDDTHHMMSSZ.dump
```

Restore test mode is the default and writes to `star_sign_restore_test`:

```bash
RESTORE_CONFIRM=restore-star-sign \
POSTGRES_DB=star_sign \
POSTGRES_USER=star_sign \
./ops/restore-postgres.sh /var/backups/star-sign/postgres/star-sign-YYYYMMDDTHHMMSSZ.dump
```

Production restore requires an explicit second guard:

```bash
RESTORE_CONFIRM=restore-star-sign \
RESTORE_MODE=production \
RESTORE_PRODUCTION=true \
RESTORE_TARGET_DB=star_sign \
POSTGRES_DB=star_sign \
POSTGRES_USER=star_sign \
./ops/restore-postgres.sh /var/backups/star-sign/postgres/star-sign-YYYYMMDDTHHMMSSZ.dump
```

## Observability

- Bugsink is the local Sentry-compatible error tracker.
- Backend and frontend must use Bugsink DSNs through runtime env.
- Frontend sourcemaps are generated as hidden maps and uploaded to Bugsink; do not serve source maps publicly.
- `ops/uptime-watch.sh` checks API and frontend paths and posts to `OPS_ALERT_WEBHOOK_URL` after two consecutive failures.

Important limitation: the local watcher cannot alert if the whole VPS or network path to the VPS is down.

## Release Gate

Before marking production `GO`:

```bash
COMPOSE_ENV_FILE=.env \
COMPOSE_FILE=ops/portainer/star-sign-production-stack.yml \
PREDEPLOY_SCOPE=staging \
RUN_ENV_GUARD=true \
RUN_FRONTEND_FULL=true \
RUN_E2E=true \
RUN_DOMAIN_AUDITS=true \
RUN_SECURITY_HEADERS=true \
FRONTEND_BASE_URL=https://star-sign.pl \
API_BASE_URL=https://api.star-sign.pl/api \
npm run ops:predeploy:local
```

## Portainer Swarm

Produkcyjny stack dla VPS 2 vCPU / 4 GB jest w `ops/portainer/star-sign-production-stack.yml`.

- Traefik obsługuje HTTPS i routing, więc stack produkcyjny nie używa Caddy.
- Bugsink nie jest częścią tego stacka; zostanie wdrożony osobno.
- API i frontend są osobnymi obrazami GHCR budowanymi z targetów `api-runtime` i `frontend-runtime`.
- Uploady produkcyjne używają Cloudflare R2; nie montować trwałego wolumenu `public/uploads`.
- Resource cap stacka Star Sign: 1.8 vCPU i 2752M RAM.

Wymagane obrazy:

```text
ghcr.io/subscribe-it/star-sign-api:main
ghcr.io/subscribe-it/star-sign-frontend:main
```

Rollback: ustaw w Portainerze `STAR_SIGN_IMAGE_TAG` na konkretny `git sha`, zaktualizuj stack i uruchom smoke/e2e.

Then run:

- backup verification restore,
- Bugsink test event for frontend and backend,
- `ops/load/soft-launch.yml` against staging or the production VPS maintenance window,
- media cleanup dry-run.

## Load Test

Run the soft-launch profile manually:

```bash
TARGET_FRONTEND=https://star-sign.pl \
TARGET_API=https://api.star-sign.pl/api \
TARGET_CHECKOUT_STATUS=404 \
npm run ops:load:soft
```

Use `TARGET_CHECKOUT_STATUS=400` only when the shop is enabled and the checkout validation path should be reachable. The scenario sends an empty cart and does not create a real Stripe session.

## Media Cleanup

Dry-run is the default:

```bash
cd apps/api
npm run media:cleanup
```

Delete requires both guards:

```bash
cd apps/api
MEDIA_CLEANUP_DELETE=true \
MEDIA_CLEANUP_CONFIRM=delete-orphaned-media \
npm run media:cleanup
```

Reports are written to `artifacts/media-cleanup/` and are intentionally ignored by git.
