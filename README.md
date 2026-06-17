# Star Sign ✧ Astrologia i Magia

Platforma astrologiczna nowej generacji oferująca personalizowane horoskopy, odczyty tarota i numerologię, oparta na nowoczesnym procesie redakcyjnym i designie **Lumina Silk**.

## 🚀 Technologie

- **Frontend**: Angular 19 (Standalone Components, Signals)
- **Backend**: Strapi v5 (Headless CMS)
- **Design**: Vanilla CSS z systemem tokenów (Glassmorphism, Serif Display)
- **Testy**:
  - **Unit/Integration**: Vitest
  - **E2E**: Playwright
- **Monorepo**: Nx

## 🛠️ Instalacja i Uruchomienie

### Wymagania

- Node.js >= 20
- npm / pnpm

### Klonowanie i Instalacja

```bash
git clone <repo-url>
cd star-sign
npm install
```

### Uruchamianie lokalne (Development)

```bash
# Uruchom wszystko (Frontend + API)
npm start

# Tylko Frontend
npm run client

# Tylko API (Strapi)
npm run api
```

## 🧪 Testowanie

Projekt kładzie duży nacisk na jakość i pokrycie testami (>90%).

### Testy Jednostkowe i Integracyjne (Vitest)

```bash
# Uruchom testy frontendu
npx nx test frontend

# Uruchom z raportem pokrycia (coverage)
npx nx test frontend --coverage
```

### Testy E2E (Playwright)

```bash
# Uruchom testy E2E
npx nx e2e frontend-e2e

# Uruchom w trybie UI
npx nx e2e frontend-e2e --ui
```

## 📜 Główne Funkcje

- **Profile Zodiaku**: Szczegółowe opisy wszystkich 12 znaków.
- **Horoskopy**: Dzienny, tygodniowy, miesięczny i roczny.
- **Tarot**: Karta dnia (online).
- **Numerologia**: Obliczanie liczby Drogi Życia.
- **Blog**: Artykuły o tematyce ezoterycznej.
- **Sklep (WIP)**: Produkty magiczne i akcesoria.

## 🚢 Deploy i konfiguracja (produkcja)

Deploy: push na `main` → GitHub Actions buduje obrazy → **GHCR** → webhook **Portainera** stawia stack na VPS.

- **Sekrety i zmienne (komplet + instrukcja):** [docs/ops/github-secrets-and-variables.md](docs/ops/github-secrets-and-variables.md) — wszystkie wymagane sekrety/variables aplikacji i pluginu **AICO**, podział secret/variable, jak wygenerować i ustawić (`gh` / UI), tryb indywidualny vs bundled.
- **Generowanie sekretów per provider:** [docs/ops/secrets-setup.md](docs/ops/secrets-setup.md).
- **Audyt i roadmapa:** [docs/audit-2026-06-16.md](docs/audit-2026-06-16.md). **Panel autonomii AICO:** [docs/aico-admin-panel-plan.md](docs/aico-admin-panel-plan.md).
- **Bramki przed deployem:** `npm run ops:predeploy:staging` (lint/typecheck/test/build/env/audit), po deployu `npm run ops:smoke` + `npm run ops:headers`.

> Domyślnie bezpiecznie: AICO ma reklamy i wideo `disabled`, autonomię `guarded` — świeży deploy nie wydaje pieniędzy ani nie publikuje na żywo, dopóki nie włączysz tego w panelu/zmiennych.

## ⚖️ Zgodność Prawna

Aplikacja zawiera pełną implementację:

- Regulaminu serwisu
- Polityki prywatności i Cookies
- Interaktywnego bannera zgody na cookies (zapisywanego w ciasteczkach sesyjnych)

---

_Created with ✨ by Zespół Star Sign_
