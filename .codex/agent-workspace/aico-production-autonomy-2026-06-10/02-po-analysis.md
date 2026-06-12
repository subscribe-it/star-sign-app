# Product Owner / Business Analyst analysis

## Problem

Uzytkownik oczekuje pelnego autopilota AICO: system ma sam planowac, generowac, publikowac i dystrybuowac tresci. W praktyce wartoscia biznesowa jest stale zasilanie strony i kanalow social bez recznej obslugi, ale z mozliwoscia zatrzymania kosztownych albo ryzykownych efektow.

## MVP produkcyjny

Najmniejszy wartosciowy poziom dla aktualnego inkrementu:

- seed tworzy kompletna konfiguracje workflowow,
- preflight po seedzie potrafi realnie powiedziec GO/NO-GO,
- provider readiness jest odswiezane przez read-only testy social,
- opcjonalne kanaly nie blokuja FB/IG/X,
- raport nie udaje gotowosci bez sekretow, strict audit i provider readiness.

## Kryteria akceptacji

- `AICO_ADS_PROVIDER_MODE=controlled` nie jest traktowane jako disabled w post-seed preflight.
- `AICO_VIDEO_PROVIDER_MODE=replicate` nie jest traktowane jako disabled w post-seed preflight.
- Provider readiness w full autonomy sprawdza wymaganych providerow wynikajacych z podstawy systemu i `AICO_SOCIAL_CHANNELS`.
- Post-seed preflight umie wykonac read-only social connection preflight, ktory odswieza provider status bez publikacji.
- Testy jednostkowe pokrywaja nowe reguly.

## Ryzyka

- Realne provider smoke wymaga sekretow na docelowym srodowisku, ktorych nie wolno zapisywac w repo.
- Test polaczenia social moze zwrocic degradacje przez chwilowa niedostepnosc API providera.
- Pelne GO nadal wymaga runtime evidence, nie tylko zielonego builda.

## Wniosek po polsku

Ten inkrement zwieksza produkcyjna samodzielnosc AICO bez zdejmowania zabezpieczen. Zamiast wlaczac niekontrolowane live efekty, porzadkuje sciezke dowodowa przed GO.

## Raport PO subagenta

Subagent PO potwierdzil, ze MVP produkcyjnej autonomii obejmuje tresci i social end-to-end, ale `GO_WITH_WARNINGS` nie moze byc traktowane jako pelne produkcyjne GO. Ads/video pozostaja w profilu controlled/limited do osobnej decyzji live GO.

Najwazniejsze kryteria:

- `production-readiness=GO` wymaga full autonomy flags, strict audit, provider readiness i kill switch off.
- FB/IG/X musza miec swieze provider readiness zanim social publish wykona efekt.
- Ads `controlled` nie oznacza live spend.
- Video `replicate` oznacza kontrolowany external render job z kosztami i readiness, nie nieograniczony live provider.
- Raporty i logi nie moga ujawniac sekretow ani raw provider payloadow.
## Inkrement: release DB audits niezalezne od cwd

### Problem biznesowy

Production release gate ma wykrywac niespojnosc AICO/premium content przed wdrozeniem. Jezeli audyty DB laduja `.env` na podstawie przypadkowego `process.cwd()`, operator moze uruchomic poprawna komende przez inny wrapper i dostac falszywy wynik albo polaczenie z niewlasciwa baza.

### Wartosc

Ujednolicenie ladowania env dla `premium-content-audit` i `aico-contract-audit` zmniejsza ryzyko, ze staging/production predeploy przejdzie albo padnie z powodow operacyjnych niezwiązanych z realnym stanem danych.

### Kryteria akceptacji

- Audyty release DB potrafia korzystac z jawnego env file wskazanego przez `AICO_AUDIT_ENV_FILE` albo `COMPOSE_ENV_FILE`.
- AICO post-seed preflight interpretuje wzgledny `AICO_PREFLIGHT_ENV_FILE`/`COMPOSE_ENV_FILE` wzgledem root workspace, a nie runtime `cwd`.
- Audyty zachowuja dotychczasowe zachowanie: nie nadpisuja juz ustawionych envow procesu.
- Domyslne `.env` sa szukane wzgledem repo/app, a nie wzgledem `cwd`.
- Zmiana jest pokryta testem bez laczenia z prawdziwa baza i bez ujawniania sekretow.

### Wniosek po polsku

To jest maly, ale produkcyjnie wazny hardening: release gate ma byc odporny na sposob uruchomienia, nie tylko na szczesliwy `cwd` z Nx.

## Inkrement: runtime AICO contract niezalezny od cwd

### Problem biznesowy

AICO generuje tresci na podstawie wspolnego katalogu promptow. Jezeli runtime nie znajdzie `aico-content-contract.json` po starcie z innego `cwd`, generowanie i publikacja moga pasc mimo poprawnego deploya.

### Kryteria akceptacji

- Runtime helper ma odnajdywac kontrakt wzgledem lokalizacji modulu, dla source i dist.
- Istniejace prompt API (`getAicoPromptTemplate`) pozostaje bez zmian.
- Test runtime zmienia `process.cwd()` i nadal odczytuje prompt.

### Wniosek po polsku

To jest bezposredni warunek produkcyjnego generowania: katalog promptow nie moze byc zalezy od katalogu, z ktorego wystartowal proces.

## Inkrement: media-generator temp dir niezalezny od cwd

### Problem biznesowy

Autonomiczne generowanie obrazow pobiera plik z providera i przekazuje go do Strapi Upload. Jezeli temp file trafia do `process.cwd()/public/uploads/tmp`, proces uruchomiony z innego katalogu moze pisac w zlym miejscu albo nie sprzatac przewidywalnej sciezki.

### Kryteria akceptacji

- `media-generator` wylicza `public/uploads/tmp` wzgledem aplikacji/pluginu, nie przypadkowego cwd.
- Test zmienia `process.cwd()` i potwierdza, ze temp file/upload filepath jest pod `apps/api/public/uploads/tmp`.
- Upload nadal sprzata plik tymczasowy po zakonczeniu.

### Wniosek po polsku

To jest warunek stabilnego media pipeline: generowanie obrazow nie moze zalezec od katalogu startowego procesu.

## Inkrement: media.generate effect guard

### Problem biznesowy

Generowanie obrazu moze miec koszt zewnetrzny. Nawet jesli typowa sciezka przez selector/autopilot zna provider readiness, sam service `media-generator` powinien byc ostatnia linia obrony przed wykonaniem calla do Replicate.

### Kryteria akceptacji

- `media-generator` sprawdza `autonomy-policy.evaluate({ action: 'media.generate' })` przed provider call.
- `media-generator` sprawdza `provider-status.checkProviders({ action: 'media.generate', providers: ['replicate'] })` przed provider call.
- Brak tokena image generation blokuje przed utworzeniem klienta Replicate.
- `AICO_IMAGE_GEN_TOKEN` jest respektowany jako env fallback przed `REPLICATE_API_TOKEN`.

### Wniosek po polsku

To zamyka bezposredni safety boundary przy koszcie: generowanie obrazu nie rusza providera bez policy, provider readiness i tokena.
