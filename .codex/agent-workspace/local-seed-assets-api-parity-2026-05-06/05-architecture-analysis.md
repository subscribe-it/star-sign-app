# Architecture Analysis

## Decyzja techniczna

Rozszerzono `ensureSeedMedia` jako wspólny gate seedów mediów. Moduł dalej uploaduje lokalne assety tarota, ale dodatkowo czyta aktywne, zlinkowane AICO media assets i deterministycznie podpina je do seedowanych znaków zodiaku oraz artykułów.

## Powody

- Bucket R2 sam w sobie nie wystarcza. Strapi API zwraca obrazy tylko wtedy, gdy istnieją rekordy uploadu i relacje w DB.
- AICO media catalog jest właściwym źródłem mapowania assetów do celu użycia.
- Workflowy AICO nie powinny być potrzebne do pokazania obecnych seedów.

## Ryzyka

- Jeśli w bazie nie ma zmapowanego `media-asset` z relacją `asset`, seed nie ma czego przypiąć.
- Repo zawiera tylko lokalne obrazy tarota. Zodiak i blog wymagają istniejących rekordów Media Library albo osobnych assetów.

## Konkluzja

Zmiana nie dodaje nowej usługi i nie odpala generowania AI. Wzmacnia istniejący kontrakt: Media Library + AICO media catalog + relacje Content API.

## Doprecyzowanie architektoniczne

Dodajemy etap auto-discovery w `ensureSeedMedia`: czyta istniejące `plugin::upload.file`, używa istniejącego kontraktu `suggestMediaMapping`, tworzy mapowania tylko dla celów contentowych (`zodiac_profile`, `horoscope_sign`, `blog_article`) i pomija fallback oraz pliki tarota obsługiwane osobnym seedem.

## Podsumowanie

Źródłem prawdy nadal jest Strapi DB. Bucket i lokalne pliki są tylko fizycznym magazynem. Widok Angular pozostaje prosty: korzysta z tego samego `currentSign.image`, bez osobnych endpointów i bez duplikowania logiki mapowania po stronie klienta.
