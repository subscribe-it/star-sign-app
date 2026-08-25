# Decision log — dopracowanie systemu (2026-08-25)

## Decision: Statyczne assety znaków + self-heal bootstrapu
Date: 2026-08-25 · Agents: Architect, Developer, QA
### Context
Zdjęcia znaków nie istnieją nigdzie (repo/R2/DB); bootstrap umiał tylko linkować istniejące rekordy.
### Decision
12 konstelacyjnych webp w repo + upload/mapowanie/linkowanie w `ensureSeedMedia` (idempotent, opcjonalne).
### Alternatives
Import z R2 (obiektów brak), generacja AI na starcie (koszt/zależność tokenów na hot-path).
### Consequences
Zero kosztu runtime; AI może podmienić grafiki później przez pipeline AICO media.
### Polish summary
Obrazki jedziemy z repo; deploy sam je wgra i podpięcie nastąpi automatycznie.

## Decision: SSR host allowlist + trustProxyHeaders=true
Date: 2026-08-25 · Agents: Architect, Developer
### Context
Pusty `allowedHosts` w AngularNodeAppEngine ⇒ każdy Host odrzucony ⇒ CSR fallback (prod SEO martwe);
dodatkowo X-Forwarded-* od proxy bez `trustProxyHeaders` degraduje do CSR.
### Decision
`new AngularNodeAppEngine({ allowedHosts: [...z FRONTEND_URL/domen/env], trustProxyHeaders: true })`; stack dostaje `SSR_ALLOWED_HOSTS`.
### Alternatives
Wyłączenie walidacji (`disableAllowedHostsCheck`) — otwiera SSRF.
### Consequences
Nieznany Host → 400 (celowe hardening); localhost/e2e działa bez zmian.
### Polish summary
Serwer SSR znów renderuje treść dla własnych domen, obce hosty dostają 400.

## Decision: Monetyzacja display = AdSense za env, premium pozostaje głównym kanałem
Date: 2026-08-25 · Agents: PO, Designer, Architect
### Context
Sloty „REKLAMA" to placeholdery; realny przychód wymaga sieci reklamowej (konto wydawcy po stronie właściciela).
### Decision
Implementacja env-gated AdSense w istniejących slotach; bez konfiguracji UI bez zmian. Kampanie ads AICO (płatny marketing) zostają env-gated do decyzji budżetowej.
### Consequences
Właściciel podpina publisher ID i zarabia bez deployu kodu.
### Polish summary
Kod gotowy na reklamy; pieniądze startują po wpisaniu ID wydawcy w env.
