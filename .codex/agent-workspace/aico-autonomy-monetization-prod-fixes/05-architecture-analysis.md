# Analiza architektoniczna — zdjęcia prod, SSR, autonomia AICO

Data: 2026-08-25 · Rola: System Architect · Serena: użyta (symbole seed-media, autonomy-policy)

## Stan zdiagnozowany (dowody 2026-08-25)

| # | Znalezisko | Dowód | Wpływ |
|---|---|---|---|
| A1 | Znaki zodiaku bez obrazów (12/12 `image:null`) | API prod `/api/zodiac-signs?populate=image` | SEO/konwersja sekcji /znaki |
| A2 | Pliki zdjęć znaków nie istnieją nigdzie: repo 0/139, R2 0/115 (tylko tarot+placeholder), DB brak | ls, ListObjectsV2 | przyczyna źródłowa A1 |
| A3 | Bootstrap uploaduje tylko tarot; znaki = discovery istniejących uploadów | `ensureSeedMedia@1532`, `ensureZodiacSignImages@1269` | samonaprawa niemożliwa |
| A4 | **Prod serwuje CSR shell dla wszystkich tras** (31 218 B identyczne, `<app-root>` puste) | curl ×4 trasy diff -q | SEO SSR martwe |
| A5 | Autonomia: tryby off/draft_only/guarded/full + limity dzienne + budżety ads w polityce | `autonomy-policy.ts` | gotowe do `full` |

## Decyzje architektoniczne (ADR-skrót)

### ADR-1: Statyczne seed-assety znaków + self-heal w bootstrapie (A1/A3)
**Decyzja:** dodać `ZODIAC_SEED_ASSETS` (12 webp, konstelacyjne ilustracje spójne z Lumina Silk) do `apps/api/public/uploads`, rozszerzyć `ensureSeedMedia` o upload+media-asset (`purpose: zodiac_profile`) i linkowanie — analogicznie do tarota. Bootstrap idempotentny (dedupe po nazwie/hashu już istnieje).
**Alternatywy:** ręczny import przez admina (nie skaluje się, wróci po czyszczeniu), generacja AI przy starcie (koszt/zależność od tokenów na hot path deployu). **Konsekwencje:** ~12×~50 kB do obrazu; zero kosztu runtime; AI może podmienić później przez pipeline media.

### ADR-2: Regresja w smoke (A1)
**Decyzja:** `ops/smoke.sh` + e2e dostają asercję: ≥10/12 znaków ma `image.url`. Fail = blokada deploy gate.
**Alternatywa:** tylko test jednostkowy — niewystarczające (bug przeżył wiele release'ów).

### ADR-3: Diagnoza SSR przed zmianami (A4)
**Decyzja:** reprodukcja lokalna buildem prod + `server.mjs`; jeśli lokalnie działa → winna stara/broken image na prodzie ⇒ naprawą jest redeploy main (nasze zmiany jadą razem); jeśli lokalnie pada → fix kodu. Dodatkowo smoke dostaje asercję treści trasowej (np. `/znaki/baran` zawiera „Baran" w HTML).
**Alternatywa:** ślepe wypychanie — odrzucone (brak dowodu).

### ADR-4: Full autonomy jako konfiguracja, nie nowy kod (A5)
**Decyzja:** wykorzystać istniejącą maszynę polityki: dokumentacja+preset env dla `full` (`AICO_STRATEGY_AUTOPILOT_ENABLED`, `AUTO_PUBLISH_ENABLED`, social channels, budżety), uzupełnienie tego, czego brakuje w łańcuchu (patrz plan), bez przepisywania silnika.
**Alternatywa:** nowy „autopilot service" — duplikowałoby istniejące mechanizmy (strategy-planner, autopilot.ts już są).

## Bezpieczeństwo / obserwowalność
- Sekrety tylko env; nic nie logujemy. Budżety ads mają ledger + kill switch (już jest).
- Self-heal loguje `[seed-media]` summary — wystarczy do debugingu; dodamy licznik `zodiacUploaded`.
