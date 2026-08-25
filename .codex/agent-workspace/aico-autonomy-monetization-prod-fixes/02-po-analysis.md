# Analiza Product Ownera — autonomia AICO, monetyzacja, zdjęcia prod

Data: 2026-08-25 · Rola: PO / Business Analyst

## Problem biznesowy

Strona ma być **kompletnie zarządzana przez agenta** i **zacząć zarabiać**. Obecnie:

- Treść istnieje (13 artykułów, horoskopy, tarot), ale pipeline AICO działa w trybie bezpiecznym (`guarded`, reklamy/wideo off) — nie „prowadzi" serwisu na żywo.
- Monetyzacja technicznie gotowa (Stripe premium: 24,99 zł/mies., 199 zł/rok; gating treści premium), ale bez aktywnego silnika wzrostu.
- Zdjęcia znaków zodiaku (kluczowa wizualna sekcja SEO!) nie istnieją w ogóle — to osłabia konwersję i pozycje SEO.

## User stories (priorytetyzacja MoSCoW)

**Must have (ten cykl):**
1. Jako właściciel serwisu chcę, aby każda podstrona miała kompletne media, by nie tracić wiarygodności i SEO. *(P0: zdjęcia znaków)*
2. Jako właściciel chcę, by deploys same naprawiały braki mediów (self-heal), żeby problem nie wracał.
3. Jako użytkowniczka chcę widzieć ilustrację znaku na profilu i listach, by strona wyglądała kompletnie.
4. Jako właściciel chcę włączyć pełny autopilot treści (plan→generacja→media→publikacja→social→feedback) z twardymi limitami kosztów.
5. Jako właściciel chcę aktywną ścieżkę przychodu premium: wyraźne CTA, paywall, checkout Stripe na produkcji.

**Should have:** newsletter→premium lejek (AICO round 3 już kładzie fundamenty); asercje smoke chroniące przychód (checkout health).
**Could have:** AI-generowane unikatowe grafiki znaków zamiast statycznych; program afiliacyjny.
**Not now:** sklep fizyczny (SHOP_ENABLED=false zostaje), własna sieć reklamowa display.

## Kryteria akceptacji (wybrane)

1. `/api/zodiac-signs?populate=image` na prodzie zwraca ≥12 obrazów; profil znaku renderuje hero-image.
2. Smoke test failuje, gdy znaki tracą obrazy (regresja).
3. Bootstrap API po deployu idempotentnie uzupełnia brakujące seed-media (bez duplikatów).
4. Tryb `full` autonomii dostępny i udokumentowany; polityka dziennych limitów i budżetów egzekwowana (testy).
5. Checkout premium przechodzi e2e smoke na prodzie (lub ma czytelny health-check).

## Ryzyka / założenia

- Koszt AI-generacji grafik ⇒ decyzja: statyczne assety w repo teraz, AI jako opcja później.
- Pełna autonomia z publikacją na żywo wymaga tokenów/socialów na prodzie — włączamy mechanizm, ale przełączniki env zostają po stronie właściciela (bezpieczeństwo finansowe).
- Nie ruszamy designu UI/UX — nowe grafiki muszą pasować do estetyki nocnego nieba (Lumina Silk).
