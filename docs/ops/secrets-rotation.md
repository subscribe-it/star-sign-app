# Star Sign Secrets Rotation

## Rotation Order

1. Strapi core secrets: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`.
2. PostgreSQL: `POSTGRES_PASSWORD`, `DATABASE_PASSWORD`.
3. Redis URLs/passwords if Redis auth is enabled.
4. R2/S3: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
5. Brevo: `BREVO_API_KEY`, SMTP user/password, `BREVO_WEBHOOK_SECRET`.
6. Token API Strapi używany przez marketing-os (utwórz nowy, unieważnij stary).
7. Turnstile: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.
8. Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
9. Bugsink: `BUGSINK_SECRET_KEY`, admin password, project DSNs if compromised.

## Pre-Launch Checklist

- [ ] Production `.env` contains no `replace_me`, `local_*`, test Stripe keys, localhost URLs, or empty required production values.
- [ ] Local `.env` files are not committed.
- [ ] GitHub Actions secrets are set from freshly rotated values.
- [ ] Application logs do not contain real tokens, DSNs, passwords, webhook secrets, or API keys.
- [ ] `git log -p` was scanned for leaked secrets before launch.
- [ ] `gitleaks` or `trufflehog` found no high/critical findings.
- [ ] Any token that appeared in local logs or screenshots was rotated.

## Local Scan Commands

Use at least one scanner before production:

```bash
gitleaks detect --source=. --redact --no-banner
```

or:

```bash
trufflehog git file://. --only-verified --fail
```

Any verified high/critical secret finding blocks production until the secret is rotated and the exposure is documented.
