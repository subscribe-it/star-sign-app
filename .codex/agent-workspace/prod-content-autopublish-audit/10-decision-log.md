# Decision Log

## Decision: QA audit offline first

Date: 2026-05-08
Agents involved: QA / Test Engineer

### Context

Audyt dotyczy aplikacji testowo dzialajacej na produkcji oraz integracji z zewnetrznymi providerami social. Uzytkownik jawnie zabronil live provider calls i dzialan destrukcyjnych wobec produkcji.

### Decision

Audyt QA wykonano offline/lokalnie: rozpoznanie Sereny, targetow Nx, testow i kodu, plus dwa bezpieczne targety lokalne bez provider calls.

### Alternatives considered

- Uruchomienie `seed:prod` na produkcji.
- Uruchomienie `social/test-connection` albo `dry-run` z realnymi providerami.
- Pelny E2E na produkcji.

### Rationale

Bez zgody na live calls i produkcyjne mutacje najlepszym dowodem sa lokalne testy, kontrakt AICO, inspekcja konfiguracji oraz plan stagingowego preflightu. To minimalizuje ryzyko publikacji testowych postow albo zmiany danych produkcyjnych.

### Consequences

Raport nie moze dac GO produkcyjnego. Moze wskazac, jakie dowody sa wymagane przed GO i ktore testy trzeba dopisac/uruchomic.

### Polish summary

Audyt QA pozostaje bezpieczny i offline. GO wymaga osobnego staging/live validation run z jawna zgoda na provider calls.

## Decision: Post-seed preflight as release blocker

Date: 2026-05-08
Agents involved: QA / Test Engineer

### Context

Seed moze zakonczyc sie powodzeniem, ale automatyzacja nadal moze nie dzialac przez brak tokena, workflow disabled, pusty backlog, brak strategii, brak publicznych mediow lub brak credentiali social.

### Decision

Przed GO wymagany jest post-seed preflight, ktory bez wypisywania sekretow pokazuje stan workflowow, topic queue, media coverage, ustawien autopublish, social credentials readiness, domen i ticketow.

### Alternatives considered

- Poleganie na logu `seed:prod`.
- Reczny przeglad Strapi Admin bez jednego raportu.
- GO po samych unit testach AICO.

### Rationale

Problem jest integracyjny i operacyjny, wiec unit testy nie wystarcza. Preflight laczy stan DB, ustawienia i gotowosc runtime w jeden dowod.

### Consequences

Trzeba dopisac lub uruchomic dedykowany audyt post-seed. Raport musi ukrywac sekrety i zwracac tylko statusy/liczniki.

### Polish summary

GO powinno zalezec od post-seed preflightu, nie tylko od tego, ze seed i testy jednostkowe przeszly.

## Decision: Canonical production URLs for AICO social

Date: 2026-05-08
Agents involved: System Architect, Developer Agent, QA / Test Engineer

### Context

Kod social/orchestratora nadal używa `https://star-sign.app` jako fallback dla target URL i obrazu social. Podczas audytu domena `star-sign.app` nie rozwiązała DNS, a aktywna produkcja działa na `https://star-sign.pl` oraz `https://api.star-sign.pl`.

### Decision

Social URL-e i fallback image muszą być konfigurowane z env/runtime, a kanoniczną domeną dla publicznych linków ma być `https://star-sign.pl`. Fallback image powinien wskazywać publiczny CDN/R2 URL.

### Alternatives considered

- Zostawić hard-coded `star-sign.app`.
- Ustawić tylko `AICO_SOCIAL_DEFAULT_IMAGE_URL`, ale zostawić target URL w orchestratorze.
- Poprawić linki ręcznie w workflowach po seedzie.

### Rationale

Automatyzacja social musi generować poprawne linki bez ręcznej korekty. Hard-coded domena, która nie rozwiązuje DNS, może zepsuć publikacje nawet wtedy, gdy provider credentials są poprawne.

### Consequences

Trzeba dodać helper/konfigurację publicznych URL-i i test regresyjny na `star-sign.app` w runtime payloadach social.

### Polish summary

Posty social muszą linkować do `star-sign.pl` i publicznych obrazów CDN/R2. `star-sign.app` nie może zostać fallbackiem produkcyjnym.

## Decision: Seed settings must merge, not replace

Date: 2026-05-08
Agents involved: System Architect, Developer Agent

### Context

`seedAicoSettings()` zapisuje tylko `timezone` i `locale` do globalnego store AICO. To może usunąć wcześniej przygotowane ustawienia, takie jak `image_gen_model`, zaszyfrowany token Media Gen i `aico_auto_publish_enabled`.

### Decision

Seed ma mergować istniejące global settings i dopisywać brakujące pola. Nie powinien zastępować całego obiektu settings minimalnym payloadem.

### Alternatives considered

- Zostawić obecne nadpisywanie settings.
- Przenieść całą odpowiedzialność do bootstrapu aplikacji.
- Wymagać ręcznego ustawiania global settings po każdym seedzie.

### Rationale

Produkcja po seedzie ma być powtarzalna. Nadpisywanie store utrudnia diagnozę i może wyłączać zależne funkcje bez czytelnego błędu.

### Consequences

Trzeba zmienić seed oraz dopisać test, który potwierdzi zachowanie istniejących settings przy ponownym seedzie.

### Polish summary

Seed AICO powinien zachowywać istniejące ustawienia i sekrety runtime. Nadpisanie settings tylko `timezone/locale` jest ryzykiem dla autogenerowania.

## Decision: Provider readiness gates stay explicit

Date: 2026-05-08
Agents involved: Product Owner / Business Analyst, System Architect, Developer Agent, QA / Test Engineer

### Context

Produkcja testowa może jeszcze nie mieć wszystkich sekretów Media Gen, Facebooka, Instagrama i X. Jednocześnie docelowy autopilot nie powinien udawać gotowości, gdy tych sekretów brakuje.

### Decision

Dodano opcjonalne bramki `AICO_MEDIA_GEN_REQUIRED` i `AICO_SOCIAL_PUBLISH_REQUIRED`. Domyślnie pozostają wyłączone, ale po ustawieniu na `true` `ops/production-env-check.sh` wymaga kompletu odpowiednich sekretów i publicznych URL-i.

### Alternatives considered

- Zawsze wymagać wszystkich sekretów providerów.
- Nigdy nie wymagać sekretów w env checku i polegać tylko na runtime preflight.
- Blokować seed, gdy brakuje social credentials.

### Rationale

To pozwala rozwijać i wdrażać bez przypadkowego wpisywania pustych sekretów do repo, a jednocześnie daje operatorowi twardą bramkę przed produkcyjnym GO.

### Consequences

Operator musi świadomie podnieść bramki do `true` przed pełnym uruchomieniem autopilota. Preflight nadal raportuje braki, nawet jeśli env check działa w trybie łagodnym.

### Polish summary

Gotowość Media Gen i social publishing jest jawnie sterowana flagami. Obecny env może przejść bez sekretów, ale pełne GO wymaga włączenia bramek i uzupełnienia providerów.
