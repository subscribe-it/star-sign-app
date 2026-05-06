# QA report

## Plan walidacji

- Sprawdzić `git remote -v`.
- Sprawdzić `gh repo view`.
- Sprawdzić brak aktywnych referencji Star Sign do `ghcr.io/dawid268/...` w `.github`, `ops`, `docs`.
- Zaktualizować `STAR_SIGN_PRODUCTION_ENV` w nowym repo bez wypisywania sekretów.
- Zweryfikować YAML i Portainer compose config.

## Wynik

- `git remote -v`: `https://github.com/subscribe-it/star-sign-app.git`.
- `gh repo view subscribe-it/star-sign-app`: repo widoczne, uprawnienia `ADMIN`.
- Brak aktywnych referencji Star Sign do `ghcr.io/dawid268/...` w `.github`, `ops`, `docs` i lokalnym env.
- GitHub Secrets w `subscribe-it/star-sign-app`: `STAR_SIGN_PRODUCTION_ENV`, `PORTAINER_WEBHOOK_URL`.
- GitHub Variables w `subscribe-it/star-sign-app`: `FRONTEND_BASE_URL`, `API_BASE_URL`, `DEPLOY_WAIT_SECONDS`.
- YAML parse workflow i stacka: PASS.
- `docker compose config --quiet` dla stacka Portainera z lokalnym env: PASS.
- `git diff --check`: PASS.

## Podsumowanie po polsku

Walidacja potwierdza, że konfiguracja repo i deployu jest wyrównana do `subscribe-it`. Lokalny `package-lock.json` nadal ma niezwiązaną zmianę i nie powinien wejść do commita.
