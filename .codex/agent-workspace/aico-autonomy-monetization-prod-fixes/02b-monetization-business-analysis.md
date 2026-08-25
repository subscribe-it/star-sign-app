# Analiza biznesowa: jak star-sign.pl może zacząć zarabiać (2026-08-25)

Metoda: wieloagentowa (PO / Virtual User / Designer / Architect / QA) + **grillowanie**
każdego strumienia (design-tree pytań z rekomendacjami; pytania „dla właściciela"
oznaczone ⏸ — blokują wdrożenie do czasu decyzji).

## Kontekst faktyczny (bez zgadywania)
- Ruch: brak publicznego GA4 na ten moment (cel biznesowy 50k sesji/mies. z SEO).
- Premium: Stripe gotowy (24,99 zł/mies., 199 zł/rok), gating treści działa.
- Treść: 13 artykułów, 12 znaków, tarot 22 karty, horoskopy dzienne; AICO potrafi
  generować artykuły/media i publikować społecznie (runbook autonomii).
- Sloty reklamowe istnieją w UI jako placeholdery (home/premium/horoscope).
- Newsletter (Brevo) działa; cookie-banner ma zgodę marketing (wymóg prawny ads).

## Strumienie przychodu — ocena i grill

### 1. Subskrypcja Premium (Stripe) — **PRIORYTET 1**
- PO: jedyny strumień bez zależności zewnętrznych; LTV rośnie z częstotliwością
  odczytów (horoskop dzienny → nawyk → płatność).
- Virtual User: zapłaci, gdy darmowa wersja wyraźnie „ucina" wartość w punkcie
  emocjonalnym (interpretacja osobista), nie gdy blokuje podstawy.
- Grill Q1: Czy paywall nie zabije SEO? → treść publiczna indeksowana, premium
  dodatkowa; gate tylko na głębię. Q2: cena 24,99 vs rynek (Chani ~$10/tydz.)?
  → mocno poniżej rynku; test rocznej 199 jako domyślnej w CTA. ⏸Q3: trial 7 dni?
  (env już wspiera trialing — decyzja produktowa).
- QA: mierzalne (konwersja checkout, churn) — smoke pilnuje health.

### 2. Reklamy display (AdSense) — **PRIORYTET 2** (kod gotowy w PR #34)
- PO: przychód od pierwszego dnia ruchu, skaluje się z SEO; niska stawka w niszy,
  ale zerowy koszt krańcowy.
- Designer: tylko istniejące sloty (home/premium/horoscope), bez wyskakujących
  okienek — estetyka Lumina Silk zakłada brak agresji.
- Architect: wymaga `ADSENSE_CLIENT_ID` + loader po zgodzie marketing; eksponowane
  w runtime-config (PR #34). ⏸Q4: konto wydawcy + weryfikacja domeny przez właściciela.
- Virtual User: akceptuje spokojny banner; irytacja = natychmiastowy wzrost bounce.

### 3. Produkty cyfrowe (e-book/ritual PDF, „Rok w gwiazdach") — **PRIORYTET 3**
- PO: marża ~100%, wykorzystuje treść AICO jako surowiec; naturalne upsell z bloga.
- Grill Q5: własny sklep (SHOP_ENABLED) vs Stripe Payment Link? → Payment Link =
  zero utrzymania, test popytu w tydzień. ⏸Q6: jaki pierwszy produkt i cena?
- QA: śledzenie konwersji przez analytics events (już są).

### 4. Programy afiliacyjne (krzesła astro/kryształy/książki) — PRIORYTET 4
- PO: pasuje do treści blogowych; ryzyko zaufania → tylko recenzje oznaczone.
- Grill Q7: czy nie kanibalizuje premium? → umieszczanie w treściach evergreen,
  nie w horoskopach. ⏸Q8: wybór programów (CJ/Amazon.pl).

### 5. Sponsorowany newsletter — PRIORYTET 5 (po >2–5k subskrybentów)
- PO: stawki rynkowe PL ~200–800 zł/wysyłkę przy tej liście; czeka na wzrost listy.
- AICO: lejek newsletter→premium już częściowo wbudowany (round 3).

## Ranking wdrożenia (efekt / koszt / zależności)
| # | Strumień | Wdrożenie | Zależność |
|---|---|---|---|
| 1 | Premium funnel (już żywy) | dokończenie CTA/trial ⏸ | decyzja cenowa |
| 2 | AdSense env-gated | kod: następny krok | ⏸ ID wydawcy |
| 3 | E-book via Payment Link | 1 dzień pracy | ⏸ temat/cena |
| 4 | Afiliacja | po ruchu 5k+ | ⏸ programy |
| 5 | Sponsor newslettera | po liście 2k+ | wzrost listy |

## Wniosek wieloagentowy (PL)
Najlepsze rozwiązania **do zaimplementowania teraz**: (a) dopięcie AdSense w istniejących
slotach za env (bezpieczne, zero zmian UI bez konfiguracji), (b) utwardzenie pomiaru
konwersji premium (eventy już istnieją — dodać asercję smoke widoczności planów).
Reszta strumieni to decyzje właściciela ⏸ ujęte powyżej — dokument celowo je wylicza,
żeby rozmowa biznesowa miała twardą podstawę.
