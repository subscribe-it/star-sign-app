# Product Owner / Business Analyst

## Produkt

Star Sign to polska platforma astrologiczno-ezoteryczna: horoskopy, tarot, numerologia, blog, konto uzytkownika, premium i przygotowany, ale domyslnie ukryty sklep.

## Uzytkownicy

- Czytelnik szukajacy horoskopu, tarota lub artykulu.
- Uzytkownik konta, ktory chce zapisanych odczytow i funkcji premium.
- Redakcja/administrator, ktory zarzadza trescia w Strapi i automatyzacja AICO.
- Operator produkcji, ktory pilnuje deploya, seedow, backupow i smoke testow.

## Wartosc systemu

- Publiczna aplikacja contentowa z SEO/SSR.
- Backend CMS z treściami i ustawieniami publicznymi.
- Warstwa premium/checkout przygotowana, ale produkcyjnie nadal wymaga osobnej gotowosci Stripe.
- AICO wspiera automatyzacje contentu i potencjalnie social publishing.

## Najwazniejsze reguly biznesowe

- Sklep moze byc ukryty przez `SHOP_ENABLED=false` i `FRONTEND_SHOP_ENABLED=false`.
- `PREMIUM_MODE=open` pozwala traktowac premium jako otwarty tryb soft launch.
- Maintenance mode jest globalnym feature toggle w App Settings.
- Produkcyjny seed wymaga jawnej zgody `ALLOW_PRODUCTION_SEED=true`.

## Ryzyka produktowe

- Public launch byl historycznie oznaczony jako `NO-GO`; przed komunikacja do uzytkownikow trzeba odswiezyc bramki produkcyjne.
- Stripe/Paid Premium nie powinien byc zakladany jako gotowy bez osobnej walidacji.
- README moze byc mniej aktualne niz konfiguracja projektu.

## Polish summary

Produkt jest blisko soft-launch/staging, ale wymaga ostroznego rozdzielenia: publiczny content, tryb maintenance, premium open oraz platny checkout to osobne poziomy gotowosci.
