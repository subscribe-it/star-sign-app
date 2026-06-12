# Raport audytu: Star Sign — production-ready + pełna automatyzacja
Data: 2026-06-12 · Werdykt: **NO-GO LIVE** (do czasu usunięcia blokerów P0)

## AKTUALIZACJA 2026-06-12 (po remediacji)

Wykonane tego samego dnia (commity `4a6648f`, `a7cc052`, `7d179d9`):

- ✅ **P0-1 zamknięty**: wszystkie ~8,5k linii zmian RC zacommitowane na main (predeploy local PASS przed commitem).
- ✅ **CSP**: pełne dyrektywy script/style/img/connect/frame z allowlistami GA4/Stripe/Turnstile/Sentry/CDN (frontend, Traefik).
- ✅ **Redis dev**: maxmemory 128mb + allkeys-lru (prod stack już miał).
- ✅ **Backupy + uptime**: jednostki systemd (`ops/systemd/`) — backup 02:30 UTC + verify, uptime-watch co 5 min; README z instalacją. Wymaga włączenia na hoście.
- ✅ **Gitleaks**: krytyczna poprawka — config nie miał `[extend] useDefault`, więc skan nie miał ŻADNYCH reguł; dodane reguły default + OpenRouter/Brevo/Replicate; pełny skan repo czysty.
- ✅ **.nvmrc**: Node 20 (zgodnie z CI/Dockerfile).
- ✅ **RODO — usunięcie konta**: `DELETE /account` (profil, odczyty, newsletter, anonimizacja analytics, user; potwierdzenie "USUWAM KONTO"); 3 testy.
- ✅ **RODO — baner cookies**: CookieConsentService + odświeżony CookieBanner; GA4 ładuje się wyłącznie po zgodzie, cofnięcie ustawia `ga-disable-*`; „Zarządzaj zgodami" w stopce; migracja starej decyzji.
- ✅ **JSON-LD**: Organization+WebSite na home (artykuły/horoskopy/znaki/produkty już miały — wniosek audytu skorygowany).
- ✅ **E2E w CI**: nowy job `e2e` (mock API, chromium, artefakt raportu przy porażce).

### Pozostałe blokery (wymagają działań właściciela/operatora — poza repo):
1. Sekrety produkcyjne: 20 braków w `.env.production` (AICO/GA4/social/Stripe) + rotacja klucza OpenRouter.
2. Decyzja JWT (localStorage vs cookies) i wybór error-trackingu (Sentry/Bugsink).
3. Instalacja timerów systemd na hoście + webhook alertów.
4. Live adaptery Meta/Google Ads (kod) — wymagane tylko do realnych wydatków reklamowych.
5. Deploy → post-seed preflight na targecie → production-readiness GO → włączenie autonomii.

## 1. Werdykt ogólny

Architektura jest solidna i w dużej mierze gotowa: AICO jest **production-ready w trybie controlled** (fail-closed, kill switch, audit trail, bramka GO/NO_GO), CI/CD i skrypty ops są kompletne, testy zielone lokalnie (RC 2026-06-11). Blokują: brudne repo, brak sekretów produkcyjnych, brak live-adapterów reklam oraz luki RODO (brak banera cookies).

## 2. Blokery P0 (przed merge/deploy)

| # | Bloker | Dowód |
|---|---|---|
| 1 | **~8,5 tys. linii niezacommitowanych zmian** (44 pliki zmodyfikowane + nowe serwisy/CT pluginu AICO) — repo nie jest releasable | `git status` |
| 2 | **20 braków w env produkcyjnym**: sekrety AICO (audit salt, OpenRouter), GA4 (property + credentials), social (FB/IG/X), flagi autonomii, tryby ads/video | `ops/production-env-check.sh` |
| 3 | **JWT w localStorage** — podatne na XSS; decyzja właściciela: akceptacja na soft launch + CSP, albo migracja na HttpOnly cookies przed live Stripe | `frontend/src/app/core/services/auth.service.ts:126,148` |
| 4 | **Rotacja klucza OpenRouter** ujawnionego w czacie (2026-06-11) | pamięć Serena |

