# 03 — Analiza Virtual User Agent (skrót, PL) · 2026-08-25

## Symulowana rozmowa o naprawach i monetyzacji
**VU (Ania, 29, stała czytelniczka):** „Wchodzę na /znaki/baran codziennie rano.
Dlaczego nie widzę grafiki znaku? Strona wygląda jak niedokończona."
→ Potwierdza P0: brak zdjęć psuje zaufanie dokładnie w punkcie nawyku.

**VU:** „Strona była dziwna przy googlowaniu — klikam wynik i widzę pusty ekran
na sekundę." → CSR fallback = realny ból użytkownika z Google; SSR fix odpowiada
bezpośrednio na tę skargę.

**VU o reklamach:** „Banery OK, ale jak wyskoczy popup albo auto-play wideo —
usuwam stronę z zakładek." → Design decision: tylko spokojne sloty inline
(zgodne z istniejącymi placeholderami), zero agresywnych formatów. AdSlot
implementuje dokładnie ten model (fallback placeholder bez ID).

**VU o premium:** „Zapłacę, jeśli dostanę głębszą interpretację i archiwum,
nie jeśli zablokujecie mi podstawowy horoskop." → Paywall tylko na głębi;
treść publiczna zostaje (spójne z gatingiem i analizą PO).

**VU o newsletterze:** „Zapisuję się po jednym dobrym mailu tygodniowo; spam
dzienny = wypis." → AICO social/content frequency musi mieć limity dzienne
(polityka autonomii już je ma); rekomendacja dla runbooka.

## Wnioski (PL)
1. Naprawa zdjęć+SSR to naprawa zaufania i retencji, nie tylko techniki.
2. Model reklamowy: subtelny inline → akceptowalny; agresja → odpływ.
3. Premium sprzedaje głębię i wygodę, nigdy blokadę podstaw.
4. Komunikacja częstotliwości (newsletter/social) wymaga jawnych limitów.
