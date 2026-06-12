# Virtual User interview

## Symulowany uzytkownik

Operator strony chce po seedzie zobaczyc jasny wynik: czy system moze sam dzialac, a jesli nie, co konkretnie blokuje start.

## Oczekiwana sciezka

1. Operator ustawia sekrety i flagi full autonomy w srodowisku.
2. Uruchamia seed.
3. Uruchamia post-seed preflight.
4. Dostaje raport bez sekretow, z konkretnymi blokadami.
5. Jesli FB/IG/X sa gotowe, raport nie kaze dodatkowo recznie klikac provider status w panelu.

## Obawy uzytkownika

- "Dlaczego preflight mowi, ze ads/video sa wylaczone, skoro ustawilem wymagane tryby controlled/replicate?"
- "Dlaczego TikTok albo YouTube blokuja mnie, skoro wlaczylem tylko Facebook, Instagram i X?"
- "Czy test social przypadkiem publikuje posta?"

## Odpowiedz projektowa

- Test social w post-seed ma byc read-only i nie publikowac.
- Raport ma odroznic brak sekretow, brak scope, blad providera i opcjonalny kanal.
- Fail-closed ma zostac, ale bez falszywych negatywow.

## Wniosek po polsku

Najwieksza frustracja operatora bylby falszywy NO-GO po poprawnej konfiguracji. Aktualny inkrement usuwa te falszywe blokady i nadal pokazuje prawdziwe ryzyka.

## Dodatkowy glos virtual user

Operator chce jeden jasny ekran/raport decyzyjny: status, blokady, warningi, providerzy, kill switch, limity i ostatni preflight. Kazda blokada ma mowic co jest zle, gdzie to poprawic i czy jest blockerem.

Kluczowe oczekiwanie: system nigdy nie publikuje ani nie odpala kosztownej akcji, jezeli provider readiness jest missing/stale/failed albo policy gate odmawia.
## Inkrement: release DB audits niezalezne od cwd

### Perspektywa operatora

Jako operator chce uruchomic predeploy z root repo, przez Nx, przez `npm --prefix apps/api` albo z CI i dostac ten sam wynik audytu. Nie powinienem pamietac, ze przed `premium-content-audit` albo `aico-contract-audit` musze wejsc do `apps/api`.

### Obawy uzytkownika

- Czy audyt na pewno sprawdza te sama baze, ktora wskazuje env file z release?
- Czy reczne uruchomienie z innego katalogu zmieni wynik?
- Czy helper przypadkiem wypisze sekret w raporcie testowym?

### Wniosek po polsku

Najwazniejsze jest przewidywalne zachowanie operacyjne: ta sama komenda release ma widziec te same envy i te same sciezki, niezaleznie od cwd.