## 3. Stan automatyzacji (AICO) — co działa / co brakuje

### Działa w pełni (kod gotowy, czeka na konfigurację):
- **Pipeline treści end-to-end**: generacja (horoskopy ×12, tarot dnia, artykuły) → naprawa jakości polszczyzny (pętla 1–5 prób LLM) → walidacja premium → SEO guardrails → ticket publikacji → auto-publish (`orchestrator.ts:350-2692`).
- **Social FB/IG/X**: teaser z LLM, limity dzienne (FB 8, IG 4, X 24), blocklista bezpieczeństwa, polityka autonomii przed każdym postem (`social-publisher.ts`). TikTok/YT wyłączone domyślnie.
- **Analityka**: ingest GA4 (service account JWT), snapshoty wydajności treści ze scoringiem (views + premium×2 + CTA×5 + checkout×8 + social×6 − fails), hints do strategii (`traffic-ingestor.ts`, `performance-feedback.ts`).
- **Płaszczyzna kontroli**: autonomy-policy (tryby off/draft_only/guarded/full, budżety: ads 25 PLN/d, Meta 15, Google 10, LLM 120 req, media 20, video 3), kill switch, runtime locks, audit trail, production-readiness GO/NO_GO, runNow z potwierdzeniem `RUN_AICO_CONTROLLED_TICK`.
- **Media**: selekcja semantyczna → generacja obrazów (image-designer + media-generator) → fallback stock → tracking użycia.

### Luki w kodzie (do zaimplementowania):
| Luka | Priorytet | Plik |
|---|---|---|
| **Live adapter Meta Ads + Google Ads** — celowo zwraca `provider_adapter_live_not_implemented`; controlled = sandbox bez wydatków | P1 (wymagane do realnych reklam) | `ads-provider-adapter.ts:44-54` |
| **Wideo → social** (publikacja wyrenderowanych wideo) | P2 | brak |
| **Auto-ewaluacja eksperymentów A/B** (istotność statystyczna, auto-skalowanie zwycięzcy) | P2 | `experiment-agent.ts` (szkielet) |
| **Pamięć redakcyjna / pętla uczenia** (analiza trendów → auto-korekta polityki/promptów) | P2, faza 2 | CT istnieje, brak konsumenta |
| Polling renderu Replicate (weryfikacja kompletności) | P1 | `video-provider-adapter.ts:148-250` |

### Wymagane do pełnej autonomii (konfiguracja, nie kod):
11 flag env = true (`AICO_ENABLE_WORKFLOWS`, `AICO_AUDIT_TRAIL_STRICT`, `AICO_STRICT_AUDIT_REQUIRED`, `AICO_AUTO_PUBLISH_ENABLED`, `AICO_STRATEGY_AUTOPILOT_ENABLED`, `AICO_STRATEGY_AUTO_APPROVE_PLAN`, `AICO_MEDIA_GEN_REQUIRED`, `AICO_SOCIAL_PUBLISH_REQUIRED`, `AICO_ADS_TARGET_URL_PREFLIGHT_REQUIRED`, `AICO_CONTROLLED_LIVE_ENABLED`, `AICO_ADMIN_RUN_NOW_ENABLED`) + `AICO_ADS_PROVIDER_MODE=controlled`, `AICO_VIDEO_PROVIDER_MODE=replicate` + komplet sekretów providerów (Meta, Google Ads, GA4, FB/IG/X, image/video gen) + production-readiness = **GO** (nie GO_WITH_WARNINGS).

## 4. Production-readiness (poza AICO) — wnioski P1

