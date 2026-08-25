# Refinement — autonomia AICO + monetyzacja (2026-08-25)

Uczestnicy: PO, Virtual User, Designer, Architect, QA (symulacja wg AGENTS.md).

## Problem / wartość
Strona ma być zarządzana przez agenta end-to-end i zarabiać. Silnik już istnieje
(tick co minutę: strategia→generacja→publikacja→social→ads stop-loss), ale tryb
`guarded` + brak integracji reklam = brak pełnej autonomii i przychodu.

## Decyzje refinementu
1. **Autonomia = konfiguracja, nie nowy silnik** (ADR-4): runbook z dokładną matrycą
   env/polityki dla trybu `full`; przełączniki finansowe zostają po stronie właściciela.
2. **Monetyzacja display ads**: wypełnić istniejące placeholdery prawdziwym AdSense
   za env (`ADSENSE_CLIENT_ID` + sloty), bez zmiany designu gdy nie skonfigurowano.
3. **Premium/Stripe**: gotowe — dodamy smoke-check widoczności planów (bez sekretów).
4. Zdjęcia znaków: statyczne assety + self-heal (ADR-1/2) — zrobione, testy zielone.
5. SSR: fix allowedHosts/trustProxyHeaders (ADR-3) — zrobione lokalnie zweryfikowane.

## Edge cases
- Brak ADSENSE_CLIENT_ID → placeholder jak dziś (zero regresji UI).
- Host obcy → 400 (hardening); localhost/e2e nadal działa.
- Pliki zodiakalne nieobecne w obrazie → ciche pominięcie seeda.

## Poza zakresem teraz
Sklep fizyczny, własny ad-server, płatne kampanie na żywo (wymagają tokenów i decyzji budżetowej właściciela).