**Bezpieczeństwo:**
- CSP zbyt permisywne — brak `script-src/style-src/img-src/connect-src`; przed startem dodać allowlisty dla GA4/Stripe/Turnstile/Sentry (`ops/portainer/star-sign-production-stack.yml:93`).
- Rate-limit: przy `RATE_LIMIT_TRUST_PROXY=true` bierze pierwszy `x-forwarded-for` — zweryfikować, że Traefik nadpisuje nagłówek (`apps/api/src/middlewares/rate-limit.ts:49-60`).
- Zweryfikować obecność `.gitleaks.toml` (workflow secrets-scan się do niego odwołuje).
- Sentry/Bugsink: decyzja + DSN przed live Stripe.
- 16 moderate vulns w zależnościach API (Strapi ecosystem) — baseline do zaakceptowania/monitorowania.

**Ops:**
- Backupy Postgres: skrypty gotowe i przetestowane, ale **brak harmonogramu** (cron/systemd timer 02:30 UTC).
- `uptime-watch.sh` nie wdrożony; brak `OPS_ALERT_WEBHOOK_URL`.
- Redis bez `maxmemory-policy` — dodać `allkeys-lru`.
- Rollback opisany ogólnie — doprecyzować runbook (kroki w Portainer, kiedy restore DB).
- E2E nie ma w głównym CI (tylko post-deploy) — dodać job.

**Frontend / RODO:**
- **Brak banera zgody na cookies** — GA4 odpala się bez zgody użytkownika (naruszenie RODO w UE). Wdrożyć `CookieConsentBanner` + warunkową inicjalizację GA4. Priorytet przed startem w PL.
- Brak endpointu usunięcia konta (polityka prywatności obiecuje prawo do usunięcia danych).
- Brak JSON-LD (Article, Organization, BreadcrumbList) — ważne dla SEO portalu treściowego.
- Double opt-in newslettera zaimplementowany, ale bez testu E2E.
- Pokrycie testami dobre (85% statements, 346 testów FE, 76 e2e) — zaktualizować COVERAGE_PLAN.md.

**Sklep (przyszłość):** CT product/order/order-item/stripe + lib cart istnieją, flaga `SHOP_ENABLED=false` działa. Brakuje: seedu produktów, fulfillmentu, faktur/paragonów, polityki zwrotów, testu live Stripe checkout. Nie blokuje obecnego startu.

## 5. Rekomendowana kolejność działań

**Tydzień 1 — odblokowanie release:**
1. Przegląd i commit wszystkich zmian w locie (AICO + env-validation + ops).
2. `npm ci` + pełny predeploy lokalnie (powtórka zielonego RC).
3. Rotacja klucza OpenRouter; uzupełnienie `.env.production` (20 braków) przez menedżer sekretów.
4. Decyzja: JWT localStorage (akceptacja + CSP) vs cookies.

**Tydzień 2 — start produkcji w trybie controlled:**
5. CSP z allowlistami, Redis maxmemory, harmonogram backupów, uptime-watch + webhook alertów, Sentry/Bugsink DSN.
6. Baner cookies + zgoda dla GA4 (RODO).
7. Deploy → `aico-post-seed-preflight` na targecie → smoke social/GA4/Replicate → production-readiness = GO.
8. Włączenie `AICO_ADMIN_RUN_NOW_ENABLED` po akceptacji operatora; pierwszy controlled run; potem auto-publish na cronie.

**Tydzień 3+ — pełna automatyzacja:**
9. Implementacja live-adapterów Meta/Google Ads (z controlled preflight i smoke bez wydatków) — odblokowuje realne reklamy.
10. Wideo → social, auto-ewaluacja A/B, pętla pamięci redakcyjnej (faza 2).
11. Sklep: seed produktów, live Stripe checkout, faktury, regulamin sklepu.

## 6. Decyzje wymagane od właściciela
1. JWT: akceptacja ryzyka localStorage na soft launch czy migracja na cookies?
2. Error tracking: Sentry (SaaS) czy Bugsink (self-hosted)?
3. Akceptacja baseline'u 16 moderate vulns w API (Strapi)?
4. Kiedy i czy włączamy live ads (wymaga implementacji adapterów + budżet startowy 25 PLN/dzień)?
